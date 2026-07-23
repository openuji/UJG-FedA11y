import { expect, test } from "@playwright/test";
import {
  ensureFederatedShareFixtureIsClean,
  expectAcceptedFederatedShareHasMountedFile
} from "./nextcloud-test-helpers.js";
import { compileHappyPathPlan, loadFilesharingUjg } from "./ujg-resolver-2.js";
import { runHappyPathPlan } from "./journeyRunner.js";

const document = loadFilesharingUjg();
const plan = compileHappyPathPlan(document);

test.beforeEach(async () => {
  await ensureFederatedShareFixtureIsClean();
});

test("federated sharing happy path is keyboard accessible", async ({
  browser
}, testInfo) => {
//   const runtime = await createNextcloudFederationRuntime({
//     browser,
//     testInfo,
//     runtimeData: federatedSharingRuntimeData
//   });

  try {
    await runHappyPathPlan({
      plan,
      browser,
      testInfo
    });
    await expectAcceptedFederatedShareHasMountedFile();
  } finally {
    //await runtime.dispose();
  }
});
