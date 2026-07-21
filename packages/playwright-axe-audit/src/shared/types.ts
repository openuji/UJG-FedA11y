import { AxeBuilder } from "@axe-core/playwright";
import { type Locator, type Page, type TestInfo } from "@playwright/test";

export type AxeResults = Awaited<ReturnType<AxeBuilder["analyze"]>>;
export type AxeRuleResult = AxeResults["violations"][number];
export type AxeNode = AxeRuleResult["nodes"][number];

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type AxeAuditMetadata = { [key: string]: JsonValue };

export type AxeAuditScanId = "page-state" | "matched-surface";

export type AxeAuditInput = {
  page: Page;
  testInfo: TestInfo;
  resolvedLocator: Locator;
  auditId: string;
  metadata?: AxeAuditMetadata;
  tags?: readonly string[];
  strict?: boolean;
  evidenceTimeoutMs?: number;
};

export type AxeDomStatus = "matched" | "ambiguous" | "not-found" | "not-css-target";

export type AxeNodeEvidence = {
  violationId: string;
  nodeIndex: number;
  url: string;
  urlPath: string;
  target: string[];
  query?: string;
  domStatus: AxeDomStatus;
  domStatusReason: string;
  matchCount?: number;
  matchedIndex?: number;
  resolved: boolean;
  visible: boolean;
  screenshotHref?: string;
  screenshotError?: string;
};

export type AxeScanEvidence = {
  nodes: AxeNodeEvidence[];
};

export type AxeEvidence = {
  pageState: AxeScanEvidence;
  matchedSurface: AxeScanEvidence;
};

export type AxeScanResults = {
  pageState: AxeResults;
  matchedSurface: AxeResults;
};

export type AxeAuditSummary = {
  violations: number;
  incomplete: number;
  passes: number;
  inapplicable: number;
};

export type AxeAuditReport = {
  auditId: string;
  createdAt: string;
  url: string;
  strict: boolean;
  wcagTags: string[];
  metadata: AxeAuditMetadata;
  summary: AxeAuditSummary;
  scans: AxeScanResults;
  evidence: AxeEvidence;
};
