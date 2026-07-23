import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { expect, type Page } from "@playwright/test";

export type NextcloudUser = {
  label: string;
  url: string;
  username: string;
  password: string;
};

export const aliceUser: NextcloudUser = {
  label: "Alice",
  url: requiredEnv("NEXTCLOUD_ALICE_URL"),
  username: requiredEnv("NEXTCLOUD_ALICE_USER"),
  password: requiredEnv("NEXTCLOUD_ALICE_PASSWORD")
};

export const bobUser: NextcloudUser = {
  label: "Bob",
  url: requiredEnv("NEXTCLOUD_BOB_URL"),
  username: requiredEnv("NEXTCLOUD_BOB_USER"),
  password: requiredEnv("NEXTCLOUD_BOB_PASSWORD")
};

export const federatedRecipient =
  process.env.NEXTCLOUD_FEDERATED_RECIPIENT ?? `${bobUser.username}@http://${new URL(bobUser.url).host}`;

export const nextcloudUsers: NextcloudUser[] = [aliceUser, bobUser];

const fixtureFileName = "report.pdf";
const fixtureFilePath = `/${fixtureFileName}`;
const fixtureSourcePath = resolve(
  import.meta.dirname,
  "../../infrastructure/nextcloud-federation/fixtures/report.pdf"
);

export async function ensureFederatedShareFixtureIsClean(): Promise<void> {
  await deleteIncomingRemoteShares(bobUser);
  await deleteFileIfExists(bobUser, fixtureFileName);
  await deleteOutgoingSharesForPath(aliceUser, fixtureFilePath);
  await ensureFileExists(aliceUser, fixtureFileName);
  await expectFederatedShareFixtureIsClean();
}

export async function expectAcceptedFederatedShareHasMountedFile(): Promise<void> {
  await expect
    .poll(async () => {
      const shares = await listOcsShares(bobUser, "/apps/files_sharing/api/v1/remote_shares").catch(
        (error) => `remote-shares:${String(error)}`
      );
      if (typeof shares === "string") return shares;

      const share = shares.find(isFixtureShare);
      if (!share) return "remote-share:missing";
      if (String(share.accepted) !== "1") return `remote-share:accepted:${String(share.accepted)}`;
      if (!share.file_id) return "remote-share:file-id-missing";
      if (!share.mimetype) return "remote-share:mimetype-missing";
      if (share.permissions == null) return "remote-share:permissions-missing";

      const response = await nextcloudFetch(bobUser, davFileUrl(bobUser, fixtureFileName), {
        method: "HEAD"
      });
      return response.ok ? "ok" : `webdav:${response.status}`;
    }, { message: "Bob accepted remote share should be mounted as report.pdf", timeout: 30_000 })
    .toBe("ok");
}

export async function deleteOutgoingSharesForPath(
  user: NextcloudUser,
  path: string
): Promise<void> {
  const shares = await listOcsShares(user, "/apps/files_sharing/api/v1/shares", { path });

  await Promise.all(
    shares.map((share) =>
      deleteOcsResource(user, `/apps/files_sharing/api/v1/shares/${encodeURIComponent(String(share.id))}`)
    )
  );
}

export async function deleteIncomingRemoteShares(user: NextcloudUser): Promise<void> {
  const endpoints = [
    "/apps/files_sharing/api/v1/remote_shares",
    "/apps/files_sharing/api/v1/remote_shares/pending"
  ];

  for (const endpoint of endpoints) {
    const response = await nextcloudFetch(user, ocsUrl(user, endpoint));
    if (!response.ok) continue;
    const shares = await ocsDataArray(response).catch(() => []);
    await Promise.all(
      shares
        .filter(isFixtureShare)
        .map((share) => deleteOcsResource(user, `${endpoint.replace(/\/pending$/, "")}/${encodeURIComponent(String(share.id))}`, true))
    );
  }
}

export async function deleteFileIfExists(user: NextcloudUser, fileName: string): Promise<void> {
  const response = await nextcloudFetch(user, davFileUrl(user, fileName), { method: "DELETE" });
  if (response.status !== 404) await expectOk(response, `delete ${fileName} for ${user.label}`);
}

export async function ensureFileExists(user: NextcloudUser, fileName: string): Promise<void> {
  const head = await nextcloudFetch(user, davFileUrl(user, fileName), { method: "HEAD" });
  if (head.ok) return;
  if (head.status !== 404) await expectOk(head, `check ${fileName} for ${user.label}`);

  const response = await nextcloudFetch(user, davFileUrl(user, fileName), {
    body: await readFile(fixtureSourcePath),
    method: "PUT"
  });
  await expectOk(response, `upload ${fileName} for ${user.label}`);
}

