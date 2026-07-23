import { expect, type Browser, type Page, type TestInfo } from "@playwright/test";

import {
  aliceUser,
  bobUser,
  dismissFirstRunDialog,
  expectAcceptedFederatedShareHasMountedFile,
  federatedRecipient,
  logIn,
  trimTrailingSlash,
  type NextcloudUser
} from "./nextcloud-test-helpers.js";
import {
  activateResolvedTransition,
  resolveTransitionActivationCommand,
  toPlaywrightObservationLocator
} from "./playwright-ujg-locator.js";
import { type HappyPathPlan, type HappyPathPlanItem } from "./ujg-resolver-2.js";

const keyboardInputModalityId = "urn:input-modality:keyboard";
const stateAssertionTimeout = 30_000;
const effectCompletionWaits = new Map<string, () => Promise<void>>([
  ["urn:effect:bob-accept-share", expectAcceptedFederatedShareHasMountedFile]
]);
const users = new Map<string, NextcloudUser>([
  ["urn:user:alice", aliceUser],
  ["urn:user:bob", bobUser]
]);
const filesRoute = "/apps/files/";
const surfaceRoutes = new Map<string, string>([
  ["urn:surface:alice-files-ready", filesRoute],
  ["urn:surface:alice-opens-file-menu", filesRoute],
  ["urn:surface:alice-share-panel-open", filesRoute],
  ["urn:surface:alice-enters-remote-bob", filesRoute],
  ["urn:surface:alice-remote-recipient-entered", filesRoute],
  ["urn:surface:alice-selects-remote-recipient", filesRoute],
  ["urn:surface:alice-share-permissions-open", filesRoute],
  ["urn:surface:alice-confirms-share", filesRoute],
  ["urn:surface:alice-share-confirmed", filesRoute],
  ["urn:surface:bob-incoming-share-visible", "/apps/files/pendingshares"],
  ["urn:surface:bob-accepts-share", "/apps/files/pendingshares"],
  ["urn:surface:bob-pending-share-offer-cleared", "/apps/files/pendingshares"],
  ["urn:surface:bob-opens-shares-overview", "/apps/files/pendingshares"],
  ["urn:surface:bob-shared-report-visible", "/apps/files/shareoverview"]
]);

export const runHappyPathPlan = async ({
  plan,
  browser,
  testInfo
}: {
  plan: HappyPathPlan;
  browser: Browser;
  testInfo: TestInfo;
}) => {
  const pages = new Map<string, Page>();
  const currentRoutes = new Map<string, string>();
  let previousAction: HappyPathPlanItem | undefined;

  try {
    for (const userId of new Set(plan.items.map((item) => item.userId))) {
      const user = users.get(userId);
      if (!user) throw new Error(`No Nextcloud user mapping for ${userId}`);
      const page = await browser.newPage();
      await logIn(page, user);
      pages.set(userId, page);
    }

    for (const item of plan.items) {
      testInfo.annotations.push({ type: "ujg-plan-item", description: itemDescription(item) });
      if (item.kind === "control-flow") {
        previousAction = item;
        continue;
      }
      const page = pages.get(item.userId);
      if (!page) throw new Error(`No Playwright page for ${item.userId}`);
      const user = users.get(item.userId);
      if (!user) throw new Error(`No Nextcloud user mapping for ${item.userId}`);
      const route = routeForItem(item);
      const followsSameUserTransition =
        item.kind === "state" &&
        previousAction?.kind === "transition" &&
        previousAction.userId === item.userId;
      if (currentRoutes.get(item.userId) !== route && !followsSameUserTransition) {
        await openNextcloudRoute(page, user, route);
        currentRoutes.set(item.userId, route);
      }
      const locator = toPlaywrightObservationLocator(page, item.target.bindings);
      if (item.kind === "state") {
        await expect(locator).toHaveCount(item.target.expectedCount, {
          timeout: stateAssertionTimeout
        });
        if (item.target.expectedCount === 1) {
          await expect(locator).toBeVisible({ timeout: stateAssertionTimeout });
        }
        currentRoutes.set(item.userId, route);
        previousAction = item;
        continue;
      }

      await expect(locator).toHaveCount(1);
      await expect(locator).toBeVisible();
      if (item.kind === "transition") {
        const profile = item.target.activation.requiredInputModalityProfiles.find((candidate) =>
          candidate.modalities.some((modality) => modality.id === keyboardInputModalityId)
        );
        if (!profile) throw new Error(`No keyboard profile for ${item.target.activation.transitionId}`);
        const command = resolveTransitionActivationCommand(item.target.activation, profile);

        // if(item.id === "urn:transition:alice-confirms-share") {
        //   console.log('urn:transition:alice-confirms-share', command, item, locator)
        // }
        
        await activateResolvedTransition(locator, item.target.activation, command, {
          federatedRecipient
        });
        if (item.target.activation.effectRef) {
          await effectCompletionWaits.get(item.target.activation.effectRef)?.();
        }
      }
      previousAction = item;
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

function routeForItem(item: HappyPathPlanItem | undefined): string {
  if (!item || item.kind === "control-flow") return filesRoute;
  const surfaceId =
    item.kind === "state" ? item.target.observation.surfaceId : item.target.activation.surfaceId;
  return surfaceRoutes.get(surfaceId) ?? filesRoute;
}

function itemDescription(item: HappyPathPlanItem): string {
  if (item.kind === "state") return item.target.observation.stateId;
  if (item.kind === "transition") return item.target.activation.transitionId;
  return item.transitionId;
}
