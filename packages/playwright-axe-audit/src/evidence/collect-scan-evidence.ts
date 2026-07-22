import { type Page, type TestInfo } from "@playwright/test";

import { captureHighlightedNodeScreenshot } from "./screenshot-evidence.js";
import { clearViolationHighlights, installHighlightStyle } from "./highlight.js";
import { cssQuery, primarySelector, stringTargets } from "./dom-query.js";
import {
  domStatusForMatch,
  domStatusReasonForMatch,
  resolveAxeNodeMatch
} from "./resolve-axe-node.js";
import {
  type AxeAuditScanId,
  type AxeNode,
  type AxeNodeEvidence,
  type AxeResults,
  type AxeRuleResultType,
  type AxeRuleResult,
  type AxeScanEvidence
} from "../shared/types.js";
import { urlPath } from "../shared/url.js";

const defaultEvidenceTimeoutMs = 2_000;

type CollectScanEvidenceInput = {
  page: Page;
  testInfo: TestInfo;
  auditId: string;
  scanId: AxeAuditScanId;
  results: AxeResults;
  timeoutMs?: number;
};

export async function collectScanEvidence(
  input: CollectScanEvidenceInput
): Promise<AxeScanEvidence> {
  if (input.results.violations.length === 0 && input.results.incomplete.length === 0) {
    return {
      nodes: []
    };
  }

  const nodes: AxeNodeEvidence[] = [];
  const highlightAvailable = await installHighlightStyle(input.page);

  try {
    for (const violation of input.results.violations) {
      for (const [nodeIndex, node] of violation.nodes.entries()) {
        nodes.push(
          await createNodeEvidence(input, "violation", violation, node, nodeIndex, highlightAvailable)
        );
      }
    }

    for (const incomplete of input.results.incomplete) {
      for (const [nodeIndex, node] of incomplete.nodes.entries()) {
        nodes.push(
          await createNodeEvidence(input, "incomplete", incomplete, node, nodeIndex, highlightAvailable)
        );
      }
    }

    return {
      nodes
    };
  } finally {
    await clearViolationHighlights(input.page);
  }
}

async function createNodeEvidence(
  input: CollectScanEvidenceInput,
  resultType: AxeRuleResultType,
  violation: AxeRuleResult,
  node: AxeNode,
  nodeIndex: number,
  highlightAvailable: boolean
): Promise<AxeNodeEvidence> {
  const selector = primarySelector(node);
  const baseEvidence = createBaseEvidence(input.page, resultType, violation, node, nodeIndex, selector);

  if (!selector) {
    return baseEvidence;
  }

  const match = await resolveAxeNodeMatch(input.page, selector, node.html);

  if (!match.locator || !match.visible) {
    return {
      ...baseEvidence,
      domStatus: domStatusForMatch(match),
      domStatusReason: domStatusReasonForMatch(match),
      matchCount: match.matchCount,
      matchedIndex: match.matchedIndex,
      resolved: Boolean(match.locator),
      visible: match.visible
    };
  }

  if (!highlightAvailable) {
    return matchedEvidenceWithoutScreenshot(baseEvidence, match);
  }

  const screenshot = await captureHighlightedNodeScreenshot({
    page: input.page,
    locator: match.locator,
    testInfo: input.testInfo,
    auditId: input.auditId,
    scanId: input.scanId,
    violationId: violation.id,
    nodeIndex,
    timeoutMs: input.timeoutMs ?? defaultEvidenceTimeoutMs
  });

  return {
    ...matchedEvidenceWithoutScreenshot(baseEvidence, match),
    screenshotHref: screenshot.href,
    screenshotError: screenshot.error
  };
}

function createBaseEvidence(
  page: Page,
  resultType: AxeRuleResultType,
  violation: AxeRuleResult,
  node: AxeNode,
  nodeIndex: number,
  selector: string | undefined
): AxeNodeEvidence {
  return {
    resultType,
    violationId: violation.id,
    nodeIndex,
    url: page.url(),
    urlPath: urlPath(page.url()),
    target: stringTargets(node),
    query: selector ? cssQuery(selector) : undefined,
    domStatus: selector ? "not-found" : "not-css-target",
    domStatusReason: selector
      ? "Axe target was not present in the DOM when evidence was collected after axe analysis."
      : "Axe did not provide a CSS selector target for this node.",
    resolved: false,
    visible: false
  };
}

function matchedEvidenceWithoutScreenshot(
  evidence: AxeNodeEvidence,
  match: { matchCount: number; matchedIndex?: number; visible: boolean }
): AxeNodeEvidence {
  return {
    ...evidence,
    domStatus: "matched",
    domStatusReason: "Axe target resolved to one DOM node during evidence collection after axe analysis.",
    matchCount: match.matchCount,
    matchedIndex: match.matchedIndex,
    resolved: true,
    visible: match.visible
  };
}
