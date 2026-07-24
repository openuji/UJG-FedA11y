import { type Locator, type Page } from "@playwright/test";

import {
  type AccessibleFeature,
  type ResolvedAccessibleLocator,
  type ResolvedInputModalityProfile,
  type ResolvedObservationBinding,
  type ResolvedTransitionActivation
} from "./ujg-resolver.js";

type LocatorRoot = Page | Locator;

type FeatureAdapter = {
  featureName: string;
  apply(root: LocatorRoot, locator: Locator, feature: AccessibleFeature): Locator;
};

const featureAdapters: FeatureAdapter[] = [
  
];
const roleOptionFeatureNames = new Set(["expanded"]);

const keyboardTextEntryInputModalityId = "urn:input-modality:keyboard-text-entry";
const keyboardSpaceInputModalityId = "urn:input-modality:keyboard-space";
const keyboardEnterInputModalityId = "urn:input-modality:keyboard-enter";
const pointerInputModalityId = "urn:input-modality:pointer";

export type PlaywrightActivationMode = "keyboard-only" | "standard";

export type PlaywrightTransitionCommandId =
  | "pointer-click"
  | "keyboard-enter"
  | "keyboard-space"
  | "keyboard-text-entry";

export type PlaywrightTransitionCommand = {
  id: PlaywrightTransitionCommandId;
  eventId: string;
  inputModalityProfile: ResolvedInputModalityProfile;
};

export type PlaywrightTransitionValues = {
  text?: string;
};

export function selectTransitionActivationProfile(
  activation: ResolvedTransitionActivation,
  mode: PlaywrightActivationMode
): ResolvedInputModalityProfile {
  const profile =
    mode === "keyboard-only"
      ? profileWithAnyModality(activation, [
          keyboardTextEntryInputModalityId,
          keyboardEnterInputModalityId,
          keyboardSpaceInputModalityId
        ])
      : profileWithAnyModality(activation, [
          keyboardTextEntryInputModalityId,
          pointerInputModalityId
        ]);

  if (!profile) {
    throw new Error(`No ${mode} activation profile for ${activation.transitionId}`);
  }

  return profile;
}

export function toPlaywrightLocator(root: LocatorRoot, locator: ResolvedAccessibleLocator): Locator {
  const scopedRoot = locator.contexts.reduce(
    (currentRoot, context) => toPlaywrightLocator(currentRoot, context),
    root
  );
  const roleLocator = getRoleLocator(scopedRoot, locator);

  return locator.features.filter((feature) => !roleOptionFeatureNames.has(feature.name)).reduce(
    (currentLocator, feature) => applyFeature(scopedRoot, currentLocator, feature),
    roleLocator
  );
}

export function toPlaywrightObservationLocator(
  root: LocatorRoot,
  bindings: ResolvedObservationBinding[]
): Locator {
  if (bindings.length === 0) {
    throw new Error("Expected at least one ObservationBinding");
  }

  return bindings.map((binding) => toPlaywrightBindingLocator(root, binding)).reduce((a, b) => a.or(b));
}

export function resolveTransitionActivationCommand(
  activation: ResolvedTransitionActivation,
  profile: ResolvedInputModalityProfile
): PlaywrightTransitionCommand {
  const modality = requireSingleInputModality(activation, profile);

  switch (modality.id) {
    case pointerInputModalityId:
      return {
        id: "pointer-click",
        eventId: activation.eventId,
        inputModalityProfile: profile
      };
    case keyboardSpaceInputModalityId:
      return {
        id: "keyboard-space",
        eventId: activation.eventId,
        inputModalityProfile: profile
      };
    case keyboardEnterInputModalityId:
      return {
        id: "keyboard-enter",
        eventId: activation.eventId,
        inputModalityProfile: profile
      };
    case keyboardTextEntryInputModalityId:
      return {
        id: "keyboard-text-entry",
        eventId: activation.eventId,
        inputModalityProfile: profile
      };
    default:
      throw unsupportedActivationError(activation, profile);
  }
}

