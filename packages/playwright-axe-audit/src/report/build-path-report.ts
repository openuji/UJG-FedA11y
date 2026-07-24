import {
  auditHtmlFileName,
  auditJsonFileName,
  axeNodeHtmlHref
} from "../shared/file-names.js";
import {
  type AxeAuditReport,
  type AxeAuditScanId,
  type AxeNode,
  type AxeNodeEvidence,
  type AxeAuditSummary,
  type AxePathAuditFinding,
  type AxePathAuditFindingNode,
  type AxePathAuditFindingNodeEvidence,
  type AxePathAuditFindings,
  type AxePathAuditItem,
  type AxePathAuditItemInput,
  type AxePathAuditReport,
  type AxePathAuditReportInput,
  type AxePathAuditScanSummaries,
  type AxePathAuditSummary,
  type AxeResults,
  type AxeRuleResult,
  type AxeRuleResultType,
  type AxeScanEvidence
} from "../shared/types.js";

export function buildAxePathAuditReport(
  input: AxePathAuditReportInput
): AxePathAuditReport {
  const items = input.items.map(buildItem);

  return {
    schemaVersion: "ujg-fed-a11y.axe-path.v1",
    reportId: input.reportId,
    createdAt: input.createdAt ?? new Date().toISOString(),
    metadata: input.metadata ?? {},
    summary: summarizeItems(items),
    items
  };
}

function buildItem(input: AxePathAuditItemInput): AxePathAuditItem {
  if ("report" in input) {
    const { report } = input;

    return {
      itemId: input.itemId,
      groupId: input.groupId,
      groupLabel: input.groupLabel,
      status: "audited",
      metadata: input.metadata ?? report.metadata,
      auditId: report.auditId,
      createdAt: report.createdAt,
      url: report.url,
      strict: report.strict,
      wcagTags: report.wcagTags,
      sourceJsonHref: auditJsonFileName(report.auditId),
      sourceHtmlHref: auditHtmlFileName(report.auditId),
      summary: report.summary,
      scanSummaries: buildScanSummaries(report),
      findings: buildFindings(report)
    };
  }

  return {
    itemId: input.itemId,
    groupId: input.groupId,
    groupLabel: input.groupLabel,
    status: input.status,
    reason: input.reason,
    metadata: input.metadata ?? {}
  };
}

function buildFindings(report: AxeAuditReport): AxePathAuditFindings {
  return {
    violations: [
      ...scanFindings(report, "page-state", "violation", report.scans.pageState, report.evidence.pageState),
      ...scanFindings(
        report,
        "matched-surface",
        "violation",
        report.scans.matchedSurface,
        report.evidence.matchedSurface
      )
    ],
    incomplete: [
      ...scanFindings(report, "page-state", "incomplete", report.scans.pageState, report.evidence.pageState),
      ...scanFindings(
        report,
        "matched-surface",
        "incomplete",
        report.scans.matchedSurface,
        report.evidence.matchedSurface
      )
    ]
  };
}

function buildScanSummaries(report: AxeAuditReport): AxePathAuditScanSummaries {
  return {
    "page-state": summarizeResults(report.scans.pageState),
    "matched-surface": summarizeResults(report.scans.matchedSurface)
  };
}

function summarizeResults(results: AxeResults): AxeAuditSummary {
  return {
    violations: results.violations.length,
    incomplete: results.incomplete.length,
    passes: results.passes.length,
    inapplicable: results.inapplicable.length
  };
}

function scanFindings(
  report: AxeAuditReport,
  scanId: AxeAuditScanId,
  resultType: AxeRuleResultType,
  results: AxeResults,
  evidence: AxeScanEvidence
): AxePathAuditFinding[] {
  const ruleResults = resultType === "violation" ? results.violations : results.incomplete;

  return ruleResults.map((result) => ({
    type: resultType,
    scanId,
    ruleId: result.id,
    impact: result.impact ?? undefined,
    help: result.help,
    helpUrl: result.helpUrl,
    description: result.description,
    nodes: result.nodes.map((node, nodeIndex) =>
      buildFindingNode(report.auditId, scanId, resultType, result, node, nodeIndex, evidence)
    )
  }));
}

