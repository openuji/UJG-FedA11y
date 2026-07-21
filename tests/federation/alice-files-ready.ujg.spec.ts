import {
  axeFailureMessage,
  runAxeAudit,
  shouldFailForAxeViolations
} from "@ujg-fed-a11y/playwright-axe-audit";
import { expect, test } from "@playwright/test";

import { aliceUser, logIn, openFilesApp } from "./nextcloud-test-helpers.js";
import { toPlaywrightObservationLocator } from "./playwright-ujg-locator.js";
import {
  describeResolvedObservation,
  loadFilesharingUjg,
  type ResolvedStatePresenceTarget,
  resolveStatePresenceTarget
} from "./ujg-resolver.js";

const aliceFilesReadyStateId = "urn:state:alice-files-ready";

test("resolves the Alice files-ready UJG state to a Nextcloud accessible locator", async ({
  page
}, testInfo) => {
  const document = loadFilesharingUjg();
  const target = resolveStatePresenceTarget(document, aliceFilesReadyStateId);

  testInfo.annotations.push({
    type: "ujg-resolution",
    description: describeResolvedObservation(target.observation)
  });

  await logIn(page, aliceUser);
  await openFilesApp(page, aliceUser);

  const resolvedLocator = toPlaywrightObservationLocator(page, target.bindings);

  await expect(resolvedLocator).toHaveCount(1);
  await expect(resolvedLocator).toBeVisible();

  const axeReport = await runAxeAudit({
    page,
    testInfo,
    resolvedLocator,
    auditId: "alice-files-ready",
    metadata: axeMetadataForTarget(target)
  });

  expect(
    shouldFailForAxeViolations(axeReport),
    axeFailureMessage(axeReport)
  ).toBe(false);
});

function axeMetadataForTarget(target: ResolvedStatePresenceTarget) {
  return {
    ujg: {
      stateId: target.observation.stateId,
      ...(target.observation.stateLabel ? { stateLabel: target.observation.stateLabel } : {}),
      surfaceId: target.observation.surfaceId,
      ...(target.observation.surfaceLabel ? { surfaceLabel: target.observation.surfaceLabel } : {}),
      bindings: target.bindings.map((binding) => ({
        bindingId: binding.id,
        locators: binding.locators.map((locator) => ({
          locatorId: locator.id,
          ...(locator.role ? { role: locator.role } : {}),
          ...(locator.accessibleName ? { accessibleName: locator.accessibleName } : {})
        }))
      }))
    }
  };
}
