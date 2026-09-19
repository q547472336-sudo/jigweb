import type { ChallengeAttempt, DailyChallenge, Piece } from "./types.ts";
import { businessDate, store } from "./local-store.ts";

export function attemptIdentity(attempt: Pick<ChallengeAttempt, "userId" | "guestId">) {
  return attempt.userId ?? attempt.guestId;
}

export function challengeAttemptFor(challengeId: string, userId: string | null, guestId: string | null) {
  return [...store.challengeAttempts.values()]
    .filter((attempt) => attempt.challengeId === challengeId && (userId ? attempt.userId === userId : attempt.guestId === guestId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}

export function expireChallengeAttempt(attempt: ChallengeAttempt, challenge: DailyChallenge, now = new Date()) {
  if (attempt.status !== "completed" && attempt.status !== "expired" && challenge.businessDate !== businessDate(now)) {
    attempt.status = "expired";
    attempt.elapsedMs = null;
    attempt.activeSince = null;
    attempt.pauseStartedAt = null;
    attempt.updatedAt = now.toISOString();
  }
  return attempt;
}

export function currentElapsedMs(attempt: Pick<ChallengeAttempt, "startedAt" | "activeSince" | "pausedMs" | "elapsedMs" | "status">, now = new Date()) {
  if (attempt.elapsedMs !== null) return Math.max(0, attempt.elapsedMs);
  if (!attempt.startedAt) return 0;
  const startedAt = Date.parse(attempt.startedAt);
  return Math.max(0, now.getTime() - startedAt - attempt.pausedMs);
}

export function validChallengePieces(pieces: unknown, challenge: DailyChallenge, requireComplete = false): pieces is Piece[] {
  if (!Array.isArray(pieces) || pieces.length !== challenge.rows * challenge.columns) return false;
  const ids = new Set<string>();
  for (const candidate of pieces) {
    const piece = candidate as Partial<Piece>;
    const index = piece.index;
    if (typeof index !== "number" || !Number.isInteger(index) || typeof piece.id !== "string" || ids.has(piece.id) || piece.id !== `piece-${index}`) return false;
    if (index < 0 || index >= pieces.length) return false;
    if (piece.row !== Math.floor(index / challenge.columns) || piece.column !== index % challenge.columns) return false;
    if (!piece.fixed && !["left", "right", "board"].includes(piece.tray ?? "")) return false;
    if (typeof piece.fixed !== "boolean" || !Number.isFinite(piece.x) || !Number.isFinite(piece.y)) return false;
    if (piece.fixed && (piece.tray !== "board" || Math.abs((piece.x ?? 0) - piece.column / challenge.columns) > 0.001 || Math.abs((piece.y ?? 0) - piece.row / challenge.rows) > 0.001)) return false;
    if (requireComplete && !piece.fixed) return false;
    ids.add(piece.id);
  }
  return ids.size === pieces.length;
}

export function publicChallengeAttempt(attempt: ChallengeAttempt, now = new Date()) {
  return {
    id: attempt.id,
    challengeId: attempt.challengeId,
    mode: attempt.mode,
    status: attempt.status,
    pieces: attempt.pieces,
    startedAt: attempt.startedAt,
    elapsedMs: currentElapsedMs(attempt, now),
    pausedMs: attempt.pausedMs,
    completedAt: attempt.completedAt,
    stateVersion: attempt.stateVersion,
    updatedAt: attempt.updatedAt,
  };
}
