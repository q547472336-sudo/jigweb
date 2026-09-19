import assert from "node:assert/strict";
import test from "node:test";
import { requestOtp, requestOtpPair, verifyOtp, verifyOtpPair } from "./otp.ts";
import type { OtpEntry } from "./types.ts";

test("OTP expires in ten minutes and a new request invalidates the old code", () => {
  const entries = new Map<string, OtpEntry>();
  const start = 1_000_000;
  assert.equal(requestOtp(entries, "a@example.com", "111111", start).ok, true);
  assert.equal(requestOtp(entries, "a@example.com", "222222", start + 60_000).ok, true);
  assert.equal(verifyOtp(entries, "a@example.com", "111111", start + 61_000).ok, false);
  assert.equal(verifyOtp(entries, "a@example.com", "222222", start + 61_000).ok, true);
  assert.equal(verifyOtp(entries, "a@example.com", "222222", start + 62_000).ok, false);
});

test("OTP enforces resend, hourly send, and failed-attempt limits", () => {
  const entries = new Map<string, OtpEntry>();
  const email = "b@example.com";
  const start = 5_000_000;
  assert.equal(requestOtp(entries, email, "000000", start).ok, true);
  assert.deepEqual(requestOtp(entries, email, "000000", start + 1_000), { ok: false, reason: "resend", retryAt: start + 60_000 });
  for (let index = 1; index < 5; index += 1) assert.equal(requestOtp(entries, email, "000000", start + index * 60_000).ok, true);
  const limited = requestOtp(entries, email, "000000", start + 5 * 60_000);
  assert.equal(limited.ok, false);
  for (let index = 0; index < 5; index += 1) assert.equal(verifyOtp(entries, email, "123456", start + 301_000 + index).ok, false);
  assert.equal(verifyOtp(entries, email, "000000", start + 302_000).ok, false);
  assert.equal(requestOtp(entries, email, "000000", start + 360_000).ok, false);
});

test("email change sends and verifies both codes atomically", () => {
  const entries = new Map<string, OtpEntry>();
  const start = 9_000_000;
  assert.equal(requestOtpPair(entries, [{ email: "old@example.com", code: "111111" }, { email: "new@example.com", code: "222222" }], start).ok, true);
  assert.equal(verifyOtpPair(entries, [{ email: "old@example.com", code: "111111" }, { email: "new@example.com", code: "999999" }], start + 1).ok, false);
  assert.equal(verifyOtp(entries, "old@example.com", "111111", start + 2).ok, true);
  assert.equal(verifyOtp(entries, "new@example.com", "222222", start + 2).ok, true);
});
