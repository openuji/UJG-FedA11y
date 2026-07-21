import { type Locator } from "@playwright/test";

export type AxeDomMatch = {
  matchCount: number;
  matchedIndex?: number;
};

export type AxeNodeMatch = AxeDomMatch & {
  locator?: Locator;
  visible: boolean;
};

export type ScreenshotResult = {
  href?: string;
  error?: string;
};
