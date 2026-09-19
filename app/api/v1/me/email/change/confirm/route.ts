import { fail, jsonBody, ok } from "@/lib/domain/api-contract";
import { getUser, profileFor, store } from "@/lib/server/local-store";
import { verifyOtpPair } from "@/lib/server/otp";

export async function POST(request: Request) {
  const userId = getUser(request); if (!userId) return fail("AUTH_REQUIRED", "请先登录", 401);
  const pending = store.emailChanges.get(userId); const body = await jsonBody(request);
  if (!pending || Date.now() > pending.expiresAt) return fail("AUTH_INVALID", "邮箱更换请求无效或已过期", 401);
  const oldCode = typeof body?.oldCode === "string" ? body.oldCode : ""; const newCode = typeof body?.newCode === "string" ? body.newCode : "";
  if (!verifyOtpPair(store.otp, [{ email: pending.oldEmail, code: oldCode }, { email: pending.newEmail, code: newCode }]).ok) return fail("AUTH_INVALID", "验证码无效或已过期", 401);
  const owner = store.emailToUser.get(pending.newEmail); if (owner && owner !== userId) return fail("AUTH_INVALID", "该邮箱不能用于当前账户", 409);
  store.emailToUser.delete(pending.oldEmail); store.emailToUser.set(pending.newEmail, userId); profileFor(userId).email = pending.newEmail; store.emailChanges.delete(userId);
  return Response.json(ok({ email: pending.newEmail }));
}
