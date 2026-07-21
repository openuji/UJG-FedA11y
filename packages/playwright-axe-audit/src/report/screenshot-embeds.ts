import { type TestInfo } from "@playwright/test";
import { readFile } from "node:fs/promises";

import { isNodeError } from "../shared/errors.js";
import {
  type AxeAuditReport,
  type AxeScanEvidence
} from "../shared/types.js";

export type ScreenshotEmbeds = Map<string, string>;

export async function readScreenshotEmbeds(
  testInfo: TestInfo,
  report: AxeAuditReport
): Promise<ScreenshotEmbeds> {
  const embeds: ScreenshotEmbeds = new Map();

  for (const href of screenshotHrefs(report)) {
    const data = await readOptionalFile(testInfo.outputPath(href));

    if (data) {
      embeds.set(href, `data:image/png;base64,${data.toString("base64")}`);
    }
  }

  return embeds;
}

function screenshotHrefs(report: AxeAuditReport): string[] {
  return [
    ...scanScreenshotHrefs(report.evidence.pageState),
    ...scanScreenshotHrefs(report.evidence.matchedSurface)
  ];
}

function scanScreenshotHrefs(evidence: AxeScanEvidence): string[] {
  return evidence.nodes.flatMap((node) => node.screenshotHref ? [node.screenshotHref] : []);
}

async function readOptionalFile(path: string): Promise<Buffer | undefined> {
  try {
    return await readFile(path);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}
