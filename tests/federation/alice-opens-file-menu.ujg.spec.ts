import {
  axeFailureMessage,
  runAxeAudit,
  shouldFailForAxeViolations
} from "@ujg-fed-a11y/playwright-axe-audit";
import { expect, test } from "@playwright/test";

import {
  aliceUser,
  federatedRecipient,
  logIn,
  openFilesApp
} from "./nextcloud-test-helpers.js";
import {
  activateResolvedTransition,
  resolveTransitionActivationCommand,
  toPlaywrightObservationLocator,
  type PlaywrightTransitionCommand
} from "./playwright-ujg-locator.js";
import {
  describeResolvedObservation,
  describeResolvedTransitionActivation,
  loadFilesharingUjg,
  resolveStatePresenceTarget,
  resolveTransitionActivationTarget,
  type ResolvedInputModalityProfile,
  type ResolvedStatePresenceTarget,
  type ResolvedTransitionActivation,
  type ResolvedTransitionActivationTarget
} from "./ujg-resolver.js";

const aliceFilesReadyStateId = "urn:state:alice-files-ready";
const aliceOpensFileMenuTransitionId = "urn:transition:alice-opens-file-menu";
const aliceSharePanelOpenStateId = "urn:state:alice-share-panel-open";
const aliceEntersRemoteBobTransitionId = "urn:transition:alice-enters-remote-bob";
const aliceRemoteRecipientEnteredStateId = "urn:state:alice-remote-recipient-entered";
const textEntryActivationObservationEventId = "urn:observation-event:text-entry-activation";
const keyboardTextEntryInputModalityProfileId =
  "urn:input-modality-profile:keyboard-text-entry";

const openFileMenuInputModalityProfiles = resolveTransitionActivationTarget(
  loadFilesharingUjg(),
  aliceOpensFileMenuTransitionId
).activation.requiredInputModalityProfiles;

if (openFileMenuInputModalityProfiles.length === 0) {
  throw new Error(
    `Transition ${aliceOpensFileMenuTransitionId} must declare at least one required input modality profile`
  );
}