function buildFindingNode(
  auditId: string,
  scanId: AxeAuditScanId,
  resultType: AxeRuleResultType,
  result: AxeRuleResult,
  node: AxeNode,
  nodeIndex: number,
  evidence: AxeScanEvidence
): AxePathAuditFindingNode {
  const nodeEvidence = evidence.nodes.find((candidate) =>
    candidate.resultType === resultType &&
    candidate.violationId === result.id &&
    candidate.nodeIndex === nodeIndex
  );
  const failureSummary = node.failureSummary ?? undefined;

  return {
    nodeIndex,
    target: nodeEvidence?.target ?? stringTargets(node),
    failureSummary,
    htmlHref: axeNodeHtmlHref(auditId, scanId, resultType, result.id, nodeIndex),
    screenshotHref: nodeEvidence?.screenshotHref,
    screenshotError: nodeEvidence?.screenshotError,
    evidence: nodeEvidence ? pathNodeEvidence(nodeEvidence) : undefined
  };
}

function pathNodeEvidence(evidence: AxeNodeEvidence): AxePathAuditFindingNodeEvidence {
  return {
    url: evidence.url,
    urlPath: evidence.urlPath,
    query: evidence.query,
    domStatus: evidence.domStatus,
    domStatusReason: evidence.domStatusReason,
    matchCount: evidence.matchCount,
    matchedIndex: evidence.matchedIndex,
    resolved: evidence.resolved,
    visible: evidence.visible,
    screenshotError: evidence.screenshotError
  };
}

function summarizeItems(items: AxePathAuditItem[]): AxePathAuditSummary {
  return items.reduce<AxePathAuditSummary>(
    (summary, item) => addItemSummary(summary, item),
    emptyPathSummary()
  );
}

function addItemSummary(
  summary: AxePathAuditSummary,
  item: AxePathAuditItem
): AxePathAuditSummary {
  return {
    items: summary.items + 1,
    audited: summary.audited + (item.status === "audited" ? 1 : 0),
    skipped: summary.skipped + (item.status === "skipped" ? 1 : 0),
    notApplicable: summary.notApplicable + (item.status === "not-applicable" ? 1 : 0),
    violations: summary.violations + (item.summary?.violations ?? 0),
    incomplete: summary.incomplete + (item.summary?.incomplete ?? 0),
    passes: summary.passes + (item.summary?.passes ?? 0),
    inapplicable: summary.inapplicable + (item.summary?.inapplicable ?? 0),
    scanSummaries: addScanSummaries(summary.scanSummaries, item.scanSummaries)
  };
}

function addScanSummaries(
  left: AxePathAuditScanSummaries,
  right: AxePathAuditScanSummaries | undefined
): AxePathAuditScanSummaries {
  if (!right) return left;

  return {
    "page-state": addAxeSummaries(left["page-state"], right["page-state"]),
    "matched-surface": addAxeSummaries(left["matched-surface"], right["matched-surface"])
  };
}

function addAxeSummaries(left: AxeAuditSummary, right: AxeAuditSummary): AxeAuditSummary {
  return {
    violations: left.violations + right.violations,
    incomplete: left.incomplete + right.incomplete,
    passes: left.passes + right.passes,
    inapplicable: left.inapplicable + right.inapplicable
  };
}

function emptyPathSummary(): AxePathAuditSummary {
  return {
    items: 0,
    audited: 0,
    skipped: 0,
    notApplicable: 0,
    violations: 0,
    incomplete: 0,
    passes: 0,
    inapplicable: 0,
    scanSummaries: emptyScanSummaries()
  };
}

function emptyScanSummaries(): AxePathAuditScanSummaries {
  return {
    "page-state": emptyAxeSummary(),
    "matched-surface": emptyAxeSummary()
  };
}

function emptyAxeSummary(): AxeAuditSummary {
  return {
    violations: 0,
    incomplete: 0,
    passes: 0,
    inapplicable: 0
  };
}

function stringTargets(node: AxeNode): string[] {
  return node.target.filter((target): target is string => typeof target === "string");
}
