import { fail, jsonBody, ok } from "@/lib/domain/api-contract";
import { challengeAttemptFor, currentElapsedMs, expireChallengeAttempt, publicChallengeAttempt, validChallengePieces } from "@/lib/server/challenge";
import { ensureDailyChallenge, getGuest, getUser, store } from "@/lib/server/local-store";

function owned(request: Request, attempt: { userId: string | null; guestId: string | null }) {
  return (attempt.userId && attempt.userId === getUser(request)) || (attempt.guestId && attempt.guestId === getGuest(request));
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const attempt = store.challengeAttempts.get((await params).id); if (!attempt || !owned(request, attempt)) return fail("NOT_FOUND", "挑战局不存在", 404);
  const challenge = store.dailyChallenges.get(attempt.challengeId) ?? ensureDailyChallenge(); expireChallengeAttempt(attempt, challenge);
  return Response.json(ok({ attempt: publicChallengeAttempt(attempt) }));
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const attempt = store.challengeAttempts.get((await params).id); if (!attempt || !owned(request, attempt)) return fail("NOT_FOUND", "挑战局不存在", 404);
  const challenge = store.dailyChallenges.get(attempt.challengeId) ?? ensureDailyChallenge(); expireChallengeAttempt(attempt, challenge);
  if (attempt.status === "expired" || attempt.status === "completed") return fail("CHALLENGE_EXPIRED", "本局挑战已结束", 409);
  if (attempt.status !== "active" && attempt.status !== "paused") return fail("VALIDATION_ERROR", "当前状态不能保存棋盘", 409);
  const body = await jsonBody(request); if (Number(body?.stateVersion) !== attempt.stateVersion || !validChallengePieces(body?.pieces, challenge)) return fail(Number(body?.stateVersion) !== attempt.stateVersion ? "VERSION_CONFLICT" : "VALIDATION_ERROR", Number(body?.stateVersion) !== attempt.stateVersion ? "挑战局已有更新" : "棋盘快照格式错误", Number(body?.stateVersion) !== attempt.stateVersion ? 409 : 422, true);
  attempt.pieces = body!.pieces as typeof attempt.pieces; attempt.stateVersion += 1; attempt.eventCursor += 1; attempt.updatedAt = new Date().toISOString();
  return Response.json(ok({ attempt: publicChallengeAttempt(attempt) }));
}
