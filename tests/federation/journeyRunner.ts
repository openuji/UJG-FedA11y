import { expect, type Browser, type Page, type TestInfo } from "@playwright/test";

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

const stateAssertionTimeout = 30_000;
const entryBindingRoutes = new Map<string, string>([
  ["nextcloud.files", "/apps/files/"],
  ["nextcloud.pendingShares", "/apps/files/pendingshares"]
]);

export const runHappyPathPlan = async ({
  plan,
  browser,
  testInfo,
  context
}: {
  plan: HappyPathPlan;
  browser: Browser;
  testInfo: TestInfo;
  context: HappyPathExecutionContext;
}) => {
  const pages = new Map<string, Page>();
  const currentRoutes = new Map<string, string>();
  const materializedUsers = new Set<string>();

  try {
    for (const userId of new Set(plan.items.map((item) => item.userId))) {
      const user = context.usersById.get(userId);
      if (!user) throw new Error(`No Nextcloud user mapping for ${userId}`);
      const page = await browser.newPage();
      await logIn(page, user);
      pages.set(userId, page);
    }

    for (const item of plan.items) {
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
        continue;
      }

      await expect(locator).toHaveCount(1);
      await expect(locator).toBeVisible();
      if (item.kind === "transition") {
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
  } finally {
    await Promise.all([...pages.values()].map((page) => page.close()));
  }
};

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
