import { fail, jsonBody, ok } from "@/lib/domain/api-contract";
import { profileFor, store } from "@/lib/server/local-store";
import { verifyOtp } from "@/lib/server/otp";
import { getDataAdapter } from "@/lib/server/data-adapter";

export async function POST(request: Request) {
  const body = await jsonBody(request);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const code = typeof body?.code === "string" ? body.code : "";
  const adapter = getDataAdapter();
  if (adapter.mode === "supabase") {
    try {
      const session = await adapter.verifyEmailOtp(email, code);
      return Response.json(ok({ user: { id: session.userId, name: email.split("@")[0], email: session.email }, session: { userId: session.userId, accessToken: session.accessToken, refreshToken: session.refreshToken, expiresAt: new Date(Date.now() + 3_600_000).toISOString() } }));
    } catch { return fail("AUTH_INVALID", "验证码无效或已过期", 401); }
  }
  if (!verifyOtp(store.otp, email, code).ok) return fail("AUTH_INVALID", "验证码无效或已过期", 401);
  const userId = store.emailToUser.get(email) ?? `user-${Buffer.from(email).toString("hex").slice(0, 20)}`;
  store.emailToUser.set(email, userId);
  const profile = profileFor(userId);
  profile.email = email;
  return Response.json(ok({ user: { id: profile.id, name: profile.displayName, email: profile.email, avatarUrl: profile.avatarUrl }, session: { userId, expiresAt: new Date(Date.now() + 86_400_000).toISOString() } }));
}
