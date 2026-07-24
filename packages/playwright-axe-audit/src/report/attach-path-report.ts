import { type TestInfo } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { renderAxePathAuditHtml } from "./render-path-html-report.js";
import { pathAuditHtmlFileName, pathAuditJsonFileName } from "../shared/file-names.js";
import { type AxePathAuditReport } from "../shared/types.js";

export async function attachAxePathAuditReport(
  testInfo: TestInfo,
  report: AxePathAuditReport
): Promise<void> {
  const jsonPath = testInfo.outputPath(pathAuditJsonFileName(report.reportId));
  const htmlPath = testInfo.outputPath(pathAuditHtmlFileName(report.reportId));
  const attachmentHtmlPath = testInfo.outputPath(
    "axe-path-attachments",
    pathAuditHtmlFileName(report.reportId)
  );

  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  await writeFile(htmlPath, renderAxePathAuditHtml(report));
  await mkdir(dirname(attachmentHtmlPath), { recursive: true });
  await writeFile(attachmentHtmlPath, renderAxePathAuditHtml(report, { baseHref: "../" }));

  await testInfo.attach(`axe-path-${report.reportId}.json`, {
    path: jsonPath,
    contentType: "application/json"
  });

  await testInfo.attach(`axe-path-${report.reportId}.html`, {
    path: attachmentHtmlPath,
    contentType: "text/html"
  });
}
