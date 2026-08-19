export function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export function redactIdentifier(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if (value.length <= 4) {
    return "****";
  }
  return `${"*".repeat(Math.min(value.length - 4, 12))}${value.slice(-4)}`;
}
