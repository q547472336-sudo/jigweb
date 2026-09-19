import { fail, ok } from "@/lib/domain/api-contract";
import { getUser, store } from "@/lib/server/local-store";

async function change(request: Request, { params }: { params: Promise<{ id: string }> }, add: boolean) {
  const userId = getUser(request); if (!userId) return fail("AUTH_REQUIRED", "请先登录", 401); const { id } = await params; const puzzle = store.puzzles.get(id);
  if (!puzzle || puzzle.status !== "published" || (puzzle.visibility === "private" && puzzle.ownerId !== userId)) return fail("NOT_FOUND", "作品不存在或已下线", 404);
  add ? puzzle.favoriteBy.add(userId) : puzzle.favoriteBy.delete(userId); return Response.json(ok({ favorite: add, count: puzzle.favoriteBy.size }));
}
export function POST(request: Request, context: { params: Promise<{ id: string }> }) { return change(request, context, true); }
export function DELETE(request: Request, context: { params: Promise<{ id: string }> }) { return change(request, context, false); }
