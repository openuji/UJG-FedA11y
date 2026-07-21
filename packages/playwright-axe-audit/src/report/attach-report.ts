import { type TestInfo } from "@playwright/test";
import { writeFile } from "node:fs/promises";

import { readScreenshotEmbeds } from "./screenshot-embeds.js";
import { renderHtmlReport } from "./render-html-report.js";
import { type AxeAuditReport } from "../shared/types.js";

export async function attachReport(testInfo: TestInfo, report: AxeAuditReport): Promise<void> {
  const jsonPath = testInfo.outputPath(`${report.auditId}.axe.json`);
  const htmlPath = testInfo.outputPath(`${report.auditId}.axe.html`);
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
