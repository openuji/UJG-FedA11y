# @ujg-fed-a11y/playwright-artifacts

Generic Playwright artifact helpers for tests that need screenshots or other browser-produced evidence without coupling that evidence to axe.

## Screenshot Artifacts

```ts
import { capturePlaywrightScreenshotArtifact } from "@ujg-fed-a11y/playwright-artifacts";

const artifact = await capturePlaywrightScreenshotArtifact({
  page,
  testInfo,
  id: "source",
  fileBaseName: "keyboard-only-000-alice-files-ready",
  scope: "page",
  fullPage: true
});
```

Output filename:

```text
<fileBaseName>.<screenshotId>.playwright-screenshot.png
```

The helper returns an artifact object instead of throwing when capture fails:

```ts
type PlaywrightScreenshotArtifact = {
  id: string;
  scope: "page" | "locator";
  href?: string;
  error?: string;
  fullPage?: boolean;
  capturedAt: string;
  contentType: "image/png";
};
```

Use `scope: "page"` for full-page or viewport screenshots. `scope: "locator"` is available for bounded screenshots of a specific Playwright locator.
