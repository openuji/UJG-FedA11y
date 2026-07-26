import {
  expect,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
  type TestInfo
} from "@playwright/test";
import {
  capturePlaywrightScreenshotArtifact,
  type PlaywrightScreenshotArtifact
} from "@ujg-fed-a11y/playwright-artifacts";
import {
  attachAxePathAuditReport,
  axeFailureMessage,
  buildAxePathAuditReport,
  runAxeAudit,
  shouldFailForAxeViolations,
  type AxeAuditMetadata,
  type AxeAuditReport,
  type AxePathAuditItemInput
} from "@ujg-fed-a11y/playwright-axe-audit";

import {
  auditedAxePathItem,
  createAxeJourneyPlanItem,
  unauditedAxePathItem,
  type AxeJourneyPlanItem
} from "./axeJourneyReport.js";
import {
  dismissFirstRunDialog,
  logIn,
  trimTrailingSlash,
  type NextcloudUser
} from "./nextcloud-test-helpers.js";
import {
  activateResolvedTransition,
  type PlaywrightActivationMode,
  type PlaywrightTransitionValues,
  resolveTransitionActivationCommand,
  selectTransitionActivationProfile,
  toPlaywrightObservationLocator
} from "./playwright-ujg-locator.js";
import { type HappyPathPlan, type HappyPathPlanItem } from "./ujg-resolver-2.js";

export type HappyPathRunMode = PlaywrightActivationMode;
export type HappyPathExecutionContext = {
  usersById: ReadonlyMap<string, NextcloudUser>;
  transitionValues?: ReadonlyMap<string, PlaywrightTransitionValues>;
  effectHandlers?: ReadonlyMap<string, () => Promise<void>>;
  mode: HappyPathRunMode;
};
export type HappyPathAuditConfig = {
  reportId: string;
  metadata?: AxeAuditMetadata;
  strict?: boolean;
  evidenceTimeoutMs?: number;
  sourceScreenshots?: {
    states?: boolean;
    fullPage?: boolean;
    timeoutMs?: number;
  };
};

const stateAssertionTimeout = 30_000;
const entryBindingRoutes = new Map<string, string>([
  ["nextcloud.files", "/apps/files/"],
  ["nextcloud.pendingShares", "/apps/files/pendingshares"]
]);

export const runHappyPathPlan = async ({
  plan,
  browser,
  testInfo,
  context,
  audit
}: {
  plan: HappyPathPlan;
  browser: Browser;
  testInfo: TestInfo;
  context: HappyPathExecutionContext;
  audit?: HappyPathAuditConfig;
}) => {
  const browserContexts = new Map<string, BrowserContext>();
  const pages = new Map<string, Page>();
  const currentRoutes = new Map<string, string>();
  const materializedUsers = new Set<string>();
  const axeJourneyItems = audit
    ? plan.items.map((item, itemIndex) => createAxeJourneyPlanItem(context.mode, itemIndex, item))
    : [];
  const auditItems: AxePathAuditItemInput[] = audit
    ? plan.items.map((item, itemIndex) => initialAxePathItem(axeJourneyItems[itemIndex], item))
    : [];
  const strictFailureReports: AxeAuditReport[] = [];
  let strictFailure: Error | undefined;

  try {
    for (const userId of new Set(plan.items.map((item) => item.userId))) {
      const user = context.usersById.get(userId);
      if (!user) throw new Error(`No Nextcloud user mapping for ${userId}`);
      const browserContext = await browser.newContext();
      const page = await browserContext.newPage();
      await logIn(page, user);
      browserContexts.set(userId, browserContext);
      pages.set(userId, page);
    }

    for (const [itemIndex, item] of plan.items.entries()) {
      const axeJourneyItem = audit ? axeJourneyItems[itemIndex] : undefined;
      testInfo.annotations.push({ type: "ujg-plan-item", description: itemDescription(item) });
      if (item.kind === "control-flow") {
        continue;
      }
      const page = pages.get(item.userId);
      if (!page) throw new Error(`No Playwright page for ${item.userId}`);
      const user = context.usersById.get(item.userId);
      if (!user) throw new Error(`No Nextcloud user mapping for ${item.userId}`);
      const route = routeForEntryBinding(item.entryBindingValue);
      if (route) {
        if (currentRoutes.get(item.userId) !== route) {
          await openNextcloudRoute(page, user, route);
          currentRoutes.set(item.userId, route);
        }
        materializedUsers.add(item.userId);
      } else if (!materializedUsers.has(item.userId)) {
        throw new Error(`No entry binding available to boot ${itemDescription(item)}`);
      }
      const locator = toPlaywrightObservationLocator(page, item.target.bindings);
      if (item.kind === "state") {
        await expect(locator).toHaveCount(item.target.expectedMatchCount, {
          timeout: stateAssertionTimeout
        });
        if (item.target.expectedMatchCount === 1) {
          await expect(locator).toBeVisible({ timeout: stateAssertionTimeout });
        }
        if (audit && axeJourneyItem) {
          const screenshots = await captureStateSourceScreenshots({
            audit,
            journeyItem: axeJourneyItem,
            page,
            testInfo
          });

          if (item.target.expectedMatchCount === 1) {
            auditItems[itemIndex] = unauditedAxePathItem(
              axeJourneyItem,
              "skipped",
              "State source screenshot captured, but the axe audit did not complete.",
              screenshots
            );

            const report = await auditResolvedLocator({
              audit,
              journeyItem: axeJourneyItem,
              locator,
              page,
              strictFailureReports,
              testInfo
            });

            auditItems[itemIndex] = auditedAxePathItem(axeJourneyItem, report, screenshots);
          } else {
            auditItems[itemIndex] = unauditedAxePathItem(
              axeJourneyItem,
              "skipped",
              `Expected match count ${item.target.expectedMatchCount} cannot be scoped to one matched locator.`,
              screenshots
            );
          }
        }
        continue;
      }

      await expect(locator).toHaveCount(1);
      await expect(locator).toBeVisible();
      if (item.kind === "transition") {
        if (audit && axeJourneyItem) {
          const report = await auditResolvedLocator({
            audit,
            journeyItem: axeJourneyItem,
            locator,
            page,
            strictFailureReports,
            testInfo
          });

          auditItems[itemIndex] = auditedAxePathItem(axeJourneyItem, report);
        }
        const profile = selectTransitionActivationProfile(item.target.activation, context.mode);
        const command = resolveTransitionActivationCommand(item.target.activation, profile);

        await activateResolvedTransition(
          locator,
          item.target.activation,
          command,
          context.transitionValues?.get(item.target.activation.transitionId)
        );
        if (item.target.activation.effectRef) {
          await context.effectHandlers?.get(item.target.activation.effectRef)?.();
        }
        if (!route) currentRoutes.delete(item.userId);
      }
    }
    if (strictFailureReports.length > 0) {
      strictFailure = new Error(strictFailureReports.map(axeFailureMessage).join("\n"));
    }
  } finally {
    try {
      if (audit) {
        const report = buildAxePathAuditReport({
          reportId: audit.reportId,
          metadata: {
            ...(audit.metadata ?? {}),
            mode: context.mode,
            planItemCount: plan.items.length
          },
          items: auditItems
        });

        await attachAxePathAuditReport(testInfo, report);
      }
    } finally {
      await Promise.all([...browserContexts.values()].map((browserContext) => browserContext.close()));
    }
  }

  if (strictFailure) {
    throw strictFailure;
  }
};

