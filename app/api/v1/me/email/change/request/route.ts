import { fail, jsonBody, ok } from "@/lib/domain/api-contract";
import { getUser, profileFor, store } from "@/lib/server/local-store";
import { requestOtpPair } from "@/lib/server/otp";

export async function POST(request: Request) {
  const userId = getUser(request); if (!userId) return fail("AUTH_REQUIRED", "请先登录", 401);
  const body = await jsonBody(request); const newEmail = typeof body?.newEmail === "string" ? body.newEmail.trim().toLowerCase() : "";
  if (!/^\S+@\S+\.\S+$/.test(newEmail)) return fail("VALIDATION_ERROR", "请输入有效的新邮箱", 422, false, "newEmail");
  const profile = profileFor(userId); const oldEmail = profile.email.toLowerCase();
  if (newEmail === oldEmail) return fail("VALIDATION_ERROR", "新邮箱不能与当前邮箱相同", 422, false, "newEmail");
  const owner = store.emailToUser.get(newEmail); if (owner && owner !== userId) return fail("AUTH_INVALID", "该邮箱不能用于当前账户", 409);
  const code = process.env.LOCAL_OTP_CODE ?? "000000";
  const result = requestOtpPair(store.otp, [{ email: oldEmail, code }, { email: newEmail, code }]);
  if (!result.ok) return fail("RATE_LIMITED", "请稍后再试", 429, true);
  store.emailChanges.set(userId, { oldEmail, newEmail, expiresAt: Date.now() + 600_000 });
  return Response.json(ok({ expiresAt: new Date(Date.now() + 600_000).toISOString(), developmentOldCode: process.env.NODE_ENV === "production" ? undefined : code, developmentNewCode: process.env.NODE_ENV === "production" ? undefined : code }));
}