for (const openFileMenuInputModalityProfile of openFileMenuInputModalityProfiles) {
  test(`follows Alice's first UJG transitions with ${
    openFileMenuInputModalityProfile.label ?? openFileMenuInputModalityProfile.id
  }`, async ({ page }, testInfo) => {
    const document = loadFilesharingUjg();
    const filesReady = resolveStatePresenceTarget(document, aliceFilesReadyStateId);
    const openFileMenuTransition = resolveTransitionActivationTarget(
      document,
      aliceOpensFileMenuTransitionId
    );
    const sharePanelOpen = resolveStatePresenceTarget(document, aliceSharePanelOpenStateId);
    const enterRemoteBobTransition = resolveTransitionActivationTarget(
      document,
      aliceEntersRemoteBobTransitionId,
      textEntryActivationObservationEventId
    );
    const remoteRecipientEntered = resolveStatePresenceTarget(
      document,
      aliceRemoteRecipientEnteredStateId
    );
    const activeOpenFileMenuInputModalityProfile = requireInputModalityProfile(
      openFileMenuTransition.activation.requiredInputModalityProfiles,
      openFileMenuInputModalityProfile.id
    );
    const activeEnterRemoteBobInputModalityProfile = requireInputModalityProfile(
      enterRemoteBobTransition.activation.requiredInputModalityProfiles,
      keyboardTextEntryInputModalityProfileId
    );
    const openFileMenuCommand = resolveTransitionActivationCommand(
      openFileMenuTransition.activation,
      activeOpenFileMenuInputModalityProfile
    );
    const enterRemoteBobCommand = resolveTransitionActivationCommand(
      enterRemoteBobTransition.activation,
      activeEnterRemoteBobInputModalityProfile
    );

    expect(openFileMenuTransition.activation.fromStateId).toBe(filesReady.observation.stateId);
    expect(openFileMenuTransition.activation.toStateId).toBe(sharePanelOpen.observation.stateId);
    expect(enterRemoteBobTransition.activation.fromStateId).toBe(
      sharePanelOpen.observation.stateId
    );
    expect(enterRemoteBobTransition.activation.toStateId).toBe(
      remoteRecipientEntered.observation.stateId
    );

    testInfo.annotations.push(
      {
        type: "ujg-source-resolution",
        description: describeResolvedObservation(filesReady.observation)
      },
      {
        type: "ujg-open-file-menu-transition-resolution",
        description: describeResolvedTransitionActivation(openFileMenuTransition.activation)
      },
      {
        type: "ujg-share-panel-open-resolution",
        description: describeResolvedObservation(sharePanelOpen.observation)
      },
      {
        type: "ujg-enter-remote-bob-transition-resolution",
        description: describeResolvedTransitionActivation(enterRemoteBobTransition.activation)
      },
      {
        type: "ujg-remote-recipient-entered-resolution",
        description: describeResolvedObservation(remoteRecipientEntered.observation)
      }
    );

    await logIn(page, aliceUser);
    await openFilesApp(page, aliceUser);

    const filesReadyLocator = toPlaywrightObservationLocator(page, filesReady.bindings);
    await expect(filesReadyLocator).toHaveCount(1);
    await expect(filesReadyLocator).toBeVisible();

    const openFileMenuLocator = toPlaywrightObservationLocator(page, openFileMenuTransition.bindings);
    await expect(openFileMenuLocator).toHaveCount(1);
    await expect(openFileMenuLocator).toBeVisible();

    const openFileMenuAxeReport = await runAxeAudit({
      page,
      testInfo,
      resolvedLocator: openFileMenuLocator,
      auditId: `alice-opens-file-menu-${activationAuditSegment(
        openFileMenuTransition.activation,
        openFileMenuCommand
      )}`,
      metadata: axeMetadataForTransition(openFileMenuTransition, openFileMenuCommand)
    });

    expect(
      shouldFailForAxeViolations(openFileMenuAxeReport),
      axeFailureMessage(openFileMenuAxeReport)
    ).toBe(false);

    await activateResolvedTransition(
      openFileMenuLocator,
      openFileMenuTransition.activation,
      openFileMenuCommand
    );

    const sharePanelOpenLocator = toPlaywrightObservationLocator(page, sharePanelOpen.bindings);
    await expect(sharePanelOpenLocator).toHaveCount(1);
    await expect(sharePanelOpenLocator).toBeVisible();

    const sharePanelOpenAxeReport = await runAxeAudit({
      page,
      testInfo,
      resolvedLocator: sharePanelOpenLocator,
      auditId: `alice-share-panel-open-${activationAuditSegment(
        openFileMenuTransition.activation,
        openFileMenuCommand
      )}`,
      metadata: axeMetadataForState(sharePanelOpen, openFileMenuCommand)
    });

    expect(
      shouldFailForAxeViolations(sharePanelOpenAxeReport),
      axeFailureMessage(sharePanelOpenAxeReport)
    ).toBe(false);

    const enterRemoteBobLocator = toPlaywrightObservationLocator(
      page,
      enterRemoteBobTransition.bindings
    );
    await expect(enterRemoteBobLocator).toHaveCount(1);
    await expect(enterRemoteBobLocator).toBeVisible();

    const enterRemoteBobAxeReport = await runAxeAudit({
      page,
      testInfo,
      resolvedLocator: enterRemoteBobLocator,
      auditId: `alice-enters-remote-bob-${activationAuditSegment(
        enterRemoteBobTransition.activation,
        enterRemoteBobCommand
      )}`,
      metadata: axeMetadataForTransition(enterRemoteBobTransition, enterRemoteBobCommand)
    });

    expect(
      shouldFailForAxeViolations(enterRemoteBobAxeReport),
      axeFailureMessage(enterRemoteBobAxeReport)
    ).toBe(false);

    await activateResolvedTransition(
      enterRemoteBobLocator,
      enterRemoteBobTransition.activation,
      enterRemoteBobCommand,
      { federatedRecipient }
    );

    const remoteRecipientEnteredLocator = toPlaywrightObservationLocator(
      page,
      remoteRecipientEntered.bindings
    );
    await expect(remoteRecipientEnteredLocator).toHaveCount(1);
    await expect(remoteRecipientEnteredLocator).toBeVisible();

    const remoteRecipientEnteredAxeReport = await runAxeAudit({
      page,
      testInfo,
      resolvedLocator: remoteRecipientEnteredLocator,
      auditId: `alice-remote-recipient-entered-${activationAuditSegment(
        enterRemoteBobTransition.activation,
        enterRemoteBobCommand
      )}`,
      metadata: axeMetadataForState(remoteRecipientEntered, enterRemoteBobCommand)
    });

    expect(
      shouldFailForAxeViolations(remoteRecipientEnteredAxeReport),
      axeFailureMessage(remoteRecipientEnteredAxeReport)
    ).toBe(false);
  });
}

