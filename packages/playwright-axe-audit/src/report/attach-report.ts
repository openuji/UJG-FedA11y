import { type TestInfo } from "@playwright/test";
import { writeFile } from "node:fs/promises";

import { readScreenshotEmbeds } from "./screenshot-embeds.js";
import { renderHtmlReport } from "./render-html-report.js";
import { auditHtmlFileName, auditJsonFileName } from "../shared/file-names.js";
import { type AxeAuditReport } from "../shared/types.js";

export async function attachReport(testInfo: TestInfo, report: AxeAuditReport): Promise<void> {
  const jsonPath = testInfo.outputPath(auditJsonFileName(report.auditId));
  const htmlPath = testInfo.outputPath(auditHtmlFileName(report.auditId));
  const screenshotEmbeds = await readScreenshotEmbeds(testInfo, report);

  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  await writeFile(htmlPath, renderHtmlReport(report, screenshotEmbeds));

  await testInfo.attach(`axe-${report.auditId}.json`, {
    path: jsonPath,
    contentType: "application/json"
  });

  await testInfo.attach(`axe-${report.auditId}.html`, {
    path: htmlPath,
    contentType: "text/html"
  });
}
