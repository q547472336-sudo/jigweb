import { fail, jsonBody, ok } from "@/lib/domain/api-contract";
import { store } from "@/lib/server/local-store";
import { requestOtp } from "@/lib/server/otp";
import { getDataAdapter } from "@/lib/server/data-adapter";

export async function POST(request: Request) {
  const body = await jsonBody(request);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail("VALIDATION_ERROR", "请输入有效邮箱", 422, false, "email");
  const adapter = getDataAdapter();
  if (adapter.mode === "supabase") {
    try { await adapter.requestEmailOtp(email); } catch { return fail("INTERNAL_ERROR", "邮件服务暂时不可用", 503, true); }
    return Response.json(ok({ expiresAt: new Date(Date.now() + 600_000).toISOString(), resendAt: new Date(Date.now() + 60_000).toISOString(), developmentCode: undefined }));
  }
  const code = process.env.LOCAL_OTP_CODE ?? "000000";
  const result = requestOtp(store.otp, email, code);
  if (!result.ok) return fail("RATE_LIMITED", result.reason === "hourly_limit" ? "该邮箱本小时发送次数已达上限" : "请稍后再试", 429, true);
  return Response.json(ok({
    expiresAt: new Date(result.entry.expiresAt).toISOString(),
    resendAt: new Date(result.entry.resendAt).toISOString(),
    developmentCode: process.env.NODE_ENV === "production" ? undefined : code,
  }));
}
