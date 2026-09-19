import { fail, ok } from "@/lib/domain/api-contract";
import { getUser, roomMember, store } from "@/lib/server/local-store";
import { expireRoom, publicRoom } from "@/lib/server/room";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; pieceId: string }> }) {
  const userId = getUser(request); if (!userId) return fail("AUTH_REQUIRED", "请先登录", 401);
  const { id, pieceId } = await params; const room = store.rooms.get(id); if (!room) return fail("NOT_FOUND", "房间不存在", 404); expireRoom(room);
  if (!roomMember(id, userId)) return fail("FORBIDDEN", "你不是房间成员", 403);
  const body = await request.json().catch(() => ({})) as { leaseToken?: string }; const key = `${id}:${pieceId}`; const lock = store.pieceLocks.get(key);
  if (lock?.userId === userId && (!body.leaseToken || body.leaseToken === lock.leaseToken)) store.pieceLocks.delete(key);
  return Response.json(ok({ released: true, room: publicRoom(room, userId) }));
}
