export function highlightedNodeScreenshotFileName(
  auditId: string,
  scanId: string,
  violationId: string,
  nodeIndex: number
): string {
  return `${auditId}.${scanId}.${safeFileSegment(violationId)}.${nodeIndex}.axe-highlighted.png`;
}

export function safeFileSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}
