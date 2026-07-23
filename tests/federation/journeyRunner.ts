import { expect, type Browser, type Page, type TestInfo } from "@playwright/test";

import {
  aliceUser,
  bobUser,
  federatedRecipient,
  logIn,
  openFilesApp,
  type NextcloudUser
} from "./nextcloud-test-helpers.js";
import {
  activateResolvedTransition,
  resolveTransitionActivationCommand,
  toPlaywrightObservationLocator
} from "./playwright-ujg-locator.js";
import { type HappyPathPlan, type HappyPathPlanItem } from "./ujg-resolver-2.js";

const keyboardInputModalityId = "urn:input-modality:keyboard";
const users = new Map<string, NextcloudUser>([
  ["urn:user:alice", aliceUser],
  ["urn:user:bob", bobUser]
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

  try {
    for (const userId of new Set(plan.items.map((item) => item.userId))) {
      const user = users.get(userId);
      if (!user) throw new Error(`No Nextcloud user mapping for ${userId}`);
      const page = await browser.newPage();
      await logIn(page, user);
      await openFilesApp(page, user);
      pages.set(userId, page);
    }

    for (const item of plan.items) {
      testInfo.annotations.push({ type: "ujg-plan-item", description: itemDescription(item) });
      if (item.kind === "control-flow") continue;
      const page = pages.get(item.userId);
      if (!page) throw new Error(`No Playwright page for ${item.userId}`);
      const locator = toPlaywrightObservationLocator(page, item.target.bindings);
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
      }
    }
  } finally {
    await Promise.all([...pages.values()].map((page) => page.close()));
  }
};

function itemDescription(item: HappyPathPlanItem): string {
  if (item.kind === "state") return item.target.observation.stateId;
  if (item.kind === "transition") return item.target.activation.transitionId;
  return item.transitionId;
}
