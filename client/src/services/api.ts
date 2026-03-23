const API_BASE = "";

export type ApiSuccess<T> = { success: true; data: T; message?: string };

function extractErrorMessage(
  res: Response,
  parsed: unknown,
  rawText: string
): string {
  if (parsed && typeof parsed === "object") {
    const o = parsed as Record<string, unknown>;
    if (typeof o.message === "string" && o.message.trim()) {
      return o.message;
    }
    if (typeof o.error === "string" && o.error.trim()) {
      return o.error;
    }
  }
  const hint = res.statusText?.trim() || `HTTP ${res.status}`;
  if (rawText && rawText.length < 500 && !rawText.trim().startsWith("<")) {
    try {
      const j = JSON.parse(rawText) as { message?: string };
      if (typeof j.message === "string" && j.message.trim()) {
        return j.message;
      }
    } catch {
      /* ignore */
    }
  }
  if (rawText.trim().startsWith("<")) {
    return `${hint}: server returned HTML (check API URL / proxy).`;
  }
  const tail = rawText ? `: ${rawText.slice(0, 200)}` : "";
  return `${hint}${tail}`;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const rawText = await res.text();
  let parsed: unknown = null;
  if (rawText) {
    try {
      parsed = JSON.parse(rawText) as unknown;
    } catch {
      parsed = null;
    }
  }

  const okPayload =
    parsed &&
    typeof parsed === "object" &&
    (parsed as ApiSuccess<T>).success === true;

  if (!res.ok || !okPayload) {
    throw new Error(extractErrorMessage(res, parsed, rawText));
  }
  return (parsed as ApiSuccess<T>).data;
}

/** PDF or binary download using session cookies (no JSON Content-Type). */
export async function downloadAuthenticatedFile(
  path: string,
  filename: string
): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) {
    const rawText = await res.text();
    let msg = res.statusText || `HTTP ${res.status}`;
    try {
      const j = JSON.parse(rawText) as { message?: string };
      if (typeof j.message === "string" && j.message.trim()) {
        msg = j.message;
      }
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function apiFetchForm<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    body: form,
    credentials: "include",
  });
  const rawText = await res.text();
  let parsed: unknown = null;
  if (rawText) {
    try {
      parsed = JSON.parse(rawText) as unknown;
    } catch {
      parsed = null;
    }
  }
  const okPayload =
    parsed &&
    typeof parsed === "object" &&
    (parsed as ApiSuccess<T>).success === true;
  if (!res.ok || !okPayload) {
    throw new Error(extractErrorMessage(res, parsed, rawText));
  }
  return (parsed as ApiSuccess<T>).data;
}
