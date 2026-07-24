export function highlightedNodeScreenshotFileName(
  auditId: string,
  scanId: string,
  violationId: string,
  nodeIndex: number
): string {
  return `${auditId}.${scanId}.${safeFileSegment(violationId)}.${nodeIndex}.axe-highlighted.png`;
}

export function auditJsonFileName(auditId: string): string {
  return `${auditId}.axe.json`;
}

export function auditHtmlFileName(auditId: string): string {
  return `${auditId}.axe.html`;
}

export function pathAuditJsonFileName(reportId: string): string {
  return `${reportId}.json`;
}

export function pathAuditHtmlFileName(reportId: string): string {
  return `${reportId}.html`;
}

export function axeScanHtmlId(scanId: string): string {
  return `scan-${safeFileSegment(scanId)}`;
}

export function axeRuleResultHtmlId(
  scanId: string,
  resultType: string,
  ruleId: string
): string {
  return `${axeScanHtmlId(scanId)}-${safeFileSegment(resultType)}-${safeFileSegment(ruleId)}`;
}

export function axeNodeHtmlId(
  scanId: string,
  resultType: string,
  ruleId: string,
  nodeIndex: number
): string {
  return `${axeRuleResultHtmlId(scanId, resultType, ruleId)}-node-${nodeIndex}`;
}

export function axeNodeHtmlHref(
  auditId: string,
  scanId: string,
  resultType: string,
  ruleId: string,
  nodeIndex: number
): string {
  return `${auditHtmlFileName(auditId)}#${axeNodeHtmlId(scanId, resultType, ruleId, nodeIndex)}`;
}

export function safeFileSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}
