import { type Locator, type Page, type TestInfo } from "@playwright/test";

export type PlaywrightScreenshotScope = "page" | "locator";

export type PlaywrightScreenshotArtifact = {
  id: string;
  scope: PlaywrightScreenshotScope;
  href?: string;
  error?: string;
  fullPage?: boolean;
  capturedAt: string;
  contentType: "image/png";
};

type PlaywrightScreenshotBaseInput = {
  testInfo: TestInfo;
  id: string;
  fileBaseName: string;
  timeoutMs?: number;
  attach?: boolean;
};

export type PlaywrightPageScreenshotInput = PlaywrightScreenshotBaseInput & {
  scope: "page";
  page: Page;
  fullPage?: boolean;
};

export type PlaywrightLocatorScreenshotInput = PlaywrightScreenshotBaseInput & {
  scope: "locator";
  locator: Locator;
};

export type PlaywrightScreenshotInput =
  | PlaywrightPageScreenshotInput
  | PlaywrightLocatorScreenshotInput;

export async function capturePlaywrightScreenshotArtifact(
  input: PlaywrightScreenshotInput
): Promise<PlaywrightScreenshotArtifact> {
  const href = screenshotFileName(input.fileBaseName, input.id);
  const capturedAt = new Date().toISOString();

  try {
    const screenshotPath = input.testInfo.outputPath(href);

    if (input.scope === "page") {
      await input.page.screenshot({
        path: screenshotPath,
        fullPage: input.fullPage ?? false,
        timeout: input.timeoutMs
      });
    } else {
      await input.locator.screenshot({
        path: screenshotPath,
        timeout: input.timeoutMs
      });
    }

    if (input.attach ?? true) {
      await input.testInfo.attach(
        `playwright-${safeFileSegment(input.fileBaseName)}-${safeFileSegment(input.id)}.png`,
        {
          path: screenshotPath,
          contentType: "image/png"
        }
      );
    }

    return {
      id: input.id,
      scope: input.scope,
      href,
      fullPage: input.scope === "page" ? input.fullPage ?? false : undefined,
      capturedAt,
      contentType: "image/png"
    };
  } catch (error) {
    return {
      id: input.id,
      scope: input.scope,
      error: errorMessage(error),
      fullPage: input.scope === "page" ? input.fullPage ?? false : undefined,
      capturedAt,
      contentType: "image/png"
    };
  }
}

function screenshotFileName(fileBaseName: string, id: string): string {
  return `${safeFileSegment(fileBaseName)}.${safeFileSegment(id)}.playwright-screenshot.png`;
}

function safeFileSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
