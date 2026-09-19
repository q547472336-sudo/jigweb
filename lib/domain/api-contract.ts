export type ApiErrorCode =
  | "AUTH_REQUIRED" | "AUTH_INVALID" | "FORBIDDEN" | "NOT_FOUND"
  | "PUZZLE_UNAVAILABLE" | "VALIDATION_ERROR" | "VERSION_CONFLICT"
  | "IDEMPOTENCY_REPLAY" | "RATE_LIMITED" | "UPLOAD_FAILED"
  | "SAVE_FAILED" | "CHALLENGE_NOT_OPEN" | "CHALLENGE_EXPIRED" | "ROOM_FULL" | "ROOM_ENDED"
  | "LOCK_TAKEN" | "LOCK_EXPIRED" | "STALE_EVENT"
  | "INTERNAL_ERROR";

export type ApiError = { error: { code: ApiErrorCode; message: string; retryable: boolean; field?: string | null }; requestId: string };
export type ApiSuccess<T> = { data: T; requestId: string };

export function requestId() { return `req_${crypto.randomUUID()}`; }
export function ok<T>(data: T): ApiSuccess<T> { return { data, requestId: requestId() }; }
export function fail(code: ApiErrorCode, message: string, status = 400, retryable = false, field: string | null = null) {
  return Response.json({ error: { code, message, retryable, field }, requestId: requestId() } satisfies ApiError, { status });
}
export async function jsonBody(request: Request) {
  try { return await request.json() as Record<string, unknown>; } catch { return null; }
}
