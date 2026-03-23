/** Dial codes for the registration / OTP phone field (extend as needed). */
export const PHONE_DIAL_OPTIONS: { code: string; label: string }[] = [
  { code: "+880", label: "Bangladesh (+880)" },
  { code: "+1", label: "United States / Canada (+1)" },
  { code: "+44", label: "United Kingdom (+44)" },
  { code: "+91", label: "India (+91)" },
  { code: "+966", label: "Saudi Arabia (+966)" },
  { code: "+971", label: "United Arab Emirates (+971)" },
  { code: "+60", label: "Malaysia (+60)" },
  { code: "+65", label: "Singapore (+65)" },
  { code: "+61", label: "Australia (+61)" },
  { code: "+86", label: "China (+86)" },
  { code: "+81", label: "Japan (+81)" },
  { code: "+82", label: "South Korea (+82)" },
  { code: "+49", label: "Germany (+49)" },
  { code: "+33", label: "France (+33)" },
];

const DEFAULT_DIAL = "+880";

/**
 * Combine country dial code and national number into E.164 (+…).
 * Strips a leading trunk `0` from the national part (common for BD, UK, etc.).
 */
export function buildE164(dialCode: string, nationalRaw: string): string {
  const dialDigits = dialCode.replace(/\D/g, "");
  let n = nationalRaw.replace(/\D/g, "");
  if (!dialDigits || !n) {
    return "";
  }
  if (n.startsWith("0")) {
    n = n.slice(1);
  }
  if (!n) {
    return "";
  }
  return `+${dialDigits}${n}`;
}

export function isPlausibleE164(e164: string): boolean {
  const digits = e164.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

export { DEFAULT_DIAL };
