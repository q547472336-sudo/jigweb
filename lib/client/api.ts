export type ApiEnvelope<T> = { data: T; requestId: string };
export type ApiFailure = { error: { code: string; message: string; retryable: boolean; field?: string | null }; requestId: string };

const GUEST_KEY = "jigsaw-time-guest-id";

export function guestId() {
  if (typeof window === "undefined") return "";
  const existing = localStorage.getItem(GUEST_KEY);
  if (existing) return existing;
  const value = `guest-${crypto.randomUUID()}`;
  localStorage.setItem(GUEST_KEY, value);
  return value;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}, userId?: string | null): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (userId) headers.set("x-user-id", userId);
  else if (typeof window !== "undefined") headers.set("x-guest-id", guestId());
  const response = await fetch(`/api/v1${path}`, { ...options, headers });
  const result = await response.json() as ApiEnvelope<T> | ApiFailure;
  if (!response.ok || "error" in result) {
    const failure = result as ApiFailure;
    throw new Error(failure.error?.message ?? "请求失败");
  }
  return result.data;
}
