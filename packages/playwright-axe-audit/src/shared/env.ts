export function isAxeStrict(): boolean {
  const value = process.env.AXE_STRICT?.toLowerCase();

  return value === "1" || value === "true";
}
