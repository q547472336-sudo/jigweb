import { fail, ok } from "@/lib/domain/api-contract";
import { getUser, roomMember, store } from "@/lib/server/local-store";
import { expireRoom, PIECE_LOCK_MS, publicRoom, roomPiece } from "@/lib/server/room";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; pieceId: string }> }) {
  const userId = getUser(request); if (!userId) return fail("AUTH_REQUIRED", "请先登录", 401);
  const { id, pieceId } = await params; const room = store.rooms.get(id); if (!room) return fail("NOT_FOUND", "房间不存在", 404);
  expireRoom(room); if (room.status !== "active") return fail("ROOM_ENDED", "房间当前不可操作", 409);
  const member = roomMember(id, userId); if (!member) return fail("FORBIDDEN", "你不是房间成员", 403);
  const piece = roomPiece(room, pieceId); if (!piece) return fail("NOT_FOUND", "碎片不存在", 404); if (piece.fixed) return fail("VALIDATION_ERROR", "已固定的碎片不能再次操作", 409);
  const key = `${id}:${pieceId}`; const existing = store.pieceLocks.get(key); const now = new Date();
  if (existing && Date.parse(existing.expiresAt) > now.getTime() && existing.userId !== userId) return fail("LOCK_TAKEN", "这块碎片正在被其他玩家移动", 409, true);
  const lock = { roomId: id, pieceId, userId, leaseToken: existing?.userId === userId ? existing.leaseToken : crypto.randomUUID(), expiresAt: new Date(now.getTime() + PIECE_LOCK_MS).toISOString(), version: room.stateVersion };
  store.pieceLocks.set(key, lock); member.lastSeenAt = now.toISOString();
  return Response.json(ok({ lock, room: publicRoom(room, userId) }));
}
