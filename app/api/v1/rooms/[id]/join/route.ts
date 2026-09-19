import { fail, ok } from "@/lib/domain/api-contract";
import { getUser, roomMember, roomMembers, store } from "@/lib/server/local-store";
import { expireRoom, publicRoom } from "@/lib/server/room";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUser(request); if (!userId) return fail("AUTH_REQUIRED", "请先登录", 401);
  const room = store.rooms.get((await params).id); if (!room) return fail("NOT_FOUND", "房间不存在", 404);
  expireRoom(room); const existing = roomMember(room.id, userId);
  if (existing) { existing.lastSeenAt = new Date().toISOString(); return Response.json(ok({ room: publicRoom(room, userId), replay: true })); }
  if (room.status !== "waiting") return fail("ROOM_ENDED", "房间已经开始或结束，不能加入", 409);
  if (roomMembers(room.id).filter((member) => !member.leftAt).length >= 4) return fail("ROOM_FULL", "房间已满，最多 4 人", 409);
  const now = new Date().toISOString(); roomMembers(room.id).push({ roomId: room.id, userId, role: "member", joinedAt: now, leftAt: null, participatedAt: null, lastSeenAt: now });
  return Response.json(ok({ room: publicRoom(room, userId), replay: false }));
}