export async function logIn(page: Page, user: NextcloudUser): Promise<void> {
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

export async function openFilesApp(page: Page, user: NextcloudUser): Promise<void> {
  await page.goto(`${trimTrailingSlash(user.url)}/apps/files/`, { waitUntil: "domcontentloaded" });
  await dismissFirstRunDialog(page);

  await expect(page.locator("#app-content, #content, main").first()).toBeVisible();
  await expect(page).toHaveURL(/\/apps\/files(?:\/|\?|$)/);
}

export async function dismissFirstRunDialog(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog");

  if (await dialog.isVisible().catch(() => false)) {
    await dialog.getByRole("button", { name: /close/i }).click();
    await expect(dialog).toBeHidden();
  }
}

export function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

type OcsShare = {
  id: string | number;
  accepted?: string | number | boolean;
  file_id?: string | number | null;
  name?: string;
  file_target?: string;
  mimetype?: string | null;
  mountpoint?: string;
  permissions?: string | number | null;
  path?: string;
};

function nextcloudFetch(user: NextcloudUser, url: URL, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Basic ${Buffer.from(`${user.username}:${user.password}`).toString("base64")}`,
      "OCS-APIRequest": "true",
      ...init.headers
    }
  });
}

function ocsUrl(user: NextcloudUser, endpoint: string, params: Record<string, string> = {}): URL {
  const url = new URL(`/ocs/v2.php${endpoint}`, trimTrailingSlash(user.url));
  url.searchParams.set("format", "json");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}

function davFileUrl(user: NextcloudUser, fileName: string): URL {
  return new URL(
    `/remote.php/dav/files/${encodeURIComponent(user.username)}/${encodeURIComponent(fileName)}`,
    trimTrailingSlash(user.url)
  );
}

async function deleteOcsResource(
  user: NextcloudUser,
  endpoint: string,
  bestEffort = false
): Promise<void> {
  const response = await nextcloudFetch(user, ocsUrl(user, endpoint), { method: "DELETE" });
  if (bestEffort && [404, 405].includes(response.status)) return;
  await expectOk(response, `delete OCS resource ${endpoint} for ${user.label}`);
}

async function ocsDataArray(response: Response): Promise<OcsShare[]> {
  const payload = (await response.json()) as { ocs?: { data?: unknown } };
  return Array.isArray(payload.ocs?.data) ? (payload.ocs.data as OcsShare[]) : [];
}

async function expectFederatedShareFixtureIsClean(): Promise<void> {
  await expect
    .poll(async () => {
      const aliceShares = await listOcsShares(aliceUser, "/apps/files_sharing/api/v1/shares", {
        path: fixtureFilePath
      });
      if (aliceShares.length > 0) return `alice-outgoing:${aliceShares.length}`;

      const bobShares = await listOcsShares(bobUser, "/apps/files_sharing/api/v1/remote_shares");
      if (bobShares.some(isFixtureShare)) return "bob-remote-share:present";

      const pendingBobShares = await listOcsShares(bobUser, "/apps/files_sharing/api/v1/remote_shares/pending");
      if (pendingBobShares.some(isFixtureShare)) return "bob-pending-share:present";

      const bobFile = await nextcloudFetch(bobUser, davFileUrl(bobUser, fixtureFileName), {
        method: "HEAD"
      });
      if (bobFile.ok) return "bob-file:present";
      if (bobFile.status !== 404) return `bob-file:${bobFile.status}`;

      const aliceFile = await nextcloudFetch(aliceUser, davFileUrl(aliceUser, fixtureFileName), {
        method: "HEAD"
      });
      return aliceFile.ok ? "ok" : `alice-file:${aliceFile.status}`;
    }, { message: "Federated share fixture should be clean before the journey", timeout: 30_000 })
    .toBe("ok");
}

async function listOcsShares(
  user: NextcloudUser,
  endpoint: string,
  params: Record<string, string> = {}
): Promise<OcsShare[]> {
  const response = await nextcloudFetch(user, ocsUrl(user, endpoint, params));
  await expectOk(response, `list OCS resource ${endpoint} for ${user.label}`);
  return ocsDataArray(response);
}

function isFixtureShare(share: OcsShare): boolean {
  return [share.name, share.file_target, share.mountpoint, share.path].some((value) =>
    String(value ?? "").includes(fixtureFileName)
  );
}

async function expectOk(response: Response, action: string): Promise<void> {
  if (response.ok) return;
  throw new Error(`${action} failed: ${response.status} ${response.statusText} ${await response.text()}`);
}
