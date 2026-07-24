# @ujg-fed-a11y/playwright-axe-audit

Reusable Playwright + axe-core audit helper for tests that need:

- a full page accessibility scan
- a scan scoped to one already-resolved Playwright `Locator`
- JSON and HTML reports attached to Playwright output
- per-issue DOM evidence with URL path, axe selector query, match status, and clipped screenshots when the target is visible and exactly resolvable

The package is intentionally not UJG-specific. UJG tests can pass state, surface, binding, and locator information through the generic `metadata` field.

## Public API

```ts
import {
  attachAxePathAuditReport,
  axeFailureMessage,
  buildAxePathAuditReport,
  renderAxePathAuditHtml,
  runAxeAudit,
  shouldFailForAxeViolations
} from "@ujg-fed-a11y/playwright-axe-audit";
```

### `runAxeAudit(input)`

```ts
type AxeAuditInput = {
  page: Page;
  testInfo: TestInfo;
  resolvedLocator: Locator;
  auditId: string;
  metadata?: AxeAuditMetadata;
  tags?: readonly string[];
  strict?: boolean;
  evidenceTimeoutMs?: number;
};
```

Required settings:

- `page`: Playwright page to audit.
- `testInfo`: Playwright test info, used for output paths and attachments.
- `resolvedLocator`: the exact surface locator to audit. This package does not call `.first()`. If the locator resolves to more than one element, Playwright locator operations should fail naturally.
- `auditId`: stable identifier used in report and screenshot filenames.

Optional settings:

- `metadata`: arbitrary JSON-compatible data copied into the report. Federation tests use this for UJG state/surface/binding/locator context.
- `tags`: axe tags to scan. Defaults to WCAG 2.2-oriented tags:
  - `wcag2a`
  - `wcag2aa`
  - `wcag21a`
  - `wcag21aa`
  - `wcag22aa`
- `strict`: whether violations should fail the calling test when used with `shouldFailForAxeViolations`. If omitted, reads `AXE_STRICT`.
- `evidenceTimeoutMs`: timeout for evidence actions such as locator evaluation, bounding box lookup, and screenshot capture. Defaults to `2000`.

## Strict Mode

Strict mode is controlled in this order:

1. `input.strict`
2. `AXE_STRICT`

`AXE_STRICT=1` and `AXE_STRICT=true` enable strict mode.

The package never throws only because axe found violations. The caller decides:

```ts
const report = await runAxeAudit(input);

expect(
  shouldFailForAxeViolations(report),
  axeFailureMessage(report)
).toBe(false);
```

## Path Aggregate Reports

Use path aggregate reports when one test runs several related axe audits and needs a single artifact for the full user path.

```ts
const pathReport = buildAxePathAuditReport({
  reportId: "federated-sharing-standard.axe-path",
  metadata: {
    mode: "standard"
  },
  items: [
    {
      itemId: "standard-000-alice-files-ready",
      report: axeReport
    },
    {
      itemId: "standard-012-bob-pending-share-offer-cleared",
      status: "skipped",
      reason: "Expected match count 0 cannot be scoped to one matched locator."
    }
  ]
});

await attachAxePathAuditReport(testInfo, pathReport);
```

Path aggregate helpers:

- `buildAxePathAuditReport(input)`: normalizes audited, skipped, and not-applicable path items into one JSON report.
- `renderAxePathAuditHtml(report)`: renders a human-readable HTML report.
- `attachAxePathAuditReport(testInfo, report)`: writes and attaches aggregate JSON/HTML to Playwright output.

The aggregate JSON includes combined summaries, `scanSummaries` split by `page-state` and `matched-surface`, item metadata, exact `violations` and `incomplete` findings, node targets, failure summaries, evidence, `screenshotHref`, and `htmlHref`. It intentionally does not copy raw `node.html`; `htmlHref` points to the anchored node in the detailed per-audit HTML report.

## Scan Logic

`runAxeAudit` runs two scans.

### Page State Scan

Scans the current full page:

```ts
new AxeBuilder({ page }).withTags(tags).analyze()
```

Report key:

```ts
report.scans.pageState
report.evidence.pageState
```

### Matched Surface Scan

Temporarily marks `resolvedLocator` with:

```text
data-axe-audit-scope="<audit-id-derived-value>"
```

Then runs axe with:

```ts
.include('[data-axe-audit-scope="..."]')
```

The scope attribute is removed after the scan. Cleanup is best-effort so a closed page does not turn evidence cleanup into the primary failure.

Report key:

```ts
report.scans.matchedSurface
report.evidence.matchedSurface
```

## Evidence Logic

For every axe violation node, the package records evidence that explains what axe pointed at and whether that target can still be found after axe analysis.

Each evidence node contains:

