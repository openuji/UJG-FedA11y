import {
  axeFailureMessage,
  runAxeAudit,
  shouldFailForAxeViolations
} from "@ujg-fed-a11y/playwright-axe-audit";
import { expect, test } from "@playwright/test";

import { aliceUser, logIn, openFilesApp } from "./nextcloud-test-helpers.js";
import {
  activateWithInputModalityProfile,
  toPlaywrightObservationLocator
} from "./playwright-ujg-locator.js";
import {
  describeResolvedObservation,
  describeResolvedTransitionActivation,
  loadFilesharingUjg,
  resolveStatePresenceTarget,
  resolveTransitionActivationTarget,
  type ResolvedInputModalityProfile,
  type ResolvedStatePresenceTarget,
  type ResolvedTransitionActivationTarget
} from "./ujg-resolver.js";

const aliceFilesReadyStateId = "urn:state:alice-files-ready";
const aliceOpensFileMenuTransitionId = "urn:transition:alice-opens-file-menu";
const aliceSharePanelOpenStateId = "urn:state:alice-share-panel-open";

const inputModalityProfiles = resolveTransitionActivationTarget(
  loadFilesharingUjg(),
  aliceOpensFileMenuTransitionId
).activation.requiredInputModalityProfiles;

if (inputModalityProfiles.length === 0) {
  throw new Error(
    `Transition ${aliceOpensFileMenuTransitionId} must declare at least one required input modality profile`
  );
}

for (const inputModalityProfile of inputModalityProfiles) {
  test(`follows Alice's first UJG transition with ${inputModalityProfile.label ?? inputModalityProfile.id}`, async ({
    page
  }, testInfo) => {
    const document = loadFilesharingUjg();
    const source = resolveStatePresenceTarget(document, aliceFilesReadyStateId);
    const transition = resolveTransitionActivationTarget(document, aliceOpensFileMenuTransitionId);
    const target = resolveStatePresenceTarget(document, aliceSharePanelOpenStateId);
    const activeInputModalityProfile = requireInputModalityProfile(
      transition.activation.requiredInputModalityProfiles,
      inputModalityProfile.id
    );

    expect(transition.activation.fromStateId).toBe(source.observation.stateId);
    expect(transition.activation.toStateId).toBe(target.observation.stateId);

    testInfo.annotations.push(
      {
        type: "ujg-source-resolution",
        description: describeResolvedObservation(source.observation)
      },
      {
        type: "ujg-transition-resolution",
        description: describeResolvedTransitionActivation(transition.activation)
      },
      {
        type: "ujg-target-resolution",
        description: describeResolvedObservation(target.observation)
      }
    );

    await logIn(page, aliceUser);
    await openFilesApp(page, aliceUser);

    const sourceLocator = toPlaywrightObservationLocator(page, source.bindings);
    await expect(sourceLocator).toHaveCount(1);
    await expect(sourceLocator).toBeVisible();

    const transitionLocator = toPlaywrightObservationLocator(page, transition.bindings);
    await expect(transitionLocator).toHaveCount(1);
    await expect(transitionLocator).toBeVisible();

    const transitionAxeReport = await runAxeAudit({
      page,
      testInfo,
      resolvedLocator: transitionLocator,
      auditId: `alice-opens-file-menu-${inputModalityProfileAuditSegment(
        activeInputModalityProfile
      )}`,
      metadata: axeMetadataForTransition(transition, activeInputModalityProfile)
    });

    expect(
      shouldFailForAxeViolations(transitionAxeReport),
      axeFailureMessage(transitionAxeReport)
    ).toBe(false);

    await activateWithInputModalityProfile(transitionLocator, activeInputModalityProfile);

    const targetLocator = toPlaywrightObservationLocator(page, target.bindings);
    await expect(targetLocator).toHaveCount(1);
    await expect(targetLocator).toBeVisible();

    const targetAxeReport = await runAxeAudit({
      page,
      testInfo,
      resolvedLocator: targetLocator,
      auditId: `alice-share-panel-open-${inputModalityProfileAuditSegment(
        activeInputModalityProfile
      )}`,
      metadata: axeMetadataForState(target, activeInputModalityProfile)
    });

    expect(
      shouldFailForAxeViolations(targetAxeReport),
      axeFailureMessage(targetAxeReport)
    ).toBe(false);
  });
}

function axeMetadataForState(
  target: ResolvedStatePresenceTarget,
  inputModalityProfile: ResolvedInputModalityProfile
) {
  return {
    ujg: {
      stateId: target.observation.stateId,
      ...(target.observation.stateLabel ? { stateLabel: target.observation.stateLabel } : {}),
      surfaceId: target.observation.surfaceId,
      ...(target.observation.surfaceLabel ? { surfaceLabel: target.observation.surfaceLabel } : {}),
      ...inputModalityProfileMetadata(inputModalityProfile),
      bindings: bindingsMetadata(target.bindings)
    }
  };
}

function axeMetadataForTransition(
  target: ResolvedTransitionActivationTarget,
  inputModalityProfile: ResolvedInputModalityProfile
) {
  return {
    ujg: {
      transitionId: target.activation.transitionId,
      ...(target.activation.transitionLabel
        ? { transitionLabel: target.activation.transitionLabel }
        : {}),
      fromStateId: target.activation.fromStateId,
      toStateId: target.activation.toStateId,
      surfaceId: target.activation.surfaceId,
      ...(target.activation.surfaceLabel ? { surfaceLabel: target.activation.surfaceLabel } : {}),
      ...inputModalityProfileMetadata(inputModalityProfile),
      bindings: bindingsMetadata(target.bindings)
    }
  };
}

function bindingsMetadata(bindings: ResolvedStatePresenceTarget["bindings"]) {
  return bindings.map((binding) => ({
    bindingId: binding.id,
    requiredInputModalityProfiles: binding.requiredInputModalityProfiles.map(
      inputModalityProfileMetadata
    ),
    locators: binding.locators.map((locator) => ({
      locatorId: locator.id,
      ...(locator.role ? { role: locator.role } : {}),
      ...(locator.accessibleName ? { accessibleName: locator.accessibleName } : {})
    }))
  }));
}

function inputModalityProfileMetadata(profile: ResolvedInputModalityProfile) {
  return {
    inputModalityProfileId: profile.id,
    ...(profile.label ? { inputModalityProfileLabel: profile.label } : {}),
    inputModalityIds: profile.modalities.map((modality) => modality.id)
  };
}

function requireInputModalityProfile(
  profiles: ResolvedInputModalityProfile[],
  profileId: string
): ResolvedInputModalityProfile {
  const profile = profiles.find((candidate) => candidate.id === profileId);

  if (!profile) {
    throw new Error(`Missing resolved InputModalityProfile ${profileId}`);
  }

  return profile;
}

function inputModalityProfileAuditSegment(profile: ResolvedInputModalityProfile): string {
  return profile.id
    .replace(/^urn:input-modality-profile:/, "")
    .replace(/[^a-z0-9-]+/gi, "-")
    .toLowerCase();
}
