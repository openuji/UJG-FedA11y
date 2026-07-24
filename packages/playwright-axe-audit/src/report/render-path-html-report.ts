import { escapeAttribute, escapeHtml, row } from "./html.js";
import {
  type AxePathAuditFinding,
  type AxePathAuditFindingNode,
  type AxePathAuditItem,
  type AxePathAuditReport
} from "../shared/types.js";

export type AxePathAuditHtmlOptions = {
  baseHref?: string;
};

export function renderAxePathAuditHtml(
  report: AxePathAuditReport,
  options: AxePathAuditHtmlOptions = {}
): string {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    options.baseHref ? `<base href="${escapeAttribute(options.baseHref)}">` : "",
    `<title>${escapeHtml(report.reportId)} axe path report</title>`,
    "<style>",
    "body{font-family:system-ui,sans-serif;margin:2rem;line-height:1.45;color:#17202a}",
    "main{max-width:1200px}",
    "section{margin-block:2rem}",
    "table{border-collapse:collapse;width:100%;margin-block:1rem}",
    "th,td{border:1px solid #d8dee4;padding:.5rem;text-align:left;vertical-align:top}",
    "th{background:#f6f8fa}",
    "code,pre{background:#f6f8fa;border-radius:4px}",
    "pre{padding:.75rem;overflow:auto}",
    ".group{border-top:2px solid #d8dee4;padding-top:1rem}",
    ".item{border:1px solid #d8dee4;border-radius:6px;padding:1rem;margin-block:1rem}",
    ".item.skipped{border-color:#bf8700;background:#fff8c5}",
    ".item.not-applicable{background:#f6f8fa}",
    ".finding{border-left:4px solid #cf222e;padding-left:.75rem;margin-block:1rem}",
    ".finding.incomplete{border-left-color:#bf8700}",
    ".impact{font-weight:700}",
    "</style>",
    "</head>",
    "<body>",
    "<main>",
    `<h1>${escapeHtml(report.reportId)} axe path report</h1>`,
    renderMetadata(report),
    renderSummary(report),
    renderGroups(report.items),
    "</main>",
    "</body>",
    "</html>"
  ].join("\n");
}

function renderMetadata(report: AxePathAuditReport): string {
  return [
    "<section>",
    "<h2>Run Metadata</h2>",
    "<table>",
    row("Created", report.createdAt),
    row("Schema version", report.schemaVersion),
    row("Metadata", JSON.stringify(report.metadata, null, 2)),
    "</table>",
    "</section>"
  ].join("\n");
}

function renderSummary(report: AxePathAuditReport): string {
  return [
    "<section>",
    "<h2>Summary</h2>",
    "<table>",
    row("Items", String(report.summary.items)),
    row("Audited", String(report.summary.audited)),
    row("Skipped", String(report.summary.skipped)),
    row("Not applicable", String(report.summary.notApplicable)),
    row("Violations", String(report.summary.violations)),
    row("Incomplete", String(report.summary.incomplete)),
    row("Passes", String(report.summary.passes)),
    row("Inapplicable", String(report.summary.inapplicable)),
    "</table>",
    "</section>"
  ].join("\n");
}

function renderGroups(items: AxePathAuditItem[]): string {
  return [
    "<section>",
    "<h2>Path Items</h2>",
    groupedItems(items).map(renderGroup).join("\n"),
    "</section>"
  ].join("\n");
}

function renderGroup(group: { id: string; label: string; items: AxePathAuditItem[] }): string {
  return [
    `<section class="group" id="${escapeAttribute(group.id)}">`,
    `<h3>${escapeHtml(group.label)}</h3>`,
    group.items.map(renderItem).join("\n"),
    "</section>"
  ].join("\n");
}

function renderItem(item: AxePathAuditItem): string {
  const title = item.auditId ?? item.itemId;

  return [
    `<article class="item ${escapeAttribute(item.status)}" id="${escapeAttribute(item.itemId)}">`,
    `<h4>${escapeHtml(title)}</h4>`,
    renderItemTable(item),
    item.findings ? renderFindings(item) : "",
    "</article>"
  ].join("\n");
}

