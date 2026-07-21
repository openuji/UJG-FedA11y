import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type UjgNode = {
  "@id": string;
  "@type": string | string[];
  label?: string;
  [key: string]: unknown;
};

export type UjgDocument = {
  "@id": string;
  "@type": string;
  nodes: UjgNode[];
};

export type AccessibleFeature = {
  id: string;
  name: string;
  value: string;
};

export type ResolvedAccessibleLocator = {
  id: string;
  label?: string;
  role?: string;
  accessibleName?: string;
  accessibleDescription?: string;
  features: AccessibleFeature[];
  contexts: ResolvedAccessibleLocator[];
};

export type ResolvedObservationBinding = {
  id: string;
  label?: string;
  surfaceId: string;
  eventId: string;
  eventLabel?: string;
  locators: ResolvedAccessibleLocator[];
  surfaceInstanceResolver?: ResolvedSurfaceInstanceResolver;
};

export type ResolvedStateObservation = {
  stateId: string;
  stateLabel?: string;
  surfaceId: string;
  surfaceLabel?: string;
  bindings: ResolvedObservationBinding[];
};

export type ResolvedStatePresenceTarget = {
  observation: ResolvedStateObservation;
  bindings: ResolvedObservationBinding[];
};

type ResolvedSurfaceInstanceResolver = {
  id: string;
  label?: string;
  instanceKeyFeature: AccessibleFeature;
};

type NodeIndex = Map<string, UjgNode>;

const presenceObservationEventId = "urn:observation-event:presence";

const ujgPath = resolve(
  import.meta.dirname,
  "../../apps/web/src/assets/ujg/filesharing.ujg.jsonld"
);

export function loadFilesharingUjg(): UjgDocument {
  return parseUjgDocument(readFileSync(ujgPath, "utf8"));
}

export function parseUjgDocument(source: string): UjgDocument {
  const parsed = JSON.parse(source) as UjgDocument;

  if (!Array.isArray(parsed.nodes)) {
    throw new Error("UJG document must contain a top-level nodes array");
  }

  return parsed;
}

export function resolveStatePresenceObservation(
  document: UjgDocument,
  stateId: string
): ResolvedStateObservation {
  const index = indexNodes(document);
  const state = requireNode(index, stateId, "State");
  const surface = requireSingleSurfaceForGraphNode(document.nodes, stateId);
  const bindings = observationBindingsForSurface(document.nodes, surface["@id"])
    .filter((binding) => isPresenceBinding(index, binding))
    .map((binding) => resolveObservationBinding(index, binding));

  if (bindings.length === 0) {
    throw new Error(`No presence ObservationBinding found for surface ${surface["@id"]}`);
  }

  return {
    stateId: state["@id"],
    stateLabel: optionalString(state.label),
    surfaceId: surface["@id"],
    surfaceLabel: optionalString(surface.label),
    bindings
  };
}

export function resolveStatePresenceTarget(
  document: UjgDocument,
  stateId: string
): ResolvedStatePresenceTarget {
  const observation = resolveStatePresenceObservation(document, stateId);

  return {
    observation,
    bindings: observation.bindings
  };
}

export function describeResolvedObservation(observation: ResolvedStateObservation): string {
  const bindingLines = observation.bindings.map(describeBinding).join("\n");

  return [
    `State: ${observation.stateId} (${observation.stateLabel ?? "unlabeled"})`,
    `Surface: ${observation.surfaceId} (${observation.surfaceLabel ?? "unlabeled"})`,
    bindingLines
  ].join("\n");
}

function describeBinding(binding: ResolvedObservationBinding): string {
  const locators = binding.locators.map((locator) => `    - ${describeLocator(locator)}`).join("\n");
  const resolver = binding.surfaceInstanceResolver
    ? `\n  Resolver: ${binding.surfaceInstanceResolver.id} via ${describeFeature(
        binding.surfaceInstanceResolver.instanceKeyFeature
      )}`
    : "";

  return [
    `Binding: ${binding.id} (${binding.label ?? "unlabeled"})`,
    `  Event: ${binding.eventId} (${binding.eventLabel ?? "unlabeled"})`,
    `  Locators:`,
    locators,
    resolver
  ].join("\n");
}

function describeLocator(locator: ResolvedAccessibleLocator): string {
  const name = locator.accessibleName ? ` name="${locator.accessibleName}"` : "";
  const features = locator.features.map(describeFeature).join(", ");
  const featureSummary = features ? ` features=[${features}]` : "";

  return `${locator.id} role=${locator.role ?? "unspecified"}${name}${featureSummary}`;
}

function describeFeature(feature: AccessibleFeature): string {
  return `${feature.name}=${feature.value}`;
}

function indexNodes(document: UjgDocument): NodeIndex {
  return new Map(document.nodes.map((node) => [node["@id"], node]));
}

function requireNode(index: NodeIndex, id: string, type: string): UjgNode {
  const node = index.get(id);

  if (!node) {
    throw new Error(`Missing UJG node ${id}`);
  }

  if (!hasType(node, type)) {
    throw new Error(`Expected ${id} to be ${type}, got ${typeList(node).join(", ")}`);
  }

  return node;
}

