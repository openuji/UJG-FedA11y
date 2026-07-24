import { escapeAttribute, escapeHtml, row } from "./html.js";
import {
  type AxeAuditScanId,
  type AxeAuditSummary,
  type AxePathAuditFinding,
  type AxePathAuditFindingNode,
  type AxePathAuditItem,
  type AxePathAuditScanSummaries,
  type AxePathAuditReport
} from "../shared/types.js";

export type AxePathAuditHtmlOptions = {
  baseHref?: string;
};

const scanIds: AxeAuditScanId[] = ["page-state", "matched-surface"];

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
    "details{margin-block:.75rem}",
    "summary{cursor:pointer}",
    "table{border-collapse:collapse;width:100%;margin-block:1rem}",
    "th,td{border:1px solid #d8dee4;padding:.5rem;text-align:left;vertical-align:top}",
    "th{background:#f6f8fa}",
    "code,pre{background:#f6f8fa;border-radius:4px}",
    "pre{padding:.75rem;overflow:auto}",
    ".group{border-top:2px solid #d8dee4;padding-top:1rem}",
    ".item{border:1px solid #d8dee4;border-radius:6px;padding:.75rem 1rem;margin-block:1rem}",
    ".item.skipped{border-color:#bf8700;background:#fff8c5}",
    ".item.not-applicable{background:#f6f8fa}",
    ".item-summary{display:flex;gap:.75rem;align-items:center;flex-wrap:wrap}",
    ".item-title{font-weight:700}",
    ".pill{display:inline-block;border:1px solid #d8dee4;border-radius:999px;padding:.1rem .45rem;background:#fff;font-size:.875rem}",
    ".scan{border-left:4px solid #8c959f;padding-left:.75rem}",
    ".scan.matched-surface{border-left-color:#0969da}",
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
    "<h3>Scan Metrics</h3>",
    renderScanSummaryTable(report.summary.scanSummaries),
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
    `<details class="item ${escapeAttribute(item.status)}" id="${escapeAttribute(item.itemId)}">`,
    `<summary class="item-summary">${renderItemSummary(title, item)}</summary>`,
    renderItemTable(item),
    item.findings ? renderFindings(item) : "",
    "</details>"
  ].join("\n");
}

function renderItemSummary(title: string, item: AxePathAuditItem): string {
  const pageState = item.scanSummaries?.["page-state"] ?? emptyAxeSummary();
  const matchedSurface = item.scanSummaries?.["matched-surface"] ?? emptyAxeSummary();

  return [
    `<span class="item-title">${escapeHtml(title)}</span>`,
    `<span class="pill">${escapeHtml(item.status)}</span>`,
    `<span class="pill">total V:${item.summary?.violations ?? 0} I:${item.summary?.incomplete ?? 0}</span>`,
    `<span class="pill">page V:${pageState.violations} I:${pageState.incomplete}</span>`,
    `<span class="pill">locator V:${matchedSurface.violations} I:${matchedSurface.incomplete}</span>`
  ].join(" ");
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
    item.scanSummaries ? rawRow("Scan metrics", renderScanSummaryTable(item.scanSummaries)) : "",
    row("Metadata", JSON.stringify(item.metadata, null, 2)),
    "</table>"
  ].join("\n");
}

function renderFindings(item: AxePathAuditItem): string {
  return scanIds.map((scanId) => renderScanFindings(item, scanId)).join("\n");
}

function renderScanFindings(item: AxePathAuditItem, scanId: AxeAuditScanId): string {
  const violations = item.findings?.violations.filter((finding) => finding.scanId === scanId) ?? [];
  const incomplete = item.findings?.incomplete.filter((finding) => finding.scanId === scanId) ?? [];
  const summary = item.scanSummaries?.[scanId] ?? emptyAxeSummary();

  return [
    `<details class="scan ${escapeAttribute(scanId)}">`,
    `<summary>${escapeHtml(scanLabel(scanId))}: ${summaryLine(summary)}</summary>`,
    renderScanSummaryTable({ [scanId]: summary } as AxePathAuditScanSummaries),
    "<h5>Violations</h5>",
    violations.map(renderFinding).join("\n") || "<p>No violations reported.</p>",
    "<h5>Incomplete</h5>",
    incomplete.map(renderFinding).join("\n") || "<p>No incomplete checks reported.</p>",
    "</details>"
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

function renderScanSummaryTable(scanSummaries: Partial<AxePathAuditScanSummaries>): string {
  const rows = scanIds
    .filter((scanId) => Boolean(scanSummaries[scanId]))
    .map((scanId) => {
      const summary = scanSummaries[scanId] ?? emptyAxeSummary();

      return [
        "<tr>",
        `<th>${escapeHtml(scanLabel(scanId))}</th>`,
        `<td>${summary.violations}</td>`,
        `<td>${summary.incomplete}</td>`,
        `<td>${summary.passes}</td>`,
        `<td>${summary.inapplicable}</td>`,
        "</tr>"
      ].join("");
    })
    .join("\n");

  return [
    "<table>",
    "<thead><tr><th>Scan</th><th>Violations</th><th>Incomplete</th><th>Passes</th><th>Inapplicable</th></tr></thead>",
    "<tbody>",
    rows,
    "</tbody>",
    "</table>"
  ].join("\n");
}

function summaryLine(summary: AxeAuditSummary): string {
  return `V:${summary.violations} I:${summary.incomplete} P:${summary.passes} N/A:${summary.inapplicable}`;
}

function scanLabel(scanId: AxeAuditScanId): string {
  if (scanId === "page-state") return "Page state";
  return "Matched surface";
}

function emptyAxeSummary(): AxeAuditSummary {
  return {
    violations: 0,
    incomplete: 0,
    passes: 0,
    inapplicable: 0
  };
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
