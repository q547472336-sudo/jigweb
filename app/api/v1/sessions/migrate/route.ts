import { fail, jsonBody, ok } from "@/lib/domain/api-contract";
import { getUser, store } from "@/lib/server/local-store";

export async function POST(request: Request) {
  const userId = getUser(request);
  if (!userId) return fail("AUTH_REQUIRED", "请先登录", 401);
  const body = await jsonBody(request);
  const guestId = typeof body?.guestId === "string" ? body.guestId : "";
  const puzzleId = typeof body?.puzzleId === "string" ? body.puzzleId : "";
  if (!guestId || !puzzleId) return fail("VALIDATION_ERROR", "缺少迁移标识", 422);
  const local = [...store.sessions.values()].find((session) => session.guestId === guestId && session.puzzleId === puzzleId && session.status !== "completed");
  const cloud = [...store.sessions.values()].find((session) => session.userId === userId && session.puzzleId === puzzleId && session.status !== "completed");
  if (!local) return Response.json(ok({ result: "same", cloud }));
  if (cloud) return Response.json(ok({ result: "conflict", local, cloud }));
  local.userId = userId; local.guestId = null; local.updatedAt = new Date().toISOString();
  return Response.json(ok({ result: "cloud_missing", session: local }));
}
