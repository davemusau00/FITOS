/**
 * A small, dependency-free normalizer for the first Kenyan pilot. It accepts
 * E.164 input, Kenyan local forms, and leaves other international numbers in
 * E.164 when they are already explicit. A full libphonenumber adapter can
 * replace this at the integration boundary without changing API contracts.
 */
export function normalizePhone(input: string | null | undefined, defaultCountryCode = "KE"): string | null {
  if (!input) {
    return null;
  }

  const compact = input.trim().replace(/[\s().-]/g, "");
  if (!compact) {
    return null;
  }

  if (/^\+\d{7,15}$/.test(compact)) {
    return compact;
  }

  if (defaultCountryCode === "KE") {
    if (/^0[17]\d{8}$/.test(compact)) {
      return `+254${compact.slice(1)}`;
    }
    if (/^254[17]\d{8}$/.test(compact)) {
      return `+${compact}`;
    }
  }

  return null;
}
