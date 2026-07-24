import { escapeAttribute, escapeHtml, row } from "./html.js";
import { type ScreenshotEmbeds } from "./screenshot-embeds.js";
import {
  axeNodeHtmlId,
  axeRuleResultHtmlId,
  axeScanHtmlId
} from "../shared/file-names.js";
import {
  type AxeAuditReport,
  type AxeAuditScanId,
  type AxeNode,
  type AxeNodeEvidence,
  type AxeResults,
  type AxeRuleResultType,
  type AxeRuleResult,
  type AxeScanEvidence
} from "../shared/types.js";

export function renderHtmlReport(
  report: AxeAuditReport,
  screenshotEmbeds: ScreenshotEmbeds
): string {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    `<title>${escapeHtml(report.auditId)} axe report</title>`,
    "<style>",
    "body{font-family:system-ui,sans-serif;margin:2rem;line-height:1.45;color:#17202a}",
    "main{max-width:1100px}",
    "section{margin-block:2rem}",
    "table{border-collapse:collapse;width:100%;margin-block:1rem}",
    "th,td{border:1px solid #d8dee4;padding:.5rem;text-align:left;vertical-align:top}",
    "th{background:#f6f8fa}",
    "code,pre{background:#f6f8fa;border-radius:4px}",
    "pre{padding:.75rem;overflow:auto}",
    "img{display:block;max-width:min(100%,720px);height:auto;border:1px solid #d8dee4}",
    ".rule-result{border:1px solid #d8dee4;border-radius:6px;padding:1rem;margin-block:1rem}",
    ".rule-result.incomplete{border-color:#bf8700;background:#fff8c5}",
    ".impact{font-weight:700}",
    "</style>",
    "</head>",
    "<body>",
    "<main>",
    `<h1>${escapeHtml(report.auditId)} axe report</h1>`,
    renderMetadata(report),
    renderSummary(report),
    renderScan(
      "page-state",
      "Page State",
      report.scans.pageState,
      report.evidence.pageState,
      screenshotEmbeds
    ),
    renderScan(
      "matched-surface",
      "Matched Surface",
      report.scans.matchedSurface,
      report.evidence.matchedSurface,
      screenshotEmbeds
    ),
    "</main>",
    "</body>",
    "</html>"
  ].join("\n");
}

function renderMetadata(report: AxeAuditReport): string {
  return [
    "<section>",
    "<h2>Audit Metadata</h2>",
    "<table>",
    row("Created", report.createdAt),
    row("URL", report.url),
    row("Strict mode", String(report.strict)),
    row("WCAG tags", report.wcagTags.join(", ")),
    row("Metadata", JSON.stringify(report.metadata, null, 2)),
    "</table>",
    "</section>"
  ].join("\n");
}

function renderSummary(report: AxeAuditReport): string {
  return [
    "<section>",
    "<h2>Combined Summary</h2>",
    "<table>",
    row("Violations", String(report.summary.violations)),
    row("Incomplete", String(report.summary.incomplete)),
    row("Passes", String(report.summary.passes)),
    row("Inapplicable", String(report.summary.inapplicable)),
    "</table>",
    "</section>"
  ].join("\n");
}

function renderScan(
  scanId: AxeAuditScanId,
  label: string,
  results: AxeResults,
  evidence: AxeScanEvidence,
  screenshotEmbeds: ScreenshotEmbeds
): string {
  const violations = results.violations
    .map((violation) => renderRuleResult(
      "violation",
      scanId,
      violation,
      evidence.nodes.filter((node) => isEvidenceForResult(node, "violation", violation.id)),
      screenshotEmbeds
    ))
    .join("\n");
  const incomplete = results.incomplete
    .map((incompleteResult) => renderRuleResult(
      "incomplete",
      scanId,
      incompleteResult,
      evidence.nodes.filter((node) => isEvidenceForResult(node, "incomplete", incompleteResult.id)),
      screenshotEmbeds
    ))
    .join("\n");

  return [
    `<section id="${escapeAttribute(axeScanHtmlId(scanId))}">`,
    `<h2>${escapeHtml(label)}</h2>`,
    "<table>",
    row("Violations", String(results.violations.length)),
    row("Incomplete", String(results.incomplete.length)),
    row("Passes", String(results.passes.length)),
    row("Inapplicable", String(results.inapplicable.length)),
    "</table>",
    "<h3>Violations</h3>",
    violations || "<p>No violations reported.</p>",
    "<h3>Incomplete</h3>",
    incomplete || "<p>No incomplete checks reported.</p>",
    "</section>"
  ].join("\n");
}

