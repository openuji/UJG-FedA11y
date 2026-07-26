# UJG-FedA11y Web App

Astro/Starlight app for rendering the federated file sharing journey.

## Accessibility Data Document

The production build generates an accessibility document before Astro builds:

```sh
pnpm --filter web build
```

The generator reads one Playwright test-result entry folder from:

```text
tests/federation/test-results/
```

Set `UJG_A11Y_TEST_RESULT_DIR` to choose a specific entry. The value may be an absolute path or a folder name under `tests/federation/test-results`.

```sh
UJG_A11Y_TEST_RESULT_DIR=accessible-filesharing-fed-804ab-path-is-standard-accessible-chromium pnpm --filter web build
```

If `UJG_A11Y_TEST_RESULT_DIR` is unset, the latest valid entry folder is selected by directory modified time.

Generated frontend data:

```text
src/assets/accessibility/filesharing-accessibility.json
```

Astro imports this JSON at build time and serializes it into the hydrated `JourneyPathIsland` props. There is no runtime JSON fetch.

Generated runtime artifacts:

```text
public/accessibility/filesharing/artifacts/
```

Only non-JSON evidence artifacts are copied there, currently the aggregate HTML report and state screenshots.

The JSON schema is:

```text
ujg-fed-a11y.accessibility-summary-by-graph-id.v1
```

It is grouped by UJG graph ids:

```text
states[<stateId>]
transitions[<transitionId>]
```

Each grouped item is intentionally compact. It contains only graph identity, the test item/audit id, audit status, summary counts, page/surface metric counts, a detailed HTML report anchor, and a state screenshot link when one exists:

```json
{
  "id": "urn:state:alice-files-ready",
  "itemId": "standard-000-alice-files-ready",
  "auditId": "standard-000-alice-files-ready",
  "status": "audited",
  "summary": { "violations": 3, "incomplete": 3, "passes": 42, "inapplicable": 82 },
  "metrics": {
    "pageState": { "violations": 3, "incomplete": 3, "passes": 30, "inapplicable": 32 },
    "matchedSurface": { "violations": 0, "incomplete": 0, "passes": 12, "inapplicable": 50 }
  },
  "sourceHtmlHref": "/accessibility/filesharing/artifacts/federated-sharing-standard.axe-path.html#standard-000-alice-files-ready",
  "sourceScreenshotHref": "/accessibility/filesharing/artifacts/standard-000-alice-files-ready.source.playwright-screenshot.png"
}
```

Full axe findings, node evidence, and source JSON stay in `tests/federation/test-results/`. They are not embedded into the frontend hydration payload.

Rendering is intentionally left to `@openuji/journey-path`.

## Commands

```sh
pnpm --filter web dev
pnpm --filter web build:accessibility
pnpm --filter web build
pnpm --filter web preview
```
