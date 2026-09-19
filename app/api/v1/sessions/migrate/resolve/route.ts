import { fail, jsonBody, ok } from "@/lib/domain/api-contract";
import { getGuest, getUser, store } from "@/lib/server/local-store";

function clone<T>(value: T): T { return structuredClone(value); }

export async function POST(request: Request) {
  const userId = getUser(request);
  if (!userId) return fail("AUTH_REQUIRED", "请先登录", 401);
  const body = await jsonBody(request);
  const guestId = typeof body?.guestId === "string" ? body.guestId : "";
  const puzzleId = typeof body?.puzzleId === "string" ? body.puzzleId : "";
  const choice = body?.choice === "local" || body?.choice === "cloud" ? body.choice : null;
  if (!guestId || !puzzleId || !choice) return fail("VALIDATION_ERROR", "需要选择要保留的存档", 422);
  const local = [...store.sessions.values()].find((session) => session.guestId === guestId && session.puzzleId === puzzleId && session.status !== "completed");
  const cloud = [...store.sessions.values()].find((session) => session.userId === userId && session.puzzleId === puzzleId && session.status !== "completed");
  if (!local || !cloud) return fail("NOT_FOUND", "冲突存档不存在", 404);
  const chosen = choice === "local" ? local : cloud;
  const discarded = choice === "local" ? cloud : local;
  const backupId = `migration-backup-${crypto.randomUUID()}`;
  store.migrationBackups.set(backupId, { id: backupId, userId, puzzleId, source: choice === "local" ? "cloud" : "guest", snapshot: clone(discarded), expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  store.sessions.delete(discarded.id);
  chosen.userId = userId;
  chosen.guestId = null;
  chosen.updatedAt = new Date().toISOString();
  store.sessions.set(chosen.id, chosen);
  return Response.json(ok({ result: choice === "local" ? "local_selected" : "cloud_selected", session: chosen, backupId }));
}
