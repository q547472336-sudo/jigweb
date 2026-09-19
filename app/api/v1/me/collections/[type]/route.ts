import { fail, ok } from "@/lib/domain/api-contract";
import { puzzleSummary } from "@/lib/server/puzzle-summary";
import { getUser, store } from "@/lib/server/local-store";

export async function GET(request: Request, { params }: { params: Promise<{ type: string }> }) {
  const userId = getUser(request);
  if (!userId) return fail("AUTH_REQUIRED", "请先登录", 401);
  const { type } = await params;
  let ids: string[];
  if (type === "works") ids = [...store.puzzles.values()].filter((puzzle) => puzzle.ownerId === userId).map((puzzle) => puzzle.id);
  else if (type === "favorites") ids = [...store.puzzles.values()].filter((puzzle) => puzzle.favoriteBy.has(userId)).map((puzzle) => puzzle.id);
  else if (type === "completed") ids = [...(store.completed.get(userId)?.keys() ?? [])];
  else if (type === "recent") ids = [...(store.recent.get(userId)?.entries() ?? [])].sort((a, b) => b[1].localeCompare(a[1])).map(([id]) => id);
  else return fail("NOT_FOUND", "个人列表不存在", 404);
  const items = ids.map((id) => store.puzzles.get(id)).filter((puzzle) => puzzle && puzzle.status === "published").map((puzzle) => puzzleSummary(puzzle!, userId));
  return Response.json(ok({ items, page: 1, pageSize: 24, hasMore: false, total: items.length }));
}