function axeMetadataForState(
  target: ResolvedStatePresenceTarget,
  command: PlaywrightTransitionCommand
) {
  return {
    ujg: {
      stateId: target.observation.stateId,
      ...(target.observation.stateLabel ? { stateLabel: target.observation.stateLabel } : {}),
      surfaceId: target.observation.surfaceId,
      ...(target.observation.surfaceLabel ? { surfaceLabel: target.observation.surfaceLabel } : {}),
      eventId: command.eventId,
      ...commandMetadata(command),
      bindings: bindingsMetadata(target.bindings)
    }
  };
}

function axeMetadataForTransition(
  target: ResolvedTransitionActivationTarget,
  command: PlaywrightTransitionCommand
) {
  return {
    ujg: {
      transitionId: target.activation.transitionId,
      ...(target.activation.transitionLabel
        ? { transitionLabel: target.activation.transitionLabel }
        : {}),
      eventId: target.activation.eventId,
      ...(target.activation.eventLabel ? { eventLabel: target.activation.eventLabel } : {}),
      fromStateId: target.activation.fromStateId,
      toStateId: target.activation.toStateId,
      surfaceId: target.activation.surfaceId,
      ...(target.activation.surfaceLabel ? { surfaceLabel: target.activation.surfaceLabel } : {}),
      ...commandMetadata(command),
      bindings: bindingsMetadata(target.bindings)
    }
  };
}

function commandMetadata(command: PlaywrightTransitionCommand) {
  return {
    adapterCommandId: command.id,
    ...inputModalityProfileMetadata(command.inputModalityProfile)
  };
}

function bindingsMetadata(bindings: ResolvedStatePresenceTarget["bindings"]) {
  return bindings.map((binding) => ({
    bindingId: binding.id,
    eventId: binding.eventId,
    ...(binding.eventLabel ? { eventLabel: binding.eventLabel } : {}),
    requiredInputModalityProfiles: binding.requiredInputModalityProfiles.map(
      inputModalityProfileMetadata
    ),
    locators: binding.locators.map((locator) => ({
      locatorId: locator.id,
      ...(locator.role ? { role: locator.role } : {}),
      ...(locator.accessibleName ? { accessibleName: locator.accessibleName } : {}),
      features: locator.features.map((feature) => ({
        featureId: feature.id,
        featureName: feature.name,
        featureValue: feature.value
      }))
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

function activationAuditSegment(
  activation: ResolvedTransitionActivation,
  command: PlaywrightTransitionCommand
): string {
  return [
    auditSegment(activation.eventId),
    auditSegment(command.inputModalityProfile.id),
    auditSegment(command.id)
  ].join("-");
}

function auditSegment(value: string): string {
  return value
    .replace(/^urn:/, "")
    .replace(/[^a-z0-9-]+/gi, "-")
    .toLowerCase();
}
