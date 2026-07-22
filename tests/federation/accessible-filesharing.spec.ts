import { expect, test } from "@playwright/test";
import { compileHappyPathPlan, loadFilesharingUjg } from "./ujg-resolver-2.js";
import {runHappyPathPlan} from './journeyRunner.js'

const document = loadFilesharingUjg();
const plan = compileHappyPathPlan(document);

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
      testInfo
    });
  } finally {
    //await runtime.dispose();
  }
});