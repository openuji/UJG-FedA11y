import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const appRoot = path.resolve(path.dirname(scriptPath), "..");
const repoRoot = path.resolve(appRoot, "../..");
const testResultsRoot = path.join(repoRoot, "tests/federation/test-results");
const publicRoot = path.join(appRoot, "public/accessibility/filesharing");
const artifactRoot = path.join(publicRoot, "artifacts");
const outputPath = path.join(appRoot, "src/assets/accessibility/filesharing-accessibility.json");
const configuredEntry = process.env.UJG_A11Y_TEST_RESULT_DIR;
const schemaVersion = "ujg-fed-a11y.accessibility-summary-by-graph-id.v1";
const emptySummary = {
  violations: 0,
  incomplete: 0,
  passes: 0,
  inapplicable: 0
};

async function main() {
  const testResultDirectory = configuredEntry
    ? await resolveConfiguredTestResultDirectory(configuredEntry)
    : await resolveLatestTestResultDirectory();
  const aggregateReportPath = await resolveAggregateReportPath(testResultDirectory);
  const aggregateReport = JSON.parse(await readFile(aggregateReportPath, "utf8"));

  await rm(publicRoot, { force: true, recursive: true });
  await mkdir(artifactRoot, { recursive: true });
  await mkdir(path.dirname(outputPath), { recursive: true });

  const aggregateHtmlHref = await copyAggregateHtmlArtifact(aggregateReportPath);
  const document = await buildAccessibilityDocument({    
    aggregateReport,
    aggregateHtmlHref,
    testResultDirectory
  });

  await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`);

  console.log(`Selected ${path.relative(repoRoot, testResultDirectory)}`);
  console.log(`Wrote ${path.relative(repoRoot, outputPath)}`);
}

async function resolveConfiguredTestResultDirectory(value) {
  const candidate = path.isAbsolute(value)
    ? value
    : path.join(testResultsRoot, value);

  let candidateStat;
  try {
    candidateStat = await stat(candidate);
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(
        `Configured UJG_A11Y_TEST_RESULT_DIR does not exist: ${value}`
      );
    }
    throw error;
  }

  if (!candidateStat.isDirectory()) {
    throw new Error(
      `Configured UJG_A11Y_TEST_RESULT_DIR is not a directory: ${value}`
    );
  }

  return candidate;
}

async function resolveLatestTestResultDirectory() {
  let entries;
  try {
    entries = await readdir(testResultsRoot, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(`No Playwright test-results directory found at ${testResultsRoot}`);
    }
    throw error;
  }

  const candidates = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const directory = path.join(testResultsRoot, entry.name);
    const reportPaths = await findAggregateReportPaths(directory);
    if (reportPaths.length !== 1) continue;

    candidates.push({
      directory,
      mtimeMs: (await stat(directory)).mtimeMs
    });
  }

  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs);

  const latest = candidates[0]?.directory;
  if (!latest) {
    throw new Error(
      `No test-result entry under ${testResultsRoot} contains exactly one federated-sharing-*.axe-path.json report`
    );
  }

  return latest;
}

async function resolveAggregateReportPath(testResultDirectory) {
  const reportPaths = await findAggregateReportPaths(testResultDirectory);

  if (reportPaths.length === 0) {
    throw new Error(
      `No federated-sharing-*.axe-path.json report found in ${testResultDirectory}`
    );
  }

  if (reportPaths.length > 1) {
    throw new Error(
      `Expected one federated-sharing-*.axe-path.json report in ${testResultDirectory}, found ${reportPaths.length}`
    );
  }

  return reportPaths[0];
}

async function findAggregateReportPaths(directory) {
  const entries = await readdir(directory, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((fileName) => (
      fileName.startsWith("federated-sharing-") &&
      fileName.endsWith(".axe-path.json")
    ))
    .sort()
    .map((fileName) => path.join(directory, fileName));
}

async function buildAccessibilityDocument({
  aggregateReport,
  aggregateHtmlHref,
  testResultDirectory
}) {
  const source = {
    testResultDirectoryName: path.basename(testResultDirectory),
    reportId: aggregateReport.reportId,
    reportMode: reportModeFromReport(aggregateReport),
    reportCreatedAt: aggregateReport.createdAt,
    delivery: "astro-hydration-prop",
    aggregateHtmlHref,
    summary: aggregateReport.summary
  };
  const document = {
    schemaVersion,
    generatedAt: new Date().toISOString(),
    source,
    states: {},
    transitions: {}
  };

  for (const item of aggregateReport.items ?? []) {
    const kind = item.metadata?.kind;
    if (kind !== "state" && kind !== "transition") continue;

    const id = kind === "state" ? item.metadata?.stateId : item.metadata?.transitionId;
    if (!id) continue;

    const graphItem = await buildGraphItem({
      aggregateHtmlHref,
      id,
      item,
      kind,
      reportDirectory: testResultDirectory
    });

    if (kind === "state") {
      document.states[id] = graphItem;
    } else {
      document.transitions[id] = graphItem;
    }
  }

  return document;
}

async function buildGraphItem({
  aggregateHtmlHref,
  id,
  item,
  kind,
  reportDirectory
}) {
  const graphItem = {
    id,
    itemId: item.itemId,
    auditId: item.auditId ?? null,
    status: item.status,
    summary: normalizeSummary(item.summary),
    metrics: normalizeScanSummaries(item.scanSummaries),
    sourceHtmlHref: `${aggregateHtmlHref}#${item.itemId}`
  };

  if (item.reason) {
    graphItem.reason = item.reason;
  }

  if (kind === "state") {
    if (item.sourceScreenshotHref) {
      graphItem.sourceScreenshotHref = await copyRequiredArtifact({
        href: item.sourceScreenshotHref,
        reportDirectory
      });
    }
    if (item.sourceScreenshotError) {
      graphItem.sourceScreenshotError = item.sourceScreenshotError;
    }
  }

  return graphItem;
}

