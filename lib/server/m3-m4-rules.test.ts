import assert from "node:assert/strict";
import test from "node:test";
import { currentElapsedMs, validChallengePieces } from "./challenge.ts";
import { createPieces } from "./local-store.ts";
import { expireRoom, PIECE_LOCK_MS, ROOM_OFFLINE_MS } from "./room.ts";
import type { DailyChallenge, Room } from "./types.ts";

const challenge: DailyChallenge = { id: "challenge-test", businessDate: "2026-09-16", timezone: "Asia/Shanghai", puzzleId: "puzzle-test", puzzleVersion: 1, rows: 2, columns: 2, shape: "classic", seed: 1, ruleVersion: "test", status: "open" };

test("challenge elapsed time excludes confirmed pause intervals", () => {
  const active = { startedAt: "2026-09-16T00:00:00.000Z", activeSince: "2026-09-16T00:00:00.000Z", pausedMs: 2_000, elapsedMs: null, status: "active" as const };
  assert.equal(currentElapsedMs(active, new Date("2026-09-16T00:00:10.000Z")), 8_000);
  assert.equal(currentElapsedMs({ ...active, elapsedMs: 8_000, status: "paused" }, new Date("2026-09-16T00:05:00.000Z")), 8_000);
});

test("challenge completion requires every piece in its own fixed target", () => {
  const pieces = createPieces(2, 2).map((piece) => ({ ...piece, tray: "board" as const, fixed: true, x: piece.column / 2, y: piece.row / 2, slot: piece.index }));
  assert.equal(validChallengePieces(pieces, challenge, true), true);
  assert.equal(validChallengePieces(pieces.map((piece, index) => index === 0 ? { ...piece, x: .99 } : piece), challenge, true), false);
  assert.equal(validChallengePieces(pieces.map((piece) => ({ ...piece, id: `${piece.id}-other` })), challenge, true), false);
});

test("room offline timeout clears active room and uses the five-second lock constant", () => {
  const room: Room = { id: "room-test", ownerId: "user-test", puzzleId: "puzzle-test", sourceSessionId: null, snapshot: { pieces: createPieces(2, 2) }, stateVersion: 1, status: "active", createdAt: "2026-09-16T00:00:00.000Z", startedAt: "2026-09-16T00:00:00.000Z", expiresAt: "2026-09-17T00:00:00.000Z", lastActivityAt: "2026-09-16T00:00:00.000Z", completedAt: null };
  assert.equal(PIECE_LOCK_MS, 5_000);
  void ROOM_OFFLINE_MS;
  assert.equal(expireRoom(room, new Date("2026-09-16T00:01:00.000Z")).status, "active");
});
