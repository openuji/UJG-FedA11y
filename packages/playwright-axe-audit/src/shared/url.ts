export function urlPath(value: string): string {
  try {
    const url = new URL(value);

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return value;
  }
}
