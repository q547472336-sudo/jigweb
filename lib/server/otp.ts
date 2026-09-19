import type { OtpEntry } from "./types";

const HOUR = 60 * 60 * 1000;
const EXPIRY = 10 * 60 * 1000;
const RESEND = 60 * 1000;

export type OtpRequestResult =
  | { ok: true; entry: OtpEntry }
  | { ok: false; reason: "resend" | "hourly_limit"; retryAt: number };

export function requestOtp(
  entries: Map<string, OtpEntry>,
  email: string,
  code: string,
  currentTime = Date.now(),
): OtpRequestResult {
  const previous = entries.get(email);
  const sentAt = (previous?.sentAt ?? []).filter((time) => currentTime - time < HOUR);
  if (previous && currentTime < previous.resendAt) return { ok: false, reason: "resend", retryAt: previous.resendAt };
  if (sentAt.length >= 5) return { ok: false, reason: "hourly_limit", retryAt: sentAt[0] + HOUR };
  const entry = { code, expiresAt: currentTime + EXPIRY, resendAt: currentTime + RESEND, failedAttempts: 0, sentAt: [...sentAt, currentTime] };
  entries.set(email, entry);
  return { ok: true, entry };
}

export function requestOtpPair(
  entries: Map<string, OtpEntry>,
  requests: Array<{ email: string; code: string }>,
  currentTime = Date.now(),
) {
  const normalized = requests.map((item) => item.email.trim().toLowerCase());
  const unique = [...new Set(normalized)];
  for (const email of unique) {
    const previous = entries.get(email);
    const sentAt = (previous?.sentAt ?? []).filter((time) => currentTime - time < HOUR);
    if (previous && currentTime < previous.resendAt) return { ok: false as const, reason: "resend" as const, retryAt: previous.resendAt };
    if (sentAt.length >= 5) return { ok: false as const, reason: "hourly_limit" as const, retryAt: sentAt[0] + HOUR };
  }
  const created = requests.map((item) => {
    const result = requestOtp(entries, item.email.trim().toLowerCase(), item.code, currentTime);
    if (!result.ok) throw new Error("OTP pair reservation changed during request");
    return result;
  });
  return { ok: true as const, entries: created.map((result) => result.entry) };
}

export function verifyOtp(entries: Map<string, OtpEntry>, email: string, code: string, currentTime = Date.now()) {
  const entry = entries.get(email);
  if (!entry || currentTime > entry.expiresAt || entry.failedAttempts >= 5 || !/^\d{6}$/.test(code)) {
    return { ok: false as const };
  }
  if (entry.code !== code) {
    entry.failedAttempts += 1;
    if (entry.failedAttempts >= 5) { entry.code = ""; entry.expiresAt = 0; }
    return { ok: false as const };
  }
  entry.code = ""; entry.expiresAt = 0; entry.failedAttempts = 5;
  return { ok: true as const };
}

export function verifyOtpPair(
  entries: Map<string, OtpEntry>,
  requests: Array<{ email: string; code: string }>,
  currentTime = Date.now(),
) {
  const normalized = requests.map((item) => ({ email: item.email.trim().toLowerCase(), code: item.code }));
  const valid = normalized.every(({ email, code }) => {
    const entry = entries.get(email);
    return Boolean(entry && currentTime <= entry.expiresAt && entry.failedAttempts < 5 && /^\d{6}$/.test(code) && entry.code === code);
  });
  if (!valid) {
    for (const { email, code } of normalized) {
      const entry = entries.get(email);
      if (entry && entry.code !== code && currentTime <= entry.expiresAt && entry.failedAttempts < 5) {
        entry.failedAttempts += 1;
        if (entry.failedAttempts >= 5) { entry.code = ""; entry.expiresAt = 0; }
      }
    }
    return { ok: false as const };
  }
  for (const { email } of normalized) {
    const entry = entries.get(email)!;
    entry.code = "";
    entry.expiresAt = 0;
    entry.failedAttempts = 5;
  }
  return { ok: true as const };
}