function requireSingleSurfaceForGraphNode(nodes: UjgNode[], graphNodeRef: string): UjgNode {
  const surfaces = nodes.filter(
    (node) => hasType(node, "Surface") && node.graphNodeRef === graphNodeRef
  );

  if (surfaces.length !== 1) {
    throw new Error(`Expected one Surface for ${graphNodeRef}, found ${surfaces.length}`);
  }

  return surfaces[0];
}

function observationBindingsForSurface(nodes: UjgNode[], surfaceId: string): UjgNode[] {
  return nodes.filter(
    (node) => hasType(node, "ObservationBinding") && node.observeSurfaceRef === surfaceId
  );
}

function isPresenceBinding(index: NodeIndex, binding: UjgNode): boolean {
  const eventId = requiredString(binding.observationEventRef, `${binding["@id"]}.observationEventRef`);

  if (eventId !== presenceObservationEventId) {
    return false;
  }

  requireNode(index, eventId, "ObservationEvent");

  return true;
}

function resolveObservationBinding(index: NodeIndex, binding: UjgNode): ResolvedObservationBinding {
  const eventId = requiredString(binding.observationEventRef, `${binding["@id"]}.observationEventRef`);
  const event = requireNode(index, eventId, "ObservationEvent");
  const locatorRefs = requiredStringArray(binding.locatorRefs, `${binding["@id"]}.locatorRefs`);

  return {
    id: binding["@id"],
    label: optionalString(binding.label),
    surfaceId: requiredString(binding.observeSurfaceRef, `${binding["@id"]}.observeSurfaceRef`),
    eventId,
    eventLabel: optionalString(event.label),
    locators: locatorRefs.map((locatorRef) => resolveAccessibleLocator(index, locatorRef)),
    surfaceInstanceResolver: resolveSurfaceInstanceResolver(index, binding.surfaceInstanceResolverRef)
  };
}

function resolveAccessibleLocator(index: NodeIndex, locatorId: string): ResolvedAccessibleLocator {
  const locator = requireNode(index, locatorId, "AccessibleLocator");
  const featureRefs = optionalStringArray(locator.accessibleFeatureRefs);
  const contextRefs = optionalStringArray(locator.contextLocatorRefs);

  return {
    id: locator["@id"],
    label: optionalString(locator.label),
    role: optionalString(locator.role),
    accessibleName: resolveMessage(index, locator.accessibleNameRef),
    accessibleDescription: resolveMessage(index, locator.accessibleDescriptionRef),
    features: featureRefs.map((featureRef) => resolveAccessibleFeature(index, featureRef)),
    contexts: contextRefs.map((contextRef) => resolveAccessibleLocator(index, contextRef))
  };
}

function resolveSurfaceInstanceResolver(
  index: NodeIndex,
  resolverRef: unknown
): ResolvedSurfaceInstanceResolver | undefined {
  if (resolverRef === undefined) {
    return undefined;
  }

  const resolverId = requiredString(resolverRef, "surfaceInstanceResolverRef");
  const resolver = requireNode(index, resolverId, "SurfaceInstanceResolver");
  const featureRef = requiredString(
    resolver.instanceKeyFeatureRef,
    `${resolverId}.instanceKeyFeatureRef`
  );

  return {
    id: resolver["@id"],
    label: optionalString(resolver.label),
    instanceKeyFeature: resolveAccessibleFeature(index, featureRef)
  };
}

function resolveAccessibleFeature(index: NodeIndex, featureId: string): AccessibleFeature {
  const feature = requireNode(index, featureId, "AccessibleFeature");

  return {
    id: feature["@id"],
    name: requiredString(feature.accessibleFeatureName, `${featureId}.accessibleFeatureName`),
    value: requiredString(feature.accessibleFeatureValue, `${featureId}.accessibleFeatureValue`)
  };
}

function resolveMessage(index: NodeIndex, messageRef: unknown): string | undefined {
  if (messageRef === undefined) {
    return undefined;
  }

  const messageId = requiredString(messageRef, "messageRef");
  const bundle = requireNode(index, messageId, "MessageBundle");
  const defaultLocale = requiredString(bundle.defaultLocale, `${messageId}.defaultLocale`);
  const locales = requiredRecord(bundle.locales, `${messageId}.locales`);
  const locale = requiredRecord(locales[defaultLocale], `${messageId}.locales.${defaultLocale}`);

  return requiredString(locale.value, `${messageId}.locales.${defaultLocale}.value`);
}

function hasType(node: UjgNode, type: string): boolean {
  return typeList(node).includes(type);
}

function typeList(node: UjgNode): string[] {
  return Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function optionalStringArray(value: unknown): string[] {
  if (value === undefined) {
    return [];
  }

  return requiredStringArray(value, "string array");
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`Expected ${label} to be a string`);
  }

  return value;
}

function requiredStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Expected ${label} to be a string array`);
  }

  return value;
}

function requiredRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Expected ${label} to be an object`);
  }

  return value as Record<string, unknown>;
}
