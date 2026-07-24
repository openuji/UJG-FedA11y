# Federation Accessibility Reports

`accessible-filesharing.spec.ts` runs the federated sharing happy path in two modes:

- `keyboard-only`
- `standard`

Each mode emits per-audit axe reports for every audited UJG path item plus one path-level aggregate report.

## Run

```sh
pnpm --filter @ujg-fed-a11y/federation-tests test accessible-filesharing.spec.ts
```

At the end of the run, the Playwright reporter prints the aggregate report links:

```text
Accessibility reports:
  federated-sharing-keyboard-only.axe-path
    HTML: test-results/.../attachments/axe-path-federated-sharing-keyboard-only-axe-path-html-<hash>.html
    JSON: test-results/.../attachments/axe-path-federated-sharing-keyboard-only-axe-path-json-<hash>.json
  federated-sharing-standard.axe-path
    HTML: test-results/.../attachments/axe-path-federated-sharing-standard-axe-path-html-<hash>.html
    JSON: test-results/.../attachments/axe-path-federated-sharing-standard-axe-path-json-<hash>.json
```

The test environment is loaded from:

```text
infrastructure/nextcloud-federation/.env
```

## Where To Look

Playwright writes artifacts under:

```text
tests/federation/test-results/<test-run-directory>/
```

Start with the aggregate HTML report:

```text
federated-sharing-keyboard-only.axe-path.html
federated-sharing-standard.axe-path.html
```

The matching machine-readable aggregate JSON files are:

```text
federated-sharing-keyboard-only.axe-path.json
federated-sharing-standard.axe-path.json
```

Playwright also copies attached reports into:

```text
tests/federation/test-results/<test-run-directory>/attachments/
```

The aggregate HTML attachment is named like:

```text
axe-path-federated-sharing-standard-axe-path-html-<hash>.html
```

Links from that attachment point back to the test output directory, so detailed per-audit reports and highlighted screenshots should still open from the copied attachment.

You may also see an `axe-path-attachments/` directory. It contains the source HTML file used for Playwright's copied aggregate HTML attachment.

## Report Formats

### Aggregate HTML

Use this first for manual review. It includes:

- run metadata and summary counts
- one item for each UJG plan item
- item status: `audited`, `skipped`, or `not-applicable`
- exact violations and incomplete checks for each audited item
- links to the detailed per-audit JSON and HTML reports
- links from each finding node to the anchored node in the detailed HTML report
- screenshot links when highlighted screenshots were captured

### Aggregate JSON

Use this for tooling and future UI mapping. The schema version is:

```text
ujg-fed-a11y.axe-path.v1
```

Top-level fields:

- `reportId`
- `createdAt`
- `metadata`
- `summary`
- `items`

Each audited item includes:

- `auditId`
- `sourceJsonHref`
- `sourceHtmlHref`
- `summary`
- `findings.violations`
- `findings.incomplete`

Each finding node includes:

- `target`
- `failureSummary`
- `htmlHref`
- `screenshotHref` when available
- evidence fields such as URL path, axe selector query, DOM match status, match count, and visibility

The aggregate JSON does not include raw axe `node.html`. Use `htmlHref` to open the detailed per-audit HTML node anchor when you need the captured HTML snapshot.

### Per-Audit Reports

For each audited item, the runner writes:

```text
<auditId>.axe.json
<auditId>.axe.html
```

The per-audit JSON is the full `AxeAuditReport`, including raw axe result arrays and evidence. The per-audit HTML is the detailed human-readable report and contains stable anchors for each scan, rule result, and node.

Highlighted screenshots, when available, use:

```text
<auditId>.<scan-id>.<rule-id>.<node-index>.axe-highlighted.png
```

## Expected Statuses

`control-flow` plan items are included as `not-applicable` because they do not resolve to a page surface.

State items with `expectedMatchCount` other than `1` are included as `skipped` because the current axe scanner requires one matched scoped locator. This includes `expectedMatchCount: 0`.

If the runner fails before reaching or auditing an item, that item remains in the aggregate as `skipped` with a reason explaining that it was not scanned.

If strict axe mode is enabled, the runner still collects and attaches all possible per-audit and aggregate reports first, then fails after aggregation if any strict audit has violations.
