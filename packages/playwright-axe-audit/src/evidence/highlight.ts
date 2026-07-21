import { type Locator, type Page } from "@playwright/test";

export const axeHighlightAttribute = "data-axe-highlight";
const axeHighlightStyleId = "axe-audit-highlight-style";

export async function installHighlightStyle(page: Page): Promise<boolean> {
  try {
    await page.evaluate(
      ([styleId, attribute]) => {
        if (document.getElementById(styleId)) {
          return;
        }

        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `
          [${attribute}] {
            outline: 4px solid #d93025 !important;
            outline-offset: 2px !important;
            box-shadow: 0 0 0 6px rgba(217, 48, 37, 0.28) !important;
          }
          [${attribute}]::after {
            content: attr(${attribute});
          }
        `;
        document.head.append(style);
      },
      [axeHighlightStyleId, axeHighlightAttribute] as const
    );

    return true;
  } catch {
    return false;
  }
}

export async function markLocator(
  locator: Locator,
  violationId: string,
  timeoutMs: number
): Promise<void> {
  await locator.evaluate(
    (element, [attribute, value]) => {
      element.setAttribute(attribute, value);
    },
    [axeHighlightAttribute, violationId] as const,
    { timeout: timeoutMs }
  );
}

export async function clearViolationHighlights(page: Page): Promise<void> {
  try {
    await page.evaluate((attribute) => {
      for (const element of document.querySelectorAll(`[${attribute}]`)) {
        element.removeAttribute(attribute);
      }
    }, axeHighlightAttribute);
  } catch {
    return;
  }
}
