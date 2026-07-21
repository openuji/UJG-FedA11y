import { type Page } from "@playwright/test";

import { type AxeDomMatch } from "./types.js";
import { type AxeNode } from "../shared/types.js";

export function primarySelector(node: AxeNode): string | undefined {
  const target = node.target[0];

  return typeof target === "string" ? target : undefined;
}

export function stringTargets(node: AxeNode): string[] {
  return node.target.filter((target): target is string => typeof target === "string");
}

export function cssQuery(selector: string): string {
  return `document.querySelectorAll(${JSON.stringify(selector)})`;
}

export async function queryAxeNodeDomMatch(
  page: Page,
  selector: string,
  html: string
): Promise<AxeDomMatch> {
  try {
    return await page.evaluate(([targetSelector, expectedHtml]) => {
      const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
      const elements = Array.from(document.querySelectorAll(targetSelector));
      const matchCount = elements.length;

      if (matchCount === 0) {
        return {
          matchCount
        };
      }

      if (matchCount === 1) {
        return {
          matchCount,
          matchedIndex: 0
        };
      }

      const exactMatches = elements
        .map((element, index) => ({ index, html: element.outerHTML }))
        .filter((item) => item.html === expectedHtml);

      if (exactMatches.length === 1) {
        return {
          matchCount,
          matchedIndex: exactMatches[0].index
        };
      }

      const normalizedExpectedHtml = normalize(expectedHtml);
      const normalizedMatches = elements
        .map((element, index) => ({ index, html: normalize(element.outerHTML) }))
        .filter((item) => item.html === normalizedExpectedHtml);

      return {
        matchCount,
        matchedIndex: normalizedMatches.length === 1 ? normalizedMatches[0].index : undefined
      };
    }, [selector, html] as const);
  } catch {
    return {
      matchCount: 0
    };
  }
}
