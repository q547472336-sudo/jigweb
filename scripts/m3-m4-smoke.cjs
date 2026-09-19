const assert = require("node:assert/strict");
const path = require("node:path");

const root = path.join(process.cwd(), ".next", "server", "app", "api", "v1");
function route(relative) { return require(path.join(root, relative, "route.js")).routeModule.userland; }
function auth(userId) { return { "x-user-id": userId }; }
async function call(relative, method, url, body, headers = {}, params) {
  const request = new Request(`http://local/api/v1${url}`, {
    method,
    headers: { ...(body ? { "content-type": "application/json" } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const response = await route(relative)[method](request, params ? { params: Promise.resolve(params) } : undefined);
  return { status: response.status, json: await response.json() };
}
function data(result) { return result.json.data; }
function assertStatus(result, status, label) { assert.equal(result.status, status, `${label}: ${JSON.stringify(result.json)}`); }

async function challengeSmoke() {
  const suffix = Date.now();
  const guest = `guest-m3-${suffix}`;
  const user = `user-m3-${suffix}`;
  const today = await call("challenge/today", "GET", "/challenge/today", undefined, { "x-guest-id": guest });
  assertStatus(today, 200, "read today challenge");
  const challenge = data(today).challenge;
  assert.equal(data(today).puzzle.id, challenge.puzzleId);

  const practice = await call("challenge/attempts", "POST", "/challenge/attempts", { challengeId: challenge.id, mode: "formal" }, { "x-guest-id": guest });
  assertStatus(practice, 201, "guest challenge");
  assert.equal(data(practice).attempt.mode, "practice");
  const practiceAttempt = data(practice).attempt;
  assertStatus(await call("challenge/attempts/[id]/start", "POST", `/challenge/attempts/${practiceAttempt.id}/start`, undefined, { "x-guest-id": guest }, { id: practiceAttempt.id }), 200, "start practice");
  const paused = await call("challenge/attempts/[id]/pause", "POST", `/challenge/attempts/${practiceAttempt.id}/pause`, { action: "pause" }, { "x-guest-id": guest }, { id: practiceAttempt.id });
  assertStatus(paused, 200, "pause practice");
  assert.equal(data(paused).attempt.status, "paused");
  const resumed = await call("challenge/attempts/[id]/pause", "POST", `/challenge/attempts/${practiceAttempt.id}/pause`, { action: "resume" }, { "x-guest-id": guest }, { id: practiceAttempt.id });
  assertStatus(resumed, 200, "resume practice");
  assert.equal(data(resumed).attempt.status, "active");

  const formal = await call("challenge/attempts", "POST", "/challenge/attempts", { challengeId: challenge.id, mode: "formal" }, auth(user));
  assertStatus(formal, 201, "formal challenge");
  const formalAttempt = data(formal).attempt;
  const started = await call("challenge/attempts/[id]/start", "POST", `/challenge/attempts/${formalAttempt.id}/start`, undefined, auth(user), { id: formalAttempt.id });
  assertStatus(started, 200, "start formal");
  const pieces = formalAttempt.pieces.map((piece) => ({ ...piece, tray: "board", fixed: true, x: piece.column / challenge.columns, y: piece.row / challenge.rows, slot: piece.index }));
  const saved = await call("challenge/attempts/[id]", "PUT", `/challenge/attempts/${formalAttempt.id}`, { stateVersion: data(started).attempt.stateVersion, status: "active", pieces }, auth(user), { id: formalAttempt.id });
  assertStatus(saved, 200, "save formal snapshot");
  const stale = await call("challenge/attempts/[id]", "PUT", `/challenge/attempts/${formalAttempt.id}`, { stateVersion: data(started).attempt.stateVersion, status: "active", pieces }, auth(user), { id: formalAttempt.id });
  assertStatus(stale, 409, "reject stale formal snapshot");
  const completed = await call("challenge/attempts/[id]/complete", "POST", `/challenge/attempts/${formalAttempt.id}/complete`, { pieces }, auth(user), { id: formalAttempt.id });
  assertStatus(completed, 200, "complete formal");
  assert.equal(data(completed).completed, true);
  const replay = await call("challenge/attempts/[id]/complete", "POST", `/challenge/attempts/${formalAttempt.id}/complete`, { pieces }, auth(user), { id: formalAttempt.id });
  assertStatus(replay, 200, "replay formal completion");
  assert.equal(data(replay).replay, true);
  const board = await call("leaderboard", "GET", "/leaderboard");
  assertStatus(board, 200, "read leaderboard");
  assert.equal(data(board).items.some((item) => item.userId === user), true);
  return { challenge: challenge.id, formalAttempt: formalAttempt.id };
}

async function roomSmoke() {
  const suffix = Date.now();
  const owner = `user-m4-owner-${suffix}`;
  const member = `user-m4-member-${suffix}`;
  const outsider = `user-m4-outsider-${suffix}`;
  const puzzleId = "puzzle-1";
  const created = await call("rooms", "POST", "/rooms", { puzzleId }, auth(owner));
  assertStatus(created, 201, "create room");
  const roomId = data(created).room.id;
  const joined = await call("rooms/[id]/join", "POST", `/rooms/${roomId}/join`, undefined, auth(member), { id: roomId });
  assertStatus(joined, 200, "join room");
  assertStatus(await call("rooms/[id]/start", "POST", `/rooms/${roomId}/start`, undefined, auth(member), { id: roomId }), 403, "reject non-owner start");
  const started = await call("rooms/[id]/start", "POST", `/rooms/${roomId}/start`, undefined, auth(owner), { id: roomId });
  assertStatus(started, 200, "start room");
  let room = data(started).room;
  const roomInfo = await call("rooms/[id]", "GET", `/rooms/${roomId}`, undefined, auth(owner), { id: roomId });
  assertStatus(roomInfo, 200, "read room puzzle dimensions");
  const puzzle = data(roomInfo).puzzle;
  const locked = await call("rooms/[id]/pieces/[pieceId]/lock", "POST", `/rooms/${roomId}/pieces/piece-0/lock`, undefined, auth(owner), { id: roomId, pieceId: "piece-0" });
  assertStatus(locked, 200, "owner lock");
  const leaseToken = data(locked).lock.leaseToken;
  const contention = await call("rooms/[id]/pieces/[pieceId]/lock", "POST", `/rooms/${roomId}/pieces/piece-0/lock`, undefined, auth(member), { id: roomId, pieceId: "piece-0" });
  assertStatus(contention, 409, "reject competing lock");
  assert.equal(contention.json.error.code, "LOCK_TAKEN");
  assertStatus(await call("rooms/[id]/pieces/[pieceId]/lock/renew", "POST", `/rooms/${roomId}/pieces/piece-0/lock/renew`, { leaseToken }, auth(owner), { id: roomId, pieceId: "piece-0" }), 200, "renew lock");
  const movedOwner = await call("rooms/[id]/events", "POST", `/rooms/${roomId}/events`, { pieceId: "piece-0", leaseToken, stateVersion: room.stateVersion, piece: { x: 0.12, y: 0.12, tray: "board", fixed: false } }, auth(owner), { id: roomId });
  assertStatus(movedOwner, 200, "owner move");
  room = data(movedOwner).room;

  const lockedForMember = await call("rooms/[id]/pieces/[pieceId]/lock", "POST", `/rooms/${roomId}/pieces/piece-1/lock`, undefined, auth(member), { id: roomId, pieceId: "piece-1" });
  assertStatus(lockedForMember, 200, "member lock");
  const memberToken = data(lockedForMember).lock.leaseToken;
  const movedMember = await call("rooms/[id]/events", "POST", `/rooms/${roomId}/events`, { pieceId: "piece-1", leaseToken: memberToken, stateVersion: room.stateVersion, piece: { x: 0.2, y: 0.2, tray: "board", fixed: false } }, auth(member), { id: roomId });
  assertStatus(movedMember, 200, "member move");
  room = data(movedMember).room;

  const lockForStale = await call("rooms/[id]/pieces/[pieceId]/lock", "POST", `/rooms/${roomId}/pieces/piece-2/lock`, undefined, auth(owner), { id: roomId, pieceId: "piece-2" });
  assertStatus(lockForStale, 200, "lock stale candidate");
  const staleVersion = room.stateVersion;
  const lockOther = await call("rooms/[id]/pieces/[pieceId]/lock", "POST", `/rooms/${roomId}/pieces/piece-3/lock`, undefined, auth(member), { id: roomId, pieceId: "piece-3" });
  assertStatus(lockOther, 200, "lock before stale event");
  const otherToken = data(lockOther).lock.leaseToken;
  const advanced = await call("rooms/[id]/events", "POST", `/rooms/${roomId}/events`, { pieceId: "piece-3", leaseToken: otherToken, stateVersion: staleVersion, piece: { x: 0.3, y: 0.3, tray: "board", fixed: false } }, auth(member), { id: roomId });
  assertStatus(advanced, 200, "advance room version");
  const staleEvent = await call("rooms/[id]/events", "POST", `/rooms/${roomId}/events`, { pieceId: "piece-2", leaseToken: data(lockForStale).lock.leaseToken, stateVersion: staleVersion, piece: { x: 0.4, y: 0.4, tray: "board", fixed: false } }, auth(owner), { id: roomId });
  assertStatus(staleEvent, 409, "reject stale event");
  assert.equal(staleEvent.json.error.code, "STALE_EVENT");

  room = data(advanced).room;
  for (const piece of room.snapshot.pieces) {
    if (piece.fixed) continue;
    const lock = await call("rooms/[id]/pieces/[pieceId]/lock", "POST", `/rooms/${roomId}/pieces/${piece.id}/lock`, undefined, auth(owner), { id: roomId, pieceId: piece.id });
    assertStatus(lock, 200, `lock ${piece.id} for completion`);
    const fixed = await call("rooms/[id]/events", "POST", `/rooms/${roomId}/events`, { pieceId: piece.id, leaseToken: data(lock).lock.leaseToken, stateVersion: room.stateVersion, piece: { x: piece.column / puzzle.columns, y: piece.row / puzzle.rows, tray: "board", fixed: true } }, auth(owner), { id: roomId });
    assertStatus(fixed, 200, `fix ${piece.id}`);
    room = data(fixed).room;
    if (room.status === "completed") break;
  }
  assert.equal(room.status, "completed");
  const ownerCompleted = await call("me/collections/[type]", "GET", "/me/collections/completed", undefined, auth(owner), { type: "completed" });
  const memberCompleted = await call("me/collections/[type]", "GET", "/me/collections/completed", undefined, auth(member), { type: "completed" });
  assertStatus(ownerCompleted, 200, "owner completion record");
  assertStatus(memberCompleted, 200, "member completion record");
  assert.equal(data(ownerCompleted).items.some((item) => item.id === puzzleId), true);
  assert.equal(data(memberCompleted).items.some((item) => item.id === puzzleId), true);
  const ownerNotifications = await call("me/notifications", "GET", "/me/notifications", undefined, auth(owner));
  const memberNotifications = await call("me/notifications", "GET", "/me/notifications", undefined, auth(member));
  assertStatus(ownerNotifications, 200, "owner room notification");
  assertStatus(memberNotifications, 200, "member room notification");
  assert.equal(data(ownerNotifications).items.filter((item) => item.type === "room_completed").length, 1);
  assert.equal(data(memberNotifications).items.filter((item) => item.type === "room_completed").length, 1);

  const privatePuzzle = await call("puzzles", "POST", "/puzzles", { title: `M4 private ${suffix}`, description: "privacy", rows: 3, columns: 3, mimeType: "image/png", bytes: 1000, width: 600, height: 600, visibility: "private", previewUrl: "/placeholders/garden.svg" }, auth(owner));
  assertStatus(privatePuzzle, 201, "create private puzzle");
  const privateRoom = await call("rooms", "POST", "/rooms", { puzzleId: data(privatePuzzle).puzzle.id }, auth(owner));
  assertStatus(privateRoom, 403, "reject private room");
  assert.equal(privateRoom.json.error.code, "FORBIDDEN");
  const outsiderRead = await call("rooms/[id]", "GET", `/rooms/${roomId}`, undefined, auth(outsider), { id: roomId });
  assertStatus(outsiderRead, 200, "allow public room read");
  assert.equal(data(outsiderRead).room.canPlay, false);
  return { room: roomId, participants: [owner, member] };
}

(async () => {
  const challenge = await challengeSmoke();
  const room = await roomSmoke();
  console.log(`M3/M4 smoke passed: challenge=${challenge.challenge}, attempt=${challenge.formalAttempt}, room=${room.room}, participants=${room.participants.join(",")}`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
