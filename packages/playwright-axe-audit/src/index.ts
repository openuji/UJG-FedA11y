export {
  axeFailureMessage,
  runAxeAudit,
  shouldFailForAxeViolations
} from "./audit/run-axe-audit.js";
export { attachAxePathAuditReport } from "./report/attach-path-report.js";
export { buildAxePathAuditReport } from "./report/build-path-report.js";
export { renderAxePathAuditHtml } from "./report/render-path-html-report.js";
export type {
  AxeAuditInput,
  AxeAuditMetadata,
  AxeAuditReport,
  AxeAuditScanId,
  AxeEvidence,
  AxeNodeEvidence,
  AxePathAuditFinding,
  AxePathAuditFindingNode,
  AxePathAuditItem,
  AxePathAuditItemInput,
  AxePathAuditItemStatus,
  AxePathAuditReport,
  AxePathAuditReportInput,
  AxePathAuditScanSummaries,
  AxeResults,
  AxeScanEvidence,
  AxeScanResults
} from "./shared/types.js";
