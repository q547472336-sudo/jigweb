import { ok } from "@/lib/domain/api-contract";
import { ensureDailyChallenge, profileFor, store } from "@/lib/server/local-store";

export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date") ?? ensureDailyChallenge().businessDate;
  const challenge = store.dailyChallenges.get(date);
  const items = challenge ? [...store.challengeBests.values()].filter((best) => best.challengeId === challenge.id).sort((a, b) => a.elapsedMs - b.elapsedMs || a.completedAt.localeCompare(b.completedAt) || a.userId.localeCompare(b.userId)).map((best, index) => ({ rank: index + 1, userId: best.userId, displayName: profileFor(best.userId).displayName, elapsedMs: best.elapsedMs, completedAt: best.completedAt })) : [];
  return Response.json(ok({ date, challengeId: challenge?.id ?? null, items, page: 1, pageSize: 50, hasMore: false, total: items.length }));
}
