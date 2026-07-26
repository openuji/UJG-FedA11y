import { test } from "@playwright/test";
import {
  aliceUser,
  bobUser,
  ensureFederatedShareFixtureIsClean,
  expectAcceptedFederatedShareHasMountedFile,
  federatedRecipient
} from "./nextcloud-test-helpers.js";
import { compileHappyPathPlan, loadFilesharingUjg } from "./ujg-resolver-2.js";
import {
  type HappyPathExecutionContext,
  type HappyPathRunMode,
  runHappyPathPlan
} from "./journeyRunner.js";

const document = loadFilesharingUjg();
const plan = compileHappyPathPlan(document);
const getContext = (mode: HappyPathRunMode): HappyPathExecutionContext => ({
  usersById: new Map([
    ["urn:user:alice", aliceUser],
    ["urn:user:bob", bobUser]
  ]),
  transitionValues: new Map([
    ["urn:transition:alice-enters-remote-bob", { text: federatedRecipient }]
  ]),
  effectHandlers: new Map([
    ["urn:effect:bob-accept-share", expectAcceptedFederatedShareHasMountedFile]
  ]),
  mode
});

test.beforeEach(async () => {
  await ensureFederatedShareFixtureIsClean();
});

const modes: HappyPathRunMode[] = ["keyboard-only", "standard"];

modes.forEach((mode) => {
  test(`federated sharing happy path is ${mode} accessible`, async ({
    browser
  }, testInfo) => {
    await runHappyPathPlan({
      plan,
      browser,
      testInfo,
      context: getContext(mode),
      audit: {
        reportId: `federated-sharing-${mode}.axe-path`,
        metadata: {
          documentId: document["@id"],
          testMode: mode
        },
        sourceScreenshots: {
          states: true,
          fullPage: true
        }
      }
    });
  });
});
