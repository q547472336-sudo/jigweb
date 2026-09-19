import { fail, ok } from "@/lib/domain/api-contract";
import { getUser, roomMember, roomMembers, store } from "@/lib/server/local-store";
import { expireRoom, publicRoom } from "@/lib/server/room";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUser(request); if (!userId) return fail("AUTH_REQUIRED", "请先登录", 401);
  const room = store.rooms.get((await params).id); if (!room) return fail("NOT_FOUND", "房间不存在", 404);
  expireRoom(room); const member = roomMember(room.id, userId); if (!member) return fail("FORBIDDEN", "你不是房间成员", 403);
  member.leftAt = new Date().toISOString();
  for (const key of store.pieceLocks.keys()) if (key.startsWith(`${room.id}:`) && store.pieceLocks.get(key)?.userId === userId) store.pieceLocks.delete(key);
  if (room.ownerId === userId) {
    const nextOwner = roomMembers(room.id).filter((item) => !item.leftAt).sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))[0];
    if (nextOwner) { room.ownerId = nextOwner.userId; nextOwner.role = "owner"; }
  }
  return Response.json(ok({ room: publicRoom(room, userId), left: true }));
}
