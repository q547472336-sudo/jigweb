const assert = require("node:assert/strict");
const path = require("node:path");

process.env.LOCAL_OTP_CODE = "000000";

const root = path.join(process.cwd(), ".next", "server", "app", "api", "v1");
function route(relative) { return require(path.join(root, relative, "route.js")).routeModule.userland; }
async function call(relative, method, url, body, headers = {}, params) {
  const request = new Request(`http://local/api/v1${url}`, { method, headers: { ...(body ? { "content-type": "application/json" } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  const response = await route(relative)[method](request, params ? { params: Promise.resolve(params) } : undefined);
  return { status: response.status, json: await response.json() };
}

(async () => {
  const email = `m2-${Date.now()}@example.com`;
  assert.equal((await call("auth/otp/request", "POST", "/auth/otp/request", { email })).status, 200);
  const login = await call("auth/otp/verify", "POST", "/auth/otp/verify", { email, code: "000000" });
  assert.equal(login.status, 200);
  const userId = login.json.data.session.userId;
  const auth = { "x-user-id": userId };

  assert.equal((await call("me", "GET", "/me", undefined, auth)).status, 200);
  const creation = { title: "M2 验收拼图", description: "本地闭环", rows: 3, columns: 3, mimeType: "image/png", bytes: 1000, width: 600, height: 600, visibility: "private", previewUrl: "/placeholders/garden.svg" };
  const first = await call("puzzles", "POST", "/puzzles", creation, { ...auth, "idempotency-key": "m2-smoke" });
  const replay = await call("puzzles", "POST", "/puzzles", creation, { ...auth, "idempotency-key": "m2-smoke" });
  const mismatchedReplay = await call("puzzles", "POST", "/puzzles", { ...creation, title: "不同内容" }, { ...auth, "idempotency-key": "m2-smoke" });
  assert.equal(first.status, 201); assert.equal(first.json.data.puzzle.id, replay.json.data.puzzle.id); assert.equal(replay.json.data.replay, true);
  assert.equal(mismatchedReplay.status, 409);
  const puzzleId = first.json.data.puzzle.id;
  assert.equal((await call("puzzles/[id]", "GET", `/puzzles/${puzzleId}`, undefined, {}, { id: puzzleId })).status, 404);
  assert.equal((await call("puzzles/[id]", "GET", `/puzzles/${puzzleId}`, undefined, auth, { id: puzzleId })).status, 200);

  assert.equal((await call("puzzles/[id]/favorite", "POST", `/puzzles/${puzzleId}/favorite`, undefined, auth, { id: puzzleId })).status, 200);
  const favorites = await call("me/collections/[type]", "GET", "/me/collections/favorites", undefined, auth, { type: "favorites" });
  assert.equal(favorites.json.data.items.some((item) => item.id === puzzleId), true);

  const createdSession = await call("sessions", "POST", "/sessions", { puzzleId }, auth);
  const session = createdSession.json.data;
  const completedPieces = session.snapshot.pieces.map((piece) => ({ ...piece, fixed: true, tray: "board" }));
  const saved = await call("sessions/[id]", "PUT", `/sessions/${session.id}`, { stateVersion: session.stateVersion, status: "active", snapshot: { pieces: completedPieces } }, auth, { id: session.id });
  assert.equal(saved.status, 200);
  const conflict = await call("sessions/[id]", "PUT", `/sessions/${session.id}`, { stateVersion: session.stateVersion, status: "active", snapshot: { pieces: completedPieces } }, auth, { id: session.id });
  assert.equal(conflict.status, 409);
  assert.equal((await call("sessions/[id]/complete", "POST", `/sessions/${session.id}/complete`, undefined, auth, { id: session.id })).status, 200);
  const completed = await call("me/collections/[type]", "GET", "/me/collections/completed", undefined, auth, { type: "completed" });
  assert.equal(completed.json.data.items.some((item) => item.id === puzzleId), true);

  const feedback = await call("feedback", "POST", "/feedback", { type: "other", description: "M2 smoke" }, auth);
  assert.equal(feedback.status, 201); assert.match(feedback.json.data.ticketNo, /^FB-/);
  console.log("M2 smoke passed: auth, private creation, idempotency, favorite, version conflict, completion, personal lists, feedback");
})().catch((error) => { console.error(error); process.exitCode = 1; });
