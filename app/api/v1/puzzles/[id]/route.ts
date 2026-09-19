import { fail, ok } from "@/lib/domain/api-contract";
import { getUser, store } from "@/lib/server/local-store";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const puzzle = store.puzzles.get(id); const userId = getUser(request);
  if (!puzzle || puzzle.status !== "published" || (puzzle.visibility === "private" && puzzle.ownerId !== userId)) return fail("NOT_FOUND", "作品不存在或已下线", 404);
  return Response.json(ok({ ...puzzle, favorite: userId ? puzzle.favoriteBy.has(userId) : false, favoriteBy: undefined }));
}
