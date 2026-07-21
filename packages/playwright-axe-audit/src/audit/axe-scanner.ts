import { AxeBuilder } from "@axe-core/playwright";
import { type Page } from "@playwright/test";

import { type AxeResults } from "../shared/types.js";

export function scanPage(page: Page, tags: readonly string[]): Promise<AxeResults> {
  return new AxeBuilder({ page }).withTags([...tags]).analyze();
}

export function scanSelector(
  page: Page,
  selector: string,
  tags: readonly string[]
): Promise<AxeResults> {
  return new AxeBuilder({ page })
    .include(selector)
    .withTags([...tags])
    .analyze();
}