export async function activateResolvedTransition(
  locator: Locator,
  activation: ResolvedTransitionActivation,
  command: PlaywrightTransitionCommand,
  values: PlaywrightTransitionValues = {}
): Promise<void> {
  if (command.eventId !== activation.eventId) {
    throw new Error(
      `Transition command ${command.id} was resolved for ${command.eventId}, but ${activation.transitionId} uses ${activation.eventId}`
    );
  }

  switch (command.id) {
    case "pointer-click":
      await locator.click();
      return;
    case "keyboard-space":
      await locator.press("Space");
      return;
    case "keyboard-enter":
      await locator.press("Enter");
      return;
    case "keyboard-text-entry":
      await locator.pressSequentially(requiredTransitionValue(values.text, command));
      return;
    default:
      assertNever(command.id);
  }
}

function toPlaywrightBindingLocator(root: LocatorRoot, binding: ResolvedObservationBinding): Locator {
  if (binding.locators.length === 0) {
    throw new Error(`ObservationBinding ${binding.id} must define at least one locator`);
  }

  return binding.locators.map((locator) => toPlaywrightLocator(root, locator)).reduce((a, b) => a.and(b));
}

function getRoleLocator(root: LocatorRoot, locator: ResolvedAccessibleLocator): Locator {
  if (!locator.role) {
    throw new Error(`AccessibleLocator ${locator.id} does not declare a role`);
  }

  if (locator.accessibleDescription) {
    throw new Error(
      `AccessibleLocator ${locator.id} uses accessibleDescriptionRef, which this Playwright adapter does not yet support`
    );
  }

  return root.getByRole(locator.role as never, {
    name: locator.accessibleName ? accessibleNamePattern(locator.accessibleName) : undefined,
    expanded: expandedOption(locator)
  });
}

function applyFeature(root: LocatorRoot, locator: Locator, feature: AccessibleFeature): Locator {
  if (feature.value === "*") {
    return locator;
  }

  const adapter = featureAdapters.find((candidate) => candidate.featureName === feature.name);

  if (!adapter) {
    throw new Error(`No Playwright adapter for AccessibleFeature ${feature.name}`);
  }

  return adapter.apply(root, locator, feature);
}

function describeInputModalities(profile: ResolvedInputModalityProfile): string {
  if (profile.modalities.length === 0) {
    return "none";
  }

  return profile.modalities.map((modality) => modality.id).join(", ");
}

function profileWithAnyModality(
  activation: ResolvedTransitionActivation,
  modalityIds: string[]
): ResolvedInputModalityProfile | undefined {
  return modalityIds
    .map((modalityId) =>
      activation.requiredInputModalityProfiles.find((profile) =>
        profile.modalities.some((modality) => modality.id === modalityId)
      )
    )
    .find((profile): profile is ResolvedInputModalityProfile => profile !== undefined);
}

function requireSingleInputModality(
  activation: ResolvedTransitionActivation,
  profile: ResolvedInputModalityProfile
): ResolvedInputModalityProfile["modalities"][number] {
  if (profile.modalities.length !== 1) {
    throw unsupportedActivationError(activation, profile);
  }

  return profile.modalities[0];
}

function unsupportedActivationError(
  activation: ResolvedTransitionActivation,
  profile: ResolvedInputModalityProfile
): Error {
  return new Error(
    `Unsupported transition activation for ${activation.transitionId}: event ${activation.eventId}, InputModalityProfile ${profile.id}, modalities ${describeInputModalities(
      profile
    )}`
  );
}

function requiredTransitionValue(
  value: string | undefined,
  command: PlaywrightTransitionCommand
): string {
  if (!value) {
    throw new Error(`Transition command ${command.id} requires a text value`);
  }

  return value;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled transition command ${value}`);
}

function accessibleNamePattern(value: string): RegExp {
  return new RegExp(escapeRegExp(value), "i");
}

function expandedOption(locator: ResolvedAccessibleLocator): boolean | undefined {
  const features = locator.features.filter((feature) => feature.name === "expanded");
  if (features.length === 0) return undefined;
  if (features.length > 1) throw new Error(`AccessibleLocator ${locator.id} repeats expanded`);

  if (features[0].value === "true") return true;
  if (features[0].value === "false") return false;
  throw new Error(`AccessibleLocator ${locator.id} has invalid expanded value ${features[0].value}`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
