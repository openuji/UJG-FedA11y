import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

const envPath = resolve(import.meta.dirname, "../../infrastructure/nextcloud-federation/.env");

loadEnv({ path: envPath, quiet: true });

const requiredEnv = [
  "NEXTCLOUD_ALICE_URL",
  "NEXTCLOUD_ALICE_USER",
  "NEXTCLOUD_ALICE_PASSWORD",
  "NEXTCLOUD_BOB_URL",
  "NEXTCLOUD_BOB_USER",
  "NEXTCLOUD_BOB_PASSWORD"
] as const;

const missingEnv = requiredEnv.filter((name) => !process.env[name]);

if (missingEnv.length > 0) {
  throw new Error(
    `Missing required federation test environment values in ${envPath}: ${missingEnv.join(", ")}`
  );
}

export default defineConfig({
  testDir: ".",
  testMatch: ["**/*.spec.ts"],
  fullyParallel: false,
  reporter: [["list"]],
  timeout: 60_000,
  expect: {
    timeout: 15_000
  },
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"]
      }
    }
  ]
});
