import { fail, jsonBody, ok } from "@/lib/domain/api-contract";
import { challengeAttemptFor, currentElapsedMs, expireChallengeAttempt, publicChallengeAttempt } from "@/lib/server/challenge";
import { ensureDailyChallenge, getGuest, getUser, store } from "@/lib/server/local-store";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const attempt = store.challengeAttempts.get((await params).id); const userId = getUser(request); const guestId = userId ? null : getGuest(request);
  if (!attempt || !((attempt.userId && attempt.userId === userId) || (attempt.guestId && attempt.guestId === guestId))) return fail("NOT_FOUND", "挑战局不存在", 404);
  const challenge = store.dailyChallenges.get(attempt.challengeId) ?? ensureDailyChallenge(); expireChallengeAttempt(attempt, challenge);
  if (attempt.status === "expired") return fail("CHALLENGE_EXPIRED", "昨日挑战已结束", 409);
  if (!["active", "paused"].includes(attempt.status)) return Response.json(ok({ attempt: publicChallengeAttempt(attempt), replay: true }));
  const body = await jsonBody(request); const resume = body?.action === "resume";
  const now = new Date();
  if (resume && attempt.status === "paused") {
    attempt.pausedMs += Math.max(0, now.getTime() - Date.parse(attempt.pauseStartedAt ?? now.toISOString()));
    attempt.pauseStartedAt = null; attempt.activeSince = now.toISOString(); attempt.status = "active"; attempt.elapsedMs = null;
  } else if (!resume && attempt.status === "active") {
    attempt.elapsedMs = currentElapsedMs(attempt, now); attempt.pauseStartedAt = now.toISOString(); attempt.activeSince = null; attempt.status = "paused";
  }
  attempt.updatedAt = now.toISOString(); attempt.stateVersion += 1;
  return Response.json(ok({ attempt: publicChallengeAttempt(attempt) }));
}