function normalizeSummary(summary) {
  return {
    violations: numberOrZero(summary?.violations),
    incomplete: numberOrZero(summary?.incomplete),
    passes: numberOrZero(summary?.passes),
    inapplicable: numberOrZero(summary?.inapplicable)
  };
}

function normalizeScanSummaries(scanSummaries) {
  return {
    pageState: normalizeSummary(scanSummaries?.["page-state"]),
    matchedSurface: normalizeSummary(scanSummaries?.["matched-surface"])
  };
}

function numberOrZero(value) {
  return typeof value === "number" ? value : 0;
}

function reportModeFromReport(report) {
  const metadataMode = report.metadata?.mode;
  if (typeof metadataMode === "string") return metadataMode;

  const reportId = String(report.reportId ?? "");
  const match = reportId.match(/^federated-sharing-(.+)\.axe-path$/);
  return match?.[1];
}

async function copyAggregateHtmlArtifact(aggregateReportPath) {
  const sourcePath = aggregateReportPath.replace(/\.json$/, ".html");
  const fileName = path.basename(sourcePath);
  const outputPath = path.join(artifactRoot, fileName);

  try {
    await copyFile(sourcePath, outputPath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(`Required accessibility aggregate HTML missing: ${sourcePath}`);
    }
    throw error;
  }

  return `/accessibility/filesharing/artifacts/${fileName}`;
}

async function copyRequiredArtifact({ href, reportDirectory }) {
  const fileName = path.basename(href);
  const sourcePath = path.join(reportDirectory, fileName);
  const outputPath = path.join(artifactRoot, fileName);

  try {
    await copyFile(sourcePath, outputPath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(`Required accessibility artifact missing: ${sourcePath}`);
    }
    throw error;
  }

  return `/accessibility/filesharing/artifacts/${fileName}`;
}

await main();
