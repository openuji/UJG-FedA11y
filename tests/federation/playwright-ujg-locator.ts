import { type Locator, type Page } from "@playwright/test";

import {
  type AccessibleFeature,
  type ResolvedAccessibleLocator,
  type ResolvedObservationBinding
} from "./ujg-resolver.js";

type LocatorRoot = Page | Locator;

type FeatureAdapter = {
  featureName: string;
  apply(root: LocatorRoot, locator: Locator, feature: AccessibleFeature): Locator;
};

const featureAdapters: FeatureAdapter[] = [
  
];

export function toPlaywrightLocator(root: LocatorRoot, locator: ResolvedAccessibleLocator): Locator {
  const scopedRoot = locator.contexts.reduce(
    (currentRoot, context) => toPlaywrightLocator(currentRoot, context),
    root
  );
  const roleLocator = getRoleLocator(scopedRoot, locator);

  return locator.features.reduce(
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
    name: locator.accessibleName ? accessibleNamePattern(locator.accessibleName) : undefined
  });
}

function applyFeature(root: LocatorRoot, locator: Locator, feature: AccessibleFeature): Locator {
  const adapter = featureAdapters.find((candidate) => candidate.featureName === feature.name);

  if (!adapter) {
    throw new Error(`No Playwright adapter for AccessibleFeature ${feature.name}`);
  }

  return adapter.apply(root, locator, feature);
}



function accessibleNamePattern(value: string): RegExp {
  return new RegExp(escapeRegExp(value), "i");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