```ts
type AxeNodeEvidence = {
  violationId: string;
  nodeIndex: number;
  url: string;
  urlPath: string;
  target: string[];
  query?: string;
  domStatus: "matched" | "ambiguous" | "not-found" | "not-css-target";
  domStatusReason: string;
  matchCount?: number;
  matchedIndex?: number;
  resolved: boolean;
  visible: boolean;
  screenshotHref?: string;
  screenshotError?: string;
};
```

### Query

If axe provides a CSS selector target, the report includes the exact browser-console query:

```js
document.querySelectorAll("<axe selector>")
```

This query is evidence, not an assertion that the element is still present. Some frontend nodes are transient and can disappear between axe analysis, evidence collection, and manual DevTools inspection.

### DOM Status

- `matched`: the axe selector resolved to exactly one DOM node during evidence collection.
- `ambiguous`: the axe selector matched multiple nodes and the axe HTML snapshot did not identify exactly one current node.
- `not-found`: the axe selector did not match any current DOM node during evidence collection.
- `not-css-target`: axe did not provide a CSS selector target for the node.

### Matching Algorithm

For a selector from axe:

1. Run `document.querySelectorAll(selector)`.
2. If there are no matches, mark `not-found`.
3. If there is one match, use it.
4. If there are multiple matches, compare each element `outerHTML` with axe's captured `node.html`.
5. If exact HTML comparison identifies one node, use that node.
6. Otherwise compare normalized whitespace HTML.
7. If that still does not identify one node, mark `ambiguous`.

## Screenshot Logic

The package does not create global page screenshots.

A screenshot is created only when all conditions are true:

- axe provided a CSS selector
- the selector resolved to exactly one current DOM node
- the node is visible
- highlight CSS was installed successfully
- Playwright can get a bounding box for the node

The screenshot is a clipped page screenshot around the target element, with a highlight attribute applied before capture:

```text
data-axe-highlight="<violation-id>"
```

If any condition fails, the report records `screenshotError` or the relevant `domStatus`. Missing screenshots are expected for transient, hidden, or ambiguous nodes.

## Outputs

For `auditId = "alice-files-ready"`, Playwright output includes:

```text
alice-files-ready.axe.json
alice-files-ready.axe.html
alice-files-ready.<scan-id>.<violation-id>.<node-index>.axe-highlighted.png
```

The JSON and HTML files are attached to Playwright as:

```text
axe-alice-files-ready.json
axe-alice-files-ready.html
```

Node screenshots are attached as:

```text
axe-alice-files-ready-<scan-id>-<violation-id>-<node-index>.png
```

HTML reports embed screenshots as base64 data URIs when the image file is available, so copied Playwright HTML attachments still display the screenshot inline.

For `reportId = "federated-sharing-standard.axe-path"`, path aggregate output includes:

```text
federated-sharing-standard.axe-path.json
federated-sharing-standard.axe-path.html
```

The aggregate JSON and HTML are attached to Playwright as:

```text
axe-path-federated-sharing-standard.axe-path.json
axe-path-federated-sharing-standard.axe-path.html
```

The root aggregate HTML file links to sibling per-audit reports and screenshots. The copied Playwright HTML attachment is rendered with a base URL that points back to the test output directory, so those links also work from the `attachments/` copy.

## Report Structure

```ts
type AxeAuditReport = {
  auditId: string;
  createdAt: string;
  url: string;
  strict: boolean;
  wcagTags: string[];
  metadata: AxeAuditMetadata;
  summary: {
    violations: number;
    incomplete: number;
    passes: number;
    inapplicable: number;
  };
  scans: {
    pageState: AxeResults;
    matchedSurface: AxeResults;
  };
  evidence: {
    pageState: AxeScanEvidence;
    matchedSurface: AxeScanEvidence;
  };
};
```

Path aggregate reports keep the combined `summary` and add `scanSummaries` at the top level and on each audited item:

```ts
scanSummaries: {
  "page-state": AxeAuditSummary;
  "matched-surface": AxeAuditSummary;
}
```

## Federation Test Usage

```ts
const resolvedLocator = toPlaywrightObservationLocator(page, target.bindings);

await expect(resolvedLocator).toHaveCount(1);
await expect(resolvedLocator).toBeVisible();

const axeReport = await runAxeAudit({
  page,
  testInfo,
  resolvedLocator,
  auditId: "alice-files-ready",
  metadata: {
    ujg: {
      stateId: target.observation.stateId,
      surfaceId: target.observation.surfaceId,
      bindings: target.bindings.map((binding) => ({
        bindingId: binding.id,
        locators: binding.locators.map((locator) => ({
          locatorId: locator.id,
          role: locator.role,
          accessibleName: locator.accessibleName
        }))
      }))
    }
  }
});
```

The locator exactness assertion belongs in the consuming test because only the consumer knows what surface identity means.

## Design Boundaries

- No UJG-specific imports or types in this package.
- No `.first()` fallback for the resolved surface locator.
- No global screenshots.
- No hardcoded issue selectors.
- Axe violations are report data; strict-mode failure is caller-controlled.
- Cleanup failures are best-effort and should not hide the original audit result.
