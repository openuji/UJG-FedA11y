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
export type AxeRuleResultType = "violation" | "incomplete";

export type AxeNodeEvidence = {
  resultType: AxeRuleResultType;
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

export type AxePathAuditScanSummaries = {
  [scanId in AxeAuditScanId]: AxeAuditSummary;
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

export type AxePathAuditItemStatus = "audited" | "skipped" | "not-applicable";

export type AxePathAuditFindingNodeEvidence = {
  url: string;
  urlPath: string;
  query?: string;
  domStatus: AxeDomStatus;
  domStatusReason: string;
  matchCount?: number;
  matchedIndex?: number;
  resolved: boolean;
  visible: boolean;
  screenshotError?: string;
};

export type AxePathAuditFindingNode = {
  nodeIndex: number;
  target: string[];
  failureSummary?: string;
  htmlHref: string;
  screenshotHref?: string;
  screenshotError?: string;
  evidence?: AxePathAuditFindingNodeEvidence;
};

export type AxePathAuditFinding = {
  type: AxeRuleResultType;
  scanId: AxeAuditScanId;
  ruleId: string;
  impact?: string;
  help: string;
  helpUrl: string;
  description: string;
  nodes: AxePathAuditFindingNode[];
};

export type AxePathAuditFindings = {
  violations: AxePathAuditFinding[];
  incomplete: AxePathAuditFinding[];
};

export type AxePathAuditItem = {
  itemId: string;
  groupId?: string;
  groupLabel?: string;
  status: AxePathAuditItemStatus;
  reason?: string;
  metadata: AxeAuditMetadata;
  auditId?: string;
  createdAt?: string;
  url?: string;
  strict?: boolean;
  wcagTags?: string[];
  sourceJsonHref?: string;
  sourceHtmlHref?: string;
  summary?: AxeAuditSummary;
  scanSummaries?: AxePathAuditScanSummaries;
  findings?: AxePathAuditFindings;
};

export type AxePathAuditSummary = {
  items: number;
  audited: number;
  skipped: number;
  notApplicable: number;
  violations: number;
  incomplete: number;
  passes: number;
  inapplicable: number;
  scanSummaries: AxePathAuditScanSummaries;
};

export type AxePathAuditReport = {
  schemaVersion: "ujg-fed-a11y.axe-path.v1";
  reportId: string;
  createdAt: string;
  metadata: AxeAuditMetadata;
  summary: AxePathAuditSummary;
  items: AxePathAuditItem[];
};

export type AxePathAuditAuditedItemInput = {
  itemId: string;
  groupId?: string;
  groupLabel?: string;
  metadata?: AxeAuditMetadata;
  report: AxeAuditReport;
};

export type AxePathAuditUnauditedItemInput = {
  itemId: string;
  groupId?: string;
  groupLabel?: string;
  metadata?: AxeAuditMetadata;
  status: "skipped" | "not-applicable";
  reason: string;
};

export type AxePathAuditItemInput =
  | AxePathAuditAuditedItemInput
  | AxePathAuditUnauditedItemInput;

export type AxePathAuditReportInput = {
  reportId: string;
  createdAt?: string;
  metadata?: AxeAuditMetadata;
  items: AxePathAuditItemInput[];
};
