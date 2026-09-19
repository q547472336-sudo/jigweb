import { fail, jsonBody, ok } from "@/lib/domain/api-contract";
import { getUser, roomMember, roomMembers, store } from "@/lib/server/local-store";
import { completeRoom, expireRoom, publicRoom, roomPiece, samePieceShape } from "@/lib/server/room";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUser(request); if (!userId) return fail("AUTH_REQUIRED", "请先登录", 401);
  const id = (await params).id; const room = store.rooms.get(id); if (!room) return fail("NOT_FOUND", "房间不存在", 404); expireRoom(room);
  const puzzle = store.puzzles.get(room.puzzleId); if (!puzzle) return fail("NOT_FOUND", "作品不存在", 404);
  if (room.status !== "active") return fail("ROOM_ENDED", "房间当前不可操作", 409);
  const member = roomMember(id, userId); if (!member) return fail("FORBIDDEN", "你不是房间成员", 403);
  const body = await jsonBody(request); const pieceId = typeof body?.pieceId === "string" ? body.pieceId : ""; const piece = roomPiece(room, pieceId); const lock = store.pieceLocks.get(`${id}:${pieceId}`);
  if (!piece || !lock) return fail("NOT_FOUND", "碎片锁不存在", 404);
  if (lock.userId !== userId || lock.leaseToken !== body?.leaseToken) return fail("LOCK_TAKEN", "没有这块碎片的有效锁", 409, true);
  if (Date.parse(lock.expiresAt) <= Date.now()) { store.pieceLocks.delete(`${id}:${pieceId}`); return fail("LOCK_EXPIRED", "碎片锁已过期，请重新获取", 409, true); }
  if (Number(body?.stateVersion) !== room.stateVersion) return fail("STALE_EVENT", "房间已有更新，请先同步", 409, true);
  const candidate = body?.piece; if (!candidate || !samePieceShape(piece, candidate as { x?: unknown; y?: unknown; tray?: unknown; fixed?: unknown; slot?: unknown })) return fail("VALIDATION_ERROR", "碎片事件格式错误", 422);
  const x = Math.max(0, Math.min(1, Number((candidate as Record<string, unknown>).x))); const y = Math.max(0, Math.min(1, Number((candidate as Record<string, unknown>).y))); const fixed = Boolean((candidate as Record<string, unknown>).fixed);
  if (fixed && (Math.abs(x - piece.column / puzzle.columns) > 0.001 || Math.abs(y - piece.row / puzzle.rows) > 0.001)) return fail("VALIDATION_ERROR", "碎片不能固定到错误位置", 422);
  const previous = { ...piece }; piece.x = x; piece.y = y; piece.tray = (candidate as Record<string, unknown>).tray as typeof piece.tray; piece.fixed = fixed; piece.slot = fixed ? piece.index : undefined;
  room.stateVersion += 1; room.lastActivityAt = new Date().toISOString(); lock.version = room.stateVersion; store.pieceLocks.delete(`${id}:${pieceId}`); if (!member.participatedAt && (previous.x !== piece.x || previous.y !== piece.y || previous.fixed !== piece.fixed)) member.participatedAt = room.lastActivityAt;
  const event = { id: `room-event-${crypto.randomUUID()}`, roomId: id, pieceId, userId, eventType: fixed ? "fixed" as const : "move" as const, payload: { x: piece.x, y: piece.y, tray: piece.tray, fixed: piece.fixed, slot: piece.slot }, version: room.stateVersion, createdAt: room.lastActivityAt };
  const events = store.roomEvents.get(id) ?? []; events.push(event); store.roomEvents.set(id, events);
  if (room.snapshot.pieces.every((item) => item.fixed)) completeRoom(room);
  return Response.json(ok({ event, room: publicRoom(room, userId), members: roomMembers(id) }));
}
