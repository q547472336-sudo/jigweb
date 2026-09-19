import { fail, jsonBody, ok } from "@/lib/domain/api-contract";
import { getUser, roomMembers, store, createPieces } from "@/lib/server/local-store";
import { publicRoom } from "@/lib/server/room";
import { arrangedPiecePosition } from "@/lib/game/engine";

export async function POST(request: Request) {
  const userId = getUser(request); if (!userId) return fail("AUTH_REQUIRED", "请先登录", 401);
  const body = await jsonBody(request); const puzzleId = typeof body?.puzzleId === "string" ? body.puzzleId : ""; const puzzle = store.puzzles.get(puzzleId);
  if (!puzzle || puzzle.status !== "published" || puzzle.visibility !== "public") return fail("FORBIDDEN", "私有作品不能创建多人房间", 403);
  const sourceSessionId = typeof body?.sourceSessionId === "string" ? body.sourceSessionId : null; const source = sourceSessionId ? store.sessions.get(sourceSessionId) : undefined;
  if (sourceSessionId && (!source || source.userId !== userId || source.puzzleId !== puzzleId || source.status === "completed")) return fail("FORBIDDEN", "来源存档不可用于创建房间", 403);
  const basePieces = source?.snapshot.pieces ?? createPieces(puzzle.rows, puzzle.columns); const pieces = source ? structuredClone(basePieces) : basePieces.map((piece, index) => ({ ...piece, ...arrangedPiecePosition(index, basePieces.length) }));
  const now = new Date(); const room: import("@/lib/server/types").Room = { id: `room-${crypto.randomUUID().slice(0, 8)}`, ownerId: userId, puzzleId, sourceSessionId, snapshot: { pieces }, stateVersion: 1, status: "waiting", createdAt: now.toISOString(), startedAt: null, expiresAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(), lastActivityAt: now.toISOString(), completedAt: null };
  store.rooms.set(room.id, room); store.roomMembers.set(room.id, [{ roomId: room.id, userId, role: "owner", joinedAt: now.toISOString(), leftAt: null, participatedAt: null, lastSeenAt: now.toISOString() }]);
  return Response.json(ok({ room: publicRoom(room, userId), inviteUrl: `/room/${room.id}` }), { status: 201 });
}
