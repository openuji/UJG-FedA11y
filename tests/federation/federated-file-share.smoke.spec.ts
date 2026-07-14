import { expect, type Page, test } from "@playwright/test";

type NextcloudUser = {
  label: string;
  url: string;
  username: string;
  password: string;
};

const users: NextcloudUser[] = [
  {
    label: "Alice",
    url: requiredEnv("NEXTCLOUD_ALICE_URL"),
    username: requiredEnv("NEXTCLOUD_ALICE_USER"),
    password: requiredEnv("NEXTCLOUD_ALICE_PASSWORD")
  },
  {
    label: "Bob",
    url: requiredEnv("NEXTCLOUD_BOB_URL"),
    username: requiredEnv("NEXTCLOUD_BOB_USER"),
    password: requiredEnv("NEXTCLOUD_BOB_PASSWORD")
  }
];

for (const user of users) {
  test(`${user.label} can log in and open Files`, async ({ page }) => {
    await logIn(page, user);
    await expectFilesApp(page, user);
  });
}



// test('just playwrite call against alice url', async({page}) => {

//       await page.goto(users[0].url, { waitUntil: "domcontentloaded" });
//       const submitButton = await page.getByRole('button', {name: 'Log in', exact: true})
//       await expect(submitButton, {}).toHaveText('Log in');

// })

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function logIn(page: Page, user: NextcloudUser): Promise<void> {
  await page.goto(user.url, { waitUntil: "domcontentloaded" });

  const userInput = page
    .locator('input[name="user"], input[name="username"], input#user')
    .first();
  const passwordInput = page.locator('input[name="password"], input[type="password"]').first();

  await expect(userInput, `${user.label} username input should be visible`).toBeVisible();
  await userInput.fill(user.username);

  await expect(passwordInput, `${user.label} password input should be visible`).toBeVisible();
  await passwordInput.fill(user.password);

  await page.locator('button[type="submit"], input[type="submit"]').first().click();
  await expect(page.getByRole("link", { name: "Files" }).first()).toBeVisible({ timeout: 30_000 });
  await dismissFirstRunDialog(page);
}

async function expectFilesApp(page: Page, user: NextcloudUser): Promise<void> {
  await page.goto(`${trimTrailingSlash(user.url)}/apps/files/`, { waitUntil: "domcontentloaded" });
  await dismissFirstRunDialog(page);

  await expect(page.locator("#app-content, #content, main").first()).toBeVisible();
  await expect(page).toHaveURL(/\/apps\/files(?:\/|\?|$)/);
}

async function dismissFirstRunDialog(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog");

  if (await dialog.isVisible().catch(() => false)) {
    await dialog.getByRole("button", { name: /close/i }).click();
    await expect(dialog).toBeHidden();
  }
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