function renderItemTable(item: AxePathAuditItem): string {
  const links = [
    item.sourceJsonHref ? `<a href="${escapeAttribute(item.sourceJsonHref)}">JSON</a>` : "",
    item.sourceHtmlHref ? `<a href="${escapeAttribute(item.sourceHtmlHref)}">HTML</a>` : ""
  ].filter(Boolean).join(" ");

  return [
    "<table>",
    row("Status", item.status),
    row("Reason", item.reason ?? ""),
    row("URL", item.url ?? ""),
    row("Strict", item.strict === undefined ? "" : String(item.strict)),
    rawRow("Reports", links),
    row("Violations", String(item.summary?.violations ?? 0)),
    row("Incomplete", String(item.summary?.incomplete ?? 0)),
    row("Metadata", JSON.stringify(item.metadata, null, 2)),
    "</table>"
  ].join("\n");
}

function renderFindings(item: AxePathAuditItem): string {
  const violations = item.findings?.violations.map(renderFinding).join("\n");
  const incomplete = item.findings?.incomplete.map(renderFinding).join("\n");

  return [
    "<h5>Violations</h5>",
    violations || "<p>No violations reported.</p>",
    "<h5>Incomplete</h5>",
    incomplete || "<p>No incomplete checks reported.</p>"
  ].join("\n");
}

function renderFinding(finding: AxePathAuditFinding): string {
  return [
    `<section class="finding ${escapeAttribute(finding.type)}">`,
    `<h6>${escapeHtml(finding.scanId)}: ${escapeHtml(finding.ruleId)}: ${escapeHtml(finding.help)}</h6>`,
    `<p class="impact">Impact: ${escapeHtml(finding.impact ?? "unknown")}</p>`,
    `<p><a href="${escapeAttribute(finding.helpUrl)}">${escapeHtml(finding.helpUrl)}</a></p>`,
    `<p>${escapeHtml(finding.description)}</p>`,
    finding.nodes.map(renderNode).join("\n"),
    "</section>"
  ].join("\n");
}

function renderNode(node: AxePathAuditFindingNode): string {
  return [
    "<details>",
    `<summary>${escapeHtml(node.target.join(", "))}</summary>`,
    "<table>",
    rawRow("Detailed HTML", `<a href="${escapeAttribute(node.htmlHref)}">${escapeHtml(node.htmlHref)}</a>`),
    row("Failure summary", node.failureSummary ?? ""),
    row("Path", node.evidence?.urlPath ?? ""),
    row("Axe target query", node.evidence?.query ?? ""),
    row("DOM status", node.evidence?.domStatus ?? ""),
    row("DOM status reason", node.evidence?.domStatusReason ?? ""),
    row("Resolved exactly", node.evidence ? String(node.evidence.resolved) : ""),
    row("Visible", node.evidence ? String(node.evidence.visible) : ""),
    rawRow("Screenshot", node.screenshotHref ? `<a href="${escapeAttribute(node.screenshotHref)}">${escapeHtml(node.screenshotHref)}</a>` : ""),
    row("Screenshot error", node.screenshotError ?? node.evidence?.screenshotError ?? ""),
    "</table>",
    "</details>"
  ].join("\n");
}

function rawRow(label: string, value: string): string {
  return `<tr><th>${escapeHtml(label)}</th><td>${value}</td></tr>`;
}

function groupedItems(items: AxePathAuditItem[]): { id: string; label: string; items: AxePathAuditItem[] }[] {
  const groups: { id: string; label: string; items: AxePathAuditItem[] }[] = [];

  for (const item of items) {
    const groupId = item.groupId ?? "ungrouped";
    let group = groups.find((candidate) => candidate.id === groupId);

    if (!group) {
      group = {
        id: groupId,
        label: item.groupLabel ?? groupId,
        items: []
      };
      groups.push(group);
    }

    group.items.push(item);
  }

  return groups;
}
