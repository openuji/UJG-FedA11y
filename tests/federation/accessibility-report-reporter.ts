import { basename, relative } from "node:path";

import { type Reporter, type TestCase, type TestResult } from "@playwright/test/reporter";

type ReportLinks = {
  reportId: string;
  htmlPath?: string;
  jsonPath?: string;
};

export default class AccessibilityReportReporter implements Reporter {
  private readonly reports = new Map<string, ReportLinks>();

  onTestEnd(_test: TestCase, result: TestResult): void {
    for (const attachment of result.attachments) {
      if (!attachment.path || !attachment.name.startsWith("axe-path-")) continue;

      const reportId = reportIdFromAttachmentName(attachment.name);
      if (!reportId) continue;

      const links = this.reports.get(reportId) ?? { reportId };

      if (attachment.contentType === "text/html") {
        links.htmlPath = attachment.path;
      } else if (attachment.contentType === "application/json") {
        links.jsonPath = attachment.path;
      }

      this.reports.set(reportId, links);
    }
  }

  onEnd(): void {
    const reports = [...this.reports.values()]
      .filter((report) => report.htmlPath || report.jsonPath)
      .sort((a, b) => a.reportId.localeCompare(b.reportId));

    if (reports.length === 0) return;

    process.stdout.write("\nAccessibility reports:\n");

    for (const report of reports) {
      process.stdout.write(`  ${report.reportId}\n`);
      if (report.htmlPath) {
        process.stdout.write(`    HTML: ${relativeReportPath(report.htmlPath)}\n`);
      }
      if (report.jsonPath) {
        process.stdout.write(`    JSON: ${relativeReportPath(report.jsonPath)}\n`);
      }
    }
  }
}

function relativeReportPath(path: string): string {
  const relativePath = relative(process.cwd(), path);
  return relativePath || ".";
}

function reportIdFromAttachmentName(name: string): string | undefined {
  const fileName = basename(name);
  if (!fileName.startsWith("axe-path-")) return undefined;
  if (fileName.endsWith(".html")) return fileName.slice("axe-path-".length, -".html".length);
  if (fileName.endsWith(".json")) return fileName.slice("axe-path-".length, -".json".length);
  return undefined;
}
