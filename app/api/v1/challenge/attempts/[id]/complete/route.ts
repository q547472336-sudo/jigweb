import { fail, jsonBody, ok } from "@/lib/domain/api-contract";
import { challengeAttemptFor, currentElapsedMs, expireChallengeAttempt, publicChallengeAttempt, validChallengePieces } from "@/lib/server/challenge";
import { ensureDailyChallenge, getGuest, getUser, profileFor, recordCompleted, store } from "@/lib/server/local-store";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const attempt = store.challengeAttempts.get((await params).id); const userId = getUser(request); const guestId = userId ? null : getGuest(request);
  if (!attempt || !((attempt.userId && attempt.userId === userId) || (attempt.guestId && attempt.guestId === guestId))) return fail("NOT_FOUND", "挑战局不存在", 404);
  const challenge = store.dailyChallenges.get(attempt.challengeId) ?? ensureDailyChallenge(); expireChallengeAttempt(attempt, challenge);
  if (attempt.status === "completed") return Response.json(ok({ completed: true, replay: true, attempt: publicChallengeAttempt(attempt) }));
  if (attempt.status === "expired") return fail("CHALLENGE_EXPIRED", "昨日挑战已结束", 409);
  const body = await jsonBody(request); const pieces = body?.pieces ?? attempt.pieces;
  if (!validChallengePieces(pieces, challenge, true)) return fail("VALIDATION_ERROR", "拼图尚未完成", 422);
  attempt.pieces = pieces; attempt.status = "completed"; attempt.completedAt = new Date().toISOString(); attempt.elapsedMs = currentElapsedMs(attempt); attempt.activeSince = null; attempt.stateVersion += 1; attempt.updatedAt = attempt.completedAt;
  if (userId && attempt.mode === "formal") {
    const key = `${challenge.id}:${userId}`; const best = store.challengeBests.get(key);
    if (!best || attempt.elapsedMs < best.elapsedMs) store.challengeBests.set(key, { challengeId: challenge.id, userId, attemptId: attempt.id, elapsedMs: attempt.elapsedMs, completedAt: attempt.completedAt });
  }
  const identity = userId ?? guestId; if (identity) recordCompleted(identity, challenge.puzzleId);
  return Response.json(ok({ completed: true, replay: false, attempt: publicChallengeAttempt(attempt), best: userId && attempt.mode === "formal" ? store.challengeBests.get(`${challenge.id}:${userId}`) ?? null : null }));
}
