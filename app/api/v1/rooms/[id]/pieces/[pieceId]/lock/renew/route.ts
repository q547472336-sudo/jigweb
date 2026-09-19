import { fail, ok } from "@/lib/domain/api-contract";
import { getUser, roomMember, store } from "@/lib/server/local-store";
import { expireRoom, PIECE_LOCK_MS, publicRoom } from "@/lib/server/room";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; pieceId: string }> }) {
  const userId = getUser(request); if (!userId) return fail("AUTH_REQUIRED", "请先登录", 401);
  const { id, pieceId } = await params; const room = store.rooms.get(id); if (!room) return fail("NOT_FOUND", "房间不存在", 404); expireRoom(room);
  if (room.status !== "active") return fail("ROOM_ENDED", "房间当前不可操作", 409); if (!roomMember(id, userId)) return fail("FORBIDDEN", "你不是房间成员", 403);
  const body = await request.json().catch(() => ({})) as { leaseToken?: string }; const lock = store.pieceLocks.get(`${id}:${pieceId}`); if (!lock || lock.userId !== userId || lock.leaseToken !== body.leaseToken || Date.parse(lock.expiresAt) <= Date.now()) return fail("LOCK_EXPIRED", "碎片锁已过期，请重新获取", 409, true);
  lock.expiresAt = new Date(Date.now() + PIECE_LOCK_MS).toISOString(); lock.version = room.stateVersion; const member = roomMember(id, userId)!; member.lastSeenAt = new Date().toISOString();
  return Response.json(ok({ lock, room: publicRoom(room, userId) }));
}
