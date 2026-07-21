import { type Locator, type Page, type TestInfo } from "@playwright/test";

import { clearViolationHighlights, markLocator } from "./highlight.js";
import { type ScreenshotResult } from "./types.js";
import { errorMessage } from "../shared/errors.js";
import { highlightedNodeScreenshotFileName, safeFileSegment } from "../shared/file-names.js";

type CaptureHighlightedNodeScreenshotInput = {
  page: Page;
  locator: Locator;
  testInfo: TestInfo;
  auditId: string;
  scanId: string;
  violationId: string;
  nodeIndex: number;
  timeoutMs: number;
};

export async function captureHighlightedNodeScreenshot(
  input: CaptureHighlightedNodeScreenshotInput
): Promise<ScreenshotResult> {
  try {
    await clearViolationHighlights(input.page);
    await markLocator(input.locator, input.violationId, input.timeoutMs);

    return await captureNodeScreenshot(input);
  } catch (error) {
    return {
      error: errorMessage(error)
    };
  }
}

async function captureNodeScreenshot(
  input: CaptureHighlightedNodeScreenshotInput
): Promise<ScreenshotResult> {
  const screenshotHref = highlightedNodeScreenshotFileName(
    input.auditId,
    input.scanId,
    input.violationId,
    input.nodeIndex
  );
  const screenshotPath = input.testInfo.outputPath(screenshotHref);

  try {
    const box = await input.locator.boundingBox({ timeout: input.timeoutMs });

    if (!box) {
      return {
        error: "Element has no bounding box"
      };
    }

    await input.page.screenshot({
      path: screenshotPath,
      clip: screenshotClip(box),
      timeout: input.timeoutMs
    });

    await input.testInfo.attach(
      `axe-${input.auditId}-${input.scanId}-${safeFileSegment(input.violationId)}-${input.nodeIndex}.png`,
      {
        path: screenshotPath,
        contentType: "image/png"
      }
    );

    return {
      href: screenshotHref
    };
  } catch (error) {
    return {
      error: errorMessage(error)
    };
  }
}

function screenshotClip(box: { x: number; y: number; width: number; height: number }): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const padding = 8;

  return {
    x: Math.max(0, box.x - padding),
    y: Math.max(0, box.y - padding),
    width: box.width + padding * 2,
    height: box.height + padding * 2
  };
}
