import {
  type AxeAuditMetadata,
  type AxeAuditReport,
  type AxePathAuditItemInput
} from "@ujg-fed-a11y/playwright-axe-audit";

import { type ResolvedObservationBinding } from "./ujg-resolver.js";
import { type HappyPathPlanItem } from "./ujg-resolver-2.js";

export type AxeJourneyPlanItem = {
  auditId: string;
  itemId: string;
  groupId: string;
  groupLabel: string;
  metadata: AxeAuditMetadata;
};

export function createAxeJourneyPlanItem(
  mode: string,
  itemIndex: number,
  item: HappyPathPlanItem
): AxeJourneyPlanItem {
  const graphNodeId = graphNodeIdForPlanItem(item);
  const itemId = `${mode}-${String(itemIndex).padStart(3, "0")}-${graphNodeSlug(graphNodeId)}`;

  return {
    auditId: itemId,
    itemId,
    groupId: item.stepId,
    groupLabel: item.stepId,
    metadata: metadataForPlanItem(mode, itemIndex, graphNodeId, item)
  };
}

export function auditedAxePathItem(
  journeyItem: AxeJourneyPlanItem,
  report: AxeAuditReport
): AxePathAuditItemInput {
  return {
    itemId: journeyItem.itemId,
    groupId: journeyItem.groupId,
    groupLabel: journeyItem.groupLabel,
    metadata: journeyItem.metadata,
    report
  };
}

export function unauditedAxePathItem(
  journeyItem: AxeJourneyPlanItem,
  status: "skipped" | "not-applicable",
  reason: string
): AxePathAuditItemInput {
  return {
    itemId: journeyItem.itemId,
    groupId: journeyItem.groupId,
    groupLabel: journeyItem.groupLabel,
    metadata: journeyItem.metadata,
    status,
    reason
  };
}

function metadataForPlanItem(
  mode: string,
  itemIndex: number,
  graphNodeId: string,
  item: HappyPathPlanItem
): AxeAuditMetadata {
  const metadata: AxeAuditMetadata = {
    mode,
    itemIndex,
    kind: item.kind,
    graphNodeId,
    userId: item.userId,
    touchpointId: item.touchpointId,
    phaseId: item.phaseId,
    stepId: item.stepId,
    entryId: item.entryId
  };

  addOptional(metadata, "entryBindingValue", item.entryBindingValue);

  if (item.kind === "state") {
    const observation = item.target.observation;

    metadata.stateId = observation.stateId;
    metadata.surfaceId = observation.surfaceId;
    metadata.expectedMatchCount = item.target.expectedMatchCount;
    metadata.bindingIds = item.target.bindings.map((binding) => binding.id);
    metadata.locatorIds = locatorIds(item.target.bindings);
    metadata.bindings = item.target.bindings.map(bindingMetadata);
    addOptional(metadata, "stateLabel", observation.stateLabel);
    addOptional(metadata, "surfaceLabel", observation.surfaceLabel);
    addUniqueEventMetadata(metadata, item.target.bindings.map((binding) => binding.eventId));
    return metadata;
  }

  if (item.kind === "transition") {
    const activation = item.target.activation;

    metadata.transitionId = activation.transitionId;
    metadata.fromStateId = activation.fromStateId;
    metadata.toStateId = activation.toStateId;
    metadata.surfaceId = activation.surfaceId;
    metadata.eventId = activation.eventId;
    metadata.bindingIds = item.target.bindings.map((binding) => binding.id);
    metadata.locatorIds = locatorIds(item.target.bindings);
    metadata.bindings = item.target.bindings.map(bindingMetadata);
    addOptional(metadata, "transitionLabel", activation.transitionLabel);
    addOptional(metadata, "fromStateLabel", activation.fromStateLabel);
    addOptional(metadata, "toStateLabel", activation.toStateLabel);
    addOptional(metadata, "surfaceLabel", activation.surfaceLabel);
    addOptional(metadata, "eventLabel", activation.eventLabel);
    addOptional(metadata, "effectRef", activation.effectRef);
    return metadata;
  }

  metadata.transitionId = item.transitionId;
  return metadata;
}

function bindingMetadata(binding: ResolvedObservationBinding): AxeAuditMetadata {
  const metadata: AxeAuditMetadata = {
    bindingId: binding.id,
    surfaceId: binding.surfaceId,
    eventId: binding.eventId,
    locatorIds: binding.locators.map((locator) => locator.id),
    locators: binding.locators.map((locator) => {
      const locatorMetadata: AxeAuditMetadata = {
        locatorId: locator.id,
        features: locator.features.map((feature) => ({
          featureId: feature.id,
          name: feature.name,
          value: feature.value
        }))
      };

      addOptional(locatorMetadata, "label", locator.label);
      addOptional(locatorMetadata, "role", locator.role);
      addOptional(locatorMetadata, "accessibleName", locator.accessibleName);
      addOptional(locatorMetadata, "accessibleDescription", locator.accessibleDescription);

      return locatorMetadata;
    })
  };

  addOptional(metadata, "label", binding.label);
  addOptional(metadata, "eventLabel", binding.eventLabel);
  if (binding.expectedMatchCount !== undefined) {
    metadata.expectedMatchCount = binding.expectedMatchCount;
  }

  return metadata;
}

function addUniqueEventMetadata(metadata: AxeAuditMetadata, eventIds: string[]): void {
  const uniqueEventIds = [...new Set(eventIds)];

  metadata.eventIds = uniqueEventIds;
  if (uniqueEventIds.length === 1) {
    metadata.eventId = uniqueEventIds[0];
  }
}

function locatorIds(bindings: ResolvedObservationBinding[]): string[] {
  return [...new Set(bindings.flatMap((binding) => binding.locators.map((locator) => locator.id)))];
}

function addOptional(metadata: AxeAuditMetadata, key: string, value: string | undefined): void {
  if (value !== undefined) {
    metadata[key] = value;
  }
}

function graphNodeIdForPlanItem(item: HappyPathPlanItem): string {
  if (item.kind === "state") return item.target.observation.stateId;
  if (item.kind === "transition") return item.target.activation.transitionId;
  return item.transitionId;
}

function graphNodeSlug(graphNodeId: string): string {
  const lastSegment = graphNodeId.split(":").at(-1) ?? graphNodeId;

  return safeFileSegment(lastSegment);
}

function safeFileSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}
