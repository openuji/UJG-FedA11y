import { type AxeAuditInput, type AxeAuditReport } from "../shared/types.js";
import { collectScanEvidence } from "../evidence/collect-scan-evidence.js";
import { attachReport } from "../report/attach-report.js";
import { buildReport } from "../report/build-report.js";
import { isAxeStrict } from "../shared/env.js";
import { scanPage, scanSelector } from "./axe-scanner.js";
import { withScopedLocator } from "./axe-scope.js";
import { wcag22Tags } from "./wcag-tags.js";

export async function runAxeAudit(input: AxeAuditInput): Promise<AxeAuditReport> {
  const tags = [...(input.tags ?? wcag22Tags)];
  const pageState = await scanPage(input.page, tags);
  const pageStateEvidence = await collectScanEvidence({
    page: input.page,
    testInfo: input.testInfo,
    auditId: input.auditId,
    scanId: "page-state",
    results: pageState,
    timeoutMs: input.evidenceTimeoutMs
  });
  const matchedSurface = await withScopedLocator(
    input.resolvedLocator,
    input.auditId,
    (selector) => scanSelector(input.page, selector, tags)
  );
  const matchedSurfaceEvidence = await collectScanEvidence({
    page: input.page,
    testInfo: input.testInfo,
    auditId: input.auditId,
    scanId: "matched-surface",
    results: matchedSurface,
    timeoutMs: input.evidenceTimeoutMs
  });
  const report = buildReport(input, tags, {
    pageState,
    matchedSurface
  }, {
    pageState: pageStateEvidence,
    matchedSurface: matchedSurfaceEvidence
  });

  await attachReport(input.testInfo, report);

  return report;
}

export function shouldFailForAxeViolations(report: AxeAuditReport): boolean {
  return report.strict && report.summary.violations > 0;
}

export function axeFailureMessage(report: AxeAuditReport): string {
  return [
    `Axe found ${report.summary.violations} WCAG violation(s) for ${report.auditId}.`,
    "See the attached JSON and HTML axe reports for details."
  ].join(" ");
}