function renderRuleResult(
  resultType: AxeRuleResultType,
  scanId: AxeAuditScanId,
  result: AxeRuleResult,
  evidence: AxeNodeEvidence[],
  screenshotEmbeds: ScreenshotEmbeds
): string {
  const nodes = result.nodes
    .map((node, nodeIndex) =>
      renderNode(scanId, resultType, result.id, node, nodeIndex, evidence[nodeIndex], screenshotEmbeds)
    )
    .join("\n");
  const label = resultType === "incomplete" ? "Incomplete" : "Violation";

  return [
    `<article class="rule-result ${escapeAttribute(resultType)}" id="${escapeAttribute(axeRuleResultHtmlId(scanId, resultType, result.id))}">`,
    `<h4>${escapeHtml(label)}: ${escapeHtml(result.id)}: ${escapeHtml(result.help)}</h4>`,
    `<p class="impact">Impact: ${escapeHtml(result.impact ?? "unknown")}</p>`,
    `<p><a href="${escapeAttribute(result.helpUrl)}">${escapeHtml(result.helpUrl)}</a></p>`,
    `<p>${escapeHtml(result.description)}</p>`,
    nodes,
    "</article>"
  ].join("\n");
}

function isEvidenceForResult(
  evidence: AxeNodeEvidence,
  resultType: AxeRuleResultType,
  ruleId: string
): boolean {
  return evidence.resultType === resultType && evidence.violationId === ruleId;
}

function renderNode(
  scanId: AxeAuditScanId,
  resultType: AxeRuleResultType,
  ruleId: string,
  node: AxeNode,
  nodeIndex: number,
  evidence: AxeNodeEvidence | undefined,
  screenshotEmbeds: ScreenshotEmbeds
): string {
  return [
    `<details open id="${escapeAttribute(axeNodeHtmlId(scanId, resultType, ruleId, nodeIndex))}">`,
    `<summary>${escapeHtml(node.target.join(", "))}</summary>`,
    evidence ? renderNodeEvidence(evidence, screenshotEmbeds) : "",
    "<h4>HTML</h4>",
    `<pre>${escapeHtml(node.html)}</pre>`,
    "<h4>Failure Summary</h4>",
    `<pre>${escapeHtml(node.failureSummary ?? "")}</pre>`,
    "</details>"
  ].join("\n");
}

function renderNodeEvidence(
  evidence: AxeNodeEvidence,
  screenshotEmbeds: ScreenshotEmbeds
): string {
  return [
    "<h4>Location</h4>",
    "<table>",
    row("URL", evidence.url),
    row("Path", evidence.urlPath),
    row("Axe target", evidence.target.join(", ")),
    row("Axe target query", evidence.query ?? "No CSS selector target provided by axe"),
    row("DOM status", evidence.domStatus),
    row("DOM status reason", evidence.domStatusReason),
    row("Matched elements", String(evidence.matchCount ?? 0)),
    row("Matched index", evidence.matchedIndex === undefined ? "unresolved" : String(evidence.matchedIndex)),
    row("Resolved exactly", String(evidence.resolved)),
    row("Visible", String(evidence.visible)),
    row("Screenshot error", evidence.screenshotError ?? ""),
    "</table>",
    evidence.screenshotHref ? renderScreenshotLink(evidence.screenshotHref, screenshotEmbeds) : ""
  ].join("\n");
}

function renderScreenshotLink(
  href: string,
  screenshotEmbeds: ScreenshotEmbeds
): string {
  const embeddedHref = screenshotEmbeds.get(href);
  const linkHref = embeddedHref ?? href;

  return [
    "<details>",
    "<summary>Screenshot</summary>",
    `<p><a href="${escapeAttribute(linkHref)}" download="${escapeAttribute(href)}">${escapeHtml(href)}</a></p>`,
    `<img src="${escapeAttribute(linkHref)}" alt="Highlighted axe target ${escapeAttribute(href)}">`,
    "</details>"
  ].join("");
}