async function captureStateSourceScreenshots({
  audit,
  journeyItem,
  page,
  testInfo
}: {
  audit: HappyPathAuditConfig;
  journeyItem: AxeJourneyPlanItem;
  page: Page;
  testInfo: TestInfo;
}): Promise<PlaywrightScreenshotArtifact[] | undefined> {
  if (!audit.sourceScreenshots?.states) return undefined;

  return [
    await capturePlaywrightScreenshotArtifact({
      page,
      testInfo,
      id: "source",
      fileBaseName: journeyItem.auditId,
      scope: "page",
      fullPage: audit.sourceScreenshots.fullPage ?? true,
      timeoutMs: audit.sourceScreenshots.timeoutMs
    })
  ];
}

function initialAxePathItem(
  journeyItem: AxeJourneyPlanItem | undefined,
  item: HappyPathPlanItem
): AxePathAuditItemInput {
  if (!journeyItem) {
    throw new Error("Cannot create axe path audit item without journey metadata.");
  }

  if (item.kind === "control-flow") {
    return unauditedAxePathItem(
      journeyItem,
      "not-applicable",
      "Control-flow items do not resolve to a page surface."
    );
  }

  if (item.kind === "state" && item.target.expectedMatchCount !== 1) {
    return unauditedAxePathItem(
      journeyItem,
      "skipped",
      `Expected match count ${item.target.expectedMatchCount} cannot be scoped to one matched locator.`
    );
  }

  return unauditedAxePathItem(
    journeyItem,
    "skipped",
    "Plan item was not audited because the runner ended before this item could be scanned."
  );
}

async function auditResolvedLocator({
  audit,
  journeyItem,
  locator,
  page,
  strictFailureReports,
  testInfo
}: {
  audit: HappyPathAuditConfig;
  journeyItem: AxeJourneyPlanItem;
  locator: Locator;
  page: Page;
  strictFailureReports: AxeAuditReport[];
  testInfo: TestInfo;
}): Promise<AxeAuditReport> {
  const report = await runAxeAudit({
    page,
    testInfo,
    resolvedLocator: locator,
    auditId: journeyItem.auditId,
    metadata: journeyItem.metadata,
    strict: audit.strict,
    evidenceTimeoutMs: audit.evidenceTimeoutMs
  });

  if (shouldFailForAxeViolations(report)) {
    strictFailureReports.push(report);
  }

  return report;
}

async function openNextcloudRoute(page: Page, user: NextcloudUser, route: string): Promise<void> {
  await page.goto(`${trimTrailingSlash(user.url)}${route}`, { waitUntil: "domcontentloaded" });
  await dismissFirstRunDialog(page);
  await expect(page.locator("#app-content, #content, main").first()).toBeVisible();
}

function routeForEntryBinding(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const route = entryBindingRoutes.get(value);
  if (!route) throw new Error(`No Nextcloud route for EntryBinding value ${value}`);
  return route;
}

function itemDescription(item: HappyPathPlanItem): string {
  if (item.kind === "state") return item.target.observation.stateId;
  if (item.kind === "transition") return item.target.activation.transitionId;
  return item.transitionId;
}
