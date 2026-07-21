import { type Locator, type Page } from "@playwright/test";

import { type AccessibleFeature, type ResolvedAccessibleLocator } from "./ujg-resolver.js";

type LocatorRoot = Page | Locator;

type FeatureAdapter = {
  featureName: string;
  apply(root: LocatorRoot, locator: Locator, feature: AccessibleFeature): Locator;
};

const featureAdapters: FeatureAdapter[] = [
  {
    featureName: "file-id",
    apply(root, locator, feature) {
      return feature.value === "*"
        ? locator.and(root.locator(fileIdSelector()))
        : locator.and(root.locator(fileIdSelector(feature.value)));
    }
  }
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

function fileIdSelector(value?: string): string {
  // Bridges the logical UJG file-id feature to the concrete attributes Nextcloud exposes on file rows.
  const attributes = [
    "data-cy-files-list-row-fileid",
    "data-id",
    "data-fileid",
    "data-file-id"
  ];

  return attributes.map((attribute) => attributeSelector(attribute, value)).join(", ");
}

function attributeSelector(attribute: string, value?: string): string {
  return value === undefined ? `[${attribute}]` : `[${attribute}="${cssString(value)}"]`;
}

function cssString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function accessibleNamePattern(value: string): RegExp {
  return new RegExp(escapeRegExp(value), "i");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
