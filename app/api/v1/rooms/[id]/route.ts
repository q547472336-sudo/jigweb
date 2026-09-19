import { fail, ok } from "@/lib/domain/api-contract";
import { getUser, store, roomMember } from "@/lib/server/local-store";
import { expireRoom, publicRoom } from "@/lib/server/room";
import { puzzleSummary } from "@/lib/server/puzzle-summary";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const room = store.rooms.get((await params).id); if (!room) return fail("NOT_FOUND", "房间不存在", 404);
  expireRoom(room); const userId = getUser(request); const member = userId ? roomMember(room.id, userId) : undefined; if (member) member.lastSeenAt = new Date().toISOString();
  if (room.status === "ended" && !member) return fail("ROOM_ENDED", "房间已结束", 410);
  const puzzle = store.puzzles.get(room.puzzleId); if (!puzzle) return fail("NOT_FOUND", "作品不存在", 404);
  return Response.json(ok({ room: publicRoom(room, userId), puzzle: puzzleSummary(puzzle, userId) }));
}
