/**
 * Normalize user phone input to a stable unique form (E.164-style, no spaces).
 * Optimized for Bangladesh mobile patterns; falls back to digits with leading +.
 */
export function normalizePhone(input: string): string {
  const raw = input.trim();
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 0) {
    return "";
  }
  if (raw.startsWith("+")) {
    return `+${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("01")) {
    return `+880${digits.slice(1)}`;
  }
  if (digits.length === 10 && digits.startsWith("1")) {
    return `+880${digits}`;
  }
  if (digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }
  return `+${digits}`;
}

export function isEmailIdentifier(s: string): boolean {
  return s.trim().includes("@");
}
