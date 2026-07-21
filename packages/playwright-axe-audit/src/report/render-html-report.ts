import { escapeAttribute, escapeHtml, row } from "./html.js";
import { type ScreenshotEmbeds } from "./screenshot-embeds.js";
import {
  type AxeAuditReport,
  type AxeNode,
  type AxeNodeEvidence,
  type AxeResults,
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
    ".violation{border:1px solid #d8dee4;border-radius:6px;padding:1rem;margin-block:1rem}",
    ".impact{font-weight:700}",
    "</style>",
    "</head>",
    "<body>",
    "<main>",
    `<h1>${escapeHtml(report.auditId)} axe report</h1>`,
    renderMetadata(report),
    renderSummary(report),
    renderScan("Page State", report.scans.pageState, report.evidence.pageState, screenshotEmbeds),
    renderScan(
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
  label: string,
  results: AxeResults,
  evidence: AxeScanEvidence,
  screenshotEmbeds: ScreenshotEmbeds
): string {
  const violations = results.violations
    .map((violation) => renderViolation(
      violation,
      evidence.nodes.filter((node) => node.violationId === violation.id),
      screenshotEmbeds
    ))
    .join("\n");

  return [
    "<section>",
    `<h2>${escapeHtml(label)}</h2>`,
    "<table>",
    row("Violations", String(results.violations.length)),
    row("Incomplete", String(results.incomplete.length)),
    row("Passes", String(results.passes.length)),
    row("Inapplicable", String(results.inapplicable.length)),
    "</table>",
    violations || "<p>No violations reported.</p>",
    "</section>"
  ].join("\n");
}

function renderViolation(
  violation: AxeRuleResult,
  evidence: AxeNodeEvidence[],
  screenshotEmbeds: ScreenshotEmbeds
): string {
  const nodes = violation.nodes
    .map((node, nodeIndex) => renderNode(node, evidence[nodeIndex], screenshotEmbeds))
    .join("\n");

  return [
    '<article class="violation">',
    `<h3>${escapeHtml(violation.id)}: ${escapeHtml(violation.help)}</h3>`,
    `<p class="impact">Impact: ${escapeHtml(violation.impact ?? "unknown")}</p>`,
    `<p><a href="${escapeAttribute(violation.helpUrl)}">${escapeHtml(violation.helpUrl)}</a></p>`,
    `<p>${escapeHtml(violation.description)}</p>`,
    nodes,
    "</article>"
  ].join("\n");
}

function renderNode(
  node: AxeNode,
  evidence: AxeNodeEvidence | undefined,
  screenshotEmbeds: ScreenshotEmbeds
): string {
  return [
    "<details open>",
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
