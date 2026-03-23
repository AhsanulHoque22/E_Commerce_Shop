import { randomUUID } from "crypto";

export function newPublicId(prefix: string): string {
  const id = randomUUID().replace(/-/g, "");
  return `${prefix}_${id}`;
}
