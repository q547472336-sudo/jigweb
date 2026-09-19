import { fail, ok } from "@/lib/domain/api-contract";
import { publicChallengeAttempt, challengeAttemptFor, expireChallengeAttempt } from "@/lib/server/challenge";
import { ensureDailyChallenge, getGuest, getUser, store } from "@/lib/server/local-store";
import { puzzleSummary } from "@/lib/server/puzzle-summary";

export async function GET(request: Request) {
  const challenge = ensureDailyChallenge();
  const puzzle = store.puzzles.get(challenge.puzzleId);
  if (!puzzle || challenge.status !== "open") return Response.json(ok({ challenge: { ...challenge, status: challenge.status }, puzzle: null, attempt: null }));
  const userId = getUser(request); const guestId = userId ? null : getGuest(request);
  const attempt = challengeAttemptFor(challenge.id, userId, guestId);
  if (attempt) expireChallengeAttempt(attempt, challenge);
  return Response.json(ok({ challenge, puzzle: puzzleSummary(puzzle, userId ?? guestId), attempt: attempt ? publicChallengeAttempt(attempt) : null }));
}
