import { type Locator, type Page } from "@playwright/test";

import { queryAxeNodeDomMatch } from "./dom-query.js";
import { type AxeNodeMatch } from "./types.js";
import { type AxeDomStatus } from "../shared/types.js";

export async function resolveAxeNodeMatch(
  page: Page,
  selector: string,
  html: string
): Promise<AxeNodeMatch> {
  const domMatch = await queryAxeNodeDomMatch(page, selector, html);

  if (domMatch.matchCount === 0) {
    return {
      matchCount: domMatch.matchCount,
      visible: false
    };
  }

  if (domMatch.matchedIndex === undefined) {
    return {
      matchCount: domMatch.matchCount,
      visible: false
    };
  }

  const matchedLocator = page.locator(selector).nth(domMatch.matchedIndex);

  return {
    matchCount: domMatch.matchCount,
    matchedIndex: domMatch.matchedIndex,
    locator: matchedLocator,
    visible: await isVisible(matchedLocator)
  };
}

export function domStatusForMatch(match: AxeNodeMatch): AxeDomStatus {
  if (match.locator) {
    return "matched";
  }

  return match.matchCount === 0 ? "not-found" : "ambiguous";
}

export function domStatusReasonForMatch(match: AxeNodeMatch): string {
  if (match.locator) {
    return "Axe target resolved to one DOM node during evidence collection after axe analysis.";
  }

  if (match.matchCount === 0) {
    return "Axe target was not present in the DOM when evidence was collected after axe analysis. Use the axe HTML below as the captured node snapshot.";
  }

  return "Axe target matched multiple DOM nodes and the axe HTML did not identify exactly one current node.";
}

async function isVisible(locator: Locator): Promise<boolean> {
  try {
    return await locator.isVisible();
  } catch {
    return false;
  }
}
