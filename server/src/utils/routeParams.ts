export function paramString(v: string | string[] | undefined): string {
  if (typeof v === "string") {
    return v;
  }
  if (Array.isArray(v) && v[0]) {
    return v[0];
  }
  return "";
}
