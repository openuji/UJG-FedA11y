import { isAxeStrict } from "../shared/env.js";
import {
  type AxeAuditInput,
  type AxeAuditReport,
  type AxeAuditSummary,
  type AxeEvidence,
  type AxeResults,
  type AxeScanResults
} from "../shared/types.js";

export function buildReport(
  input: AxeAuditInput,
  tags: readonly string[],
  scans: AxeScanResults,
  evidence: AxeEvidence
): AxeAuditReport {
  return {
    auditId: input.auditId,
    createdAt: new Date().toISOString(),
    url: input.page.url(),
    strict: input.strict ?? isAxeStrict(),
    wcagTags: [...tags],
    metadata: input.metadata ?? {},
    summary: combineSummaries(scans.pageState, scans.matchedSurface),
    scans,
    evidence
  };
}

function combineSummaries(...results: AxeResults[]): AxeAuditSummary {
  return results.reduce(
    (summary, result) => ({
      violations: summary.violations + result.violations.length,
      incomplete: summary.incomplete + result.incomplete.length,
      passes: summary.passes + result.passes.length,
      inapplicable: summary.inapplicable + result.inapplicable.length
    }),
    {
      violations: 0,
      incomplete: 0,
      passes: 0,
      inapplicable: 0
    }
  );
}
