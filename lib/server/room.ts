import type { Piece, Room } from "./types.ts";
import { recordCompleted, roomMembers, store } from "./local-store.ts";

export const ROOM_WAIT_MS = 30 * 60 * 1000;
export const ROOM_ACTIVE_MS = 24 * 60 * 60 * 1000;
export const ROOM_OFFLINE_MS = 10 * 60 * 1000;
export const PIECE_LOCK_MS = 5 * 1000;

export function expireRoom(room: Room, now = new Date()) {
  const current = now.getTime();
  if (room.status === "waiting" && current >= Date.parse(room.expiresAt)) room.status = "ended";
  if (room.status === "active" && current >= Date.parse(room.expiresAt)) room.status = "ended";
  const members = roomMembers(room.id);
  if (room.status !== "completed" && room.status !== "ended" && room.status === "active" && members.length > 0 && members.every((member) => current - Date.parse(member.lastSeenAt) >= ROOM_OFFLINE_MS)) room.status = "ended";
  if (room.status === "ended") {
    for (const key of store.pieceLocks.keys()) if (key.startsWith(`${room.id}:`)) store.pieceLocks.delete(key);
  }
  return room;
}

export function roomPiece(room: Room, pieceId: string) {
  return room.snapshot.pieces.find((piece) => piece.id === pieceId);
}

export function publicRoom(room: Room, userId: string | null) {
  const members = roomMembers(room.id).map((member) => ({ ...member, displayName: store.profiles.get(member.userId)?.displayName ?? "本地玩家", online: Date.now() - Date.parse(member.lastSeenAt) < ROOM_OFFLINE_MS }));
  const member = userId ? members.find((item) => item.userId === userId && !item.leftAt) : undefined;
  return { ...room, members, canPlay: Boolean(member), snapshot: member ? room.snapshot : null };
}

export function completeRoom(room: Room, now = new Date()) {
  room.status = "completed"; room.completedAt = now.toISOString(); room.lastActivityAt = room.completedAt;
  for (const member of roomMembers(room.id)) {
    if (!member.participatedAt) continue;
    recordCompleted(member.userId, room.puzzleId);
    const notifications = store.notifications.get(member.userId) ?? [];
    if (!notifications.some((notification) => notification.type === "room_completed" && notification.message.includes(room.id))) notifications.unshift({ id: `notification-${crypto.randomUUID()}`, type: "room_completed", message: `房间 ${room.id} 已完成，感谢你的参与`, createdAt: room.completedAt, readAt: null });
    store.notifications.set(member.userId, notifications);
  }
}

export function samePieceShape(piece: Piece, candidate: { x?: unknown; y?: unknown; tray?: unknown; fixed?: unknown; slot?: unknown }) {
  return typeof candidate.x === "number" && Number.isFinite(candidate.x) && typeof candidate.y === "number" && Number.isFinite(candidate.y) && (candidate.tray === "left" || candidate.tray === "right" || candidate.tray === "board") && typeof candidate.fixed === "boolean" && (candidate.slot === undefined || Number.isInteger(candidate.slot));
}
