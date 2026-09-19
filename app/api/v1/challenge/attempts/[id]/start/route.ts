import { fail, ok } from "@/lib/domain/api-contract";
import { challengeAttemptFor, expireChallengeAttempt, publicChallengeAttempt } from "@/lib/server/challenge";
import { ensureDailyChallenge, getGuest, getUser, store } from "@/lib/server/local-store";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const attempt = store.challengeAttempts.get((await params).id); const userId = getUser(request); const guestId = userId ? null : getGuest(request);
  if (!attempt || !((attempt.userId && attempt.userId === userId) || (attempt.guestId && attempt.guestId === guestId))) return fail("NOT_FOUND", "挑战局不存在", 404);
  const challenge = store.dailyChallenges.get(attempt.challengeId) ?? ensureDailyChallenge(); expireChallengeAttempt(attempt, challenge);
  if (attempt.status === "expired") return fail("CHALLENGE_EXPIRED", "昨日挑战已结束", 409);
  if (attempt.status === "completed") return Response.json(ok({ attempt: publicChallengeAttempt(attempt), replay: true }));
  if (attempt.status === "active") return Response.json(ok({ attempt: publicChallengeAttempt(attempt), replay: true }));
  if (attempt.status !== "ready") return fail("VALIDATION_ERROR", "当前状态不能开始挑战", 409);
  const now = new Date().toISOString();
  if (!attempt.startedAt) attempt.startedAt = now;
  attempt.activeSince = now; attempt.status = "active"; attempt.updatedAt = now; attempt.stateVersion += 1;
  return Response.json(ok({ attempt: publicChallengeAttempt(attempt), replay: false }));
}
