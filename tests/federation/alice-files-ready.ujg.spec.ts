import { expect, test } from "@playwright/test";

import { aliceUser, logIn, openFilesApp } from "./nextcloud-test-helpers.js";
import { toPlaywrightLocator } from "./playwright-ujg-locator.js";
import {
  describeResolvedObservation,
  loadFilesharingUjg,
  resolveStatePresenceObservation
} from "./ujg-resolver.js";

const aliceFilesReadyStateId = "urn:state:alice-files-ready";

test("resolves the Alice files-ready UJG state to a Nextcloud accessible locator", async ({
  page
}, testInfo) => {
  const document = loadFilesharingUjg();
  const observation = resolveStatePresenceObservation(document, aliceFilesReadyStateId);

  testInfo.annotations.push({
    type: "ujg-resolution",
    description: describeResolvedObservation(observation)
  });

  await logIn(page, aliceUser);
  await openFilesApp(page, aliceUser);

  const binding = expectSingle(observation.bindings, "presence ObservationBinding");
  const locator = expectSingle(binding.locators, "AccessibleLocator");

  expect(observation.surfaceId).toBe("urn:surface:alice-files-ready");
  expect(binding.id).toBe("urn:obs:alice-files-ready-presence");
  expect(binding.eventId).toBe("urn:observation-event:presence");
  expect(binding.surfaceInstanceResolver).toBeUndefined();
  expect(locator.id).toBe("urn:locator:alice-file-row");
  expect(locator.accessibleName).toBe("report.pdf");

  const resolvedLocator = toPlaywrightLocator(page, locator);
  const count = await resolvedLocator.count();
console.log("resolvedLocator count:", count);

const matches = await resolvedLocator.evaluateAll((elements) =>
  elements.map((element, index) => ({
    index,
    text: element.textContent?.replace(/\s+/g, " ").trim(),
    fileName: element.getAttribute("data-cy-files-list-row-name"),
    fileId: element.getAttribute("data-cy-files-list-row-fileid")
  }))
);

console.log(JSON.stringify(matches, null, 2));

await resolvedLocator.first().scrollIntoViewIfNeeded();
await resolvedLocator.first().highlight();
await page.pause();
  await expect(resolvedLocator.first()).toBeVisible();
});

function expectSingle<T>(items: T[], label: string): T {
  expect(items, `Expected exactly one ${label}`).toHaveLength(1);

  return items[0];
}
