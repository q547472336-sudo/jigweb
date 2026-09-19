import { fail, jsonBody, ok } from "@/lib/domain/api-contract";
import { challengeAttemptFor, publicChallengeAttempt } from "@/lib/server/challenge";
import { ensureDailyChallenge, getGuest, getUser, store, createPieces } from "@/lib/server/local-store";

export async function POST(request: Request) {
  const body = await jsonBody(request); const challengeId = typeof body?.challengeId === "string" ? body.challengeId : "";
  const challenge = ensureDailyChallenge();
  if (challenge.status !== "open" || challengeId !== challenge.id) return fail("CHALLENGE_NOT_OPEN", "今日挑战暂未开放", 409);
  const userId = getUser(request); const guestId = userId ? null : getGuest(request); if (!userId && !guestId) return fail("VALIDATION_ERROR", "缺少访客标识", 422);
  const existing = challengeAttemptFor(challenge.id, userId, guestId);
  if (existing && !["expired", "abandoned"].includes(existing.status)) return Response.json(ok({ attempt: publicChallengeAttempt(existing), replay: true }));
  const mode = userId && body?.mode === "formal" ? "formal" as const : "practice" as const;
  const now = new Date().toISOString();
  const attempt = { id: `attempt-${crypto.randomUUID()}`, challengeId: challenge.id, userId, guestId, mode, status: "ready" as const, pieces: createPieces(challenge.rows, challenge.columns), startedAt: null, activeSince: null, pauseStartedAt: null, pausedMs: 0, elapsedMs: null, completedAt: null, eventCursor: 0, stateVersion: 1, updatedAt: now };
  store.challengeAttempts.set(attempt.id, attempt);
  return Response.json(ok({ attempt: publicChallengeAttempt(attempt), replay: false }), { status: 201 });
}
