import { fail, ok } from "@/lib/domain/api-contract";
import { getUser, roomMember, roomMembers, store } from "@/lib/server/local-store";
import { expireRoom, publicRoom } from "@/lib/server/room";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUser(request); if (!userId) return fail("AUTH_REQUIRED", "请先登录", 401);
  const room = store.rooms.get((await params).id); if (!room) return fail("NOT_FOUND", "房间不存在", 404);
  expireRoom(room); if (room.ownerId !== userId) return fail("FORBIDDEN", "只有房主可以开始房间", 403);
  if (room.status === "active") return Response.json(ok({ room: publicRoom(room, userId), replay: true }));
  if (room.status !== "waiting") return fail("ROOM_ENDED", "当前房间不能开始", 409);
  if (roomMembers(room.id).filter((member) => !member.leftAt).length < 2) return fail("VALIDATION_ERROR", "至少需要 2 位在线成员才能开始", 422);
  const now = new Date(); room.status = "active"; room.startedAt = now.toISOString(); room.expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(); room.lastActivityAt = now.toISOString(); room.stateVersion += 1;
  return Response.json(ok({ room: publicRoom(room, userId), replay: false }));
}
