import { test } from "@playwright/test";

import { logIn, nextcloudUsers, openFilesApp } from "./nextcloud-test-helpers.js";

for (const user of nextcloudUsers) {
  test(`${user.label} can log in and open Files`, async ({ page }) => {
    await logIn(page, user);
    await openFilesApp(page, user);
  });
}
