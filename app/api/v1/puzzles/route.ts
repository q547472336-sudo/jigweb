import { fail, jsonBody, ok } from "@/lib/domain/api-contract";
import { activityIdentity, getUser, profileFor, store } from "@/lib/server/local-store";
import { puzzleSummary } from "@/lib/server/puzzle-summary";
import { validateCreation } from "@/lib/server/validation";

export async function GET(request: Request) {
  const url = new URL(request.url); const q = (url.searchParams.get("q") ?? "").trim().toLowerCase(); const category = url.searchParams.get("category"); const pieces = url.searchParams.get("pieces"); const sort = url.searchParams.get("sort") ?? "newest"; const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  let items = [...store.puzzles.values()].filter((p) => p.status === "published" && p.visibility === "public");
  const terms = q.split(/\s+/).filter(Boolean);
  if (terms.length) items = items.filter((p) => terms.every((term) => `${p.title} ${p.description} ${p.author.name}`.toLowerCase().includes(term)));
  if (category) items = items.filter((p) => p.categorySlug === category || p.category === category);
  if (pieces) { const [min, max] = pieces.split("-").map(Number); if (Number.isFinite(min)) items = items.filter((p) => p.pieceCount >= min && (!max || p.pieceCount <= max)); }
  items.sort((a, b) => sort === "popular" ? b.playCount - a.playCount || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id) : b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  const pageSize = 24; const start = (page - 1) * pageSize; const identity = activityIdentity(request);
  return Response.json(ok({ items: items.slice(start, start + pageSize).map((p) => puzzleSummary(p, identity)), page, pageSize, hasMore: start + pageSize < items.length, total: items.length }));
}

export async function POST(request: Request) {
  const userId = getUser(request); if (!userId) return fail("AUTH_REQUIRED", "请先登录", 401);
  const body = await jsonBody(request); if (!body) return fail("VALIDATION_ERROR", "请求格式错误");
  const rawKey = request.headers.get("idempotency-key")?.trim(); const key = rawKey ? `${userId}:${rawKey}` : null; const requestHash = JSON.stringify(body, Object.keys(body).sort()); if (key && store.idempotency.has(key)) { if (store.idempotencyHashes.get(key) !== requestHash) return fail("IDEMPOTENCY_REPLAY", "相同请求 ID 对应了不同内容", 409); const id = store.idempotency.get(key)!; return Response.json(ok({ puzzle: puzzleSummary(store.puzzles.get(id)!, userId), replay: true })); }
  const checked = validateCreation(body); if ("error" in checked) return fail("VALIDATION_ERROR", checked.error ?? "创建信息无效", 422);
  const profile = profileFor(userId); const id = `puzzle-${crypto.randomUUID()}`; const previewUrl = typeof body.previewUrl === "string" && (body.previewUrl.startsWith("data:image/") || body.previewUrl.startsWith("/")) ? body.previewUrl : "/placeholders/garden.svg"; const puzzle = { id, ownerId: userId, title: checked.value.title, description: checked.value.description, imageUrl: previewUrl, aspectRatio: checked.value.aspectRatio, author: { id: userId, name: profile.displayName }, category: typeof body.category === "string" ? body.category : "其他", categorySlug: typeof body.categorySlug === "string" ? body.categorySlug : "other", rows: checked.value.rows, columns: checked.value.columns, pieceCount: checked.value.rows * checked.value.columns, playCount: 0, visibility: body.visibility === "public" ? "public" as const : "private" as const, status: "published" as const, createdAt: new Date().toISOString(), favoriteBy: new Set<string>() };
  store.puzzles.set(id, puzzle); if (key) { store.idempotency.set(key, id); store.idempotencyHashes.set(key, requestHash); }
  return Response.json(ok({ puzzle: puzzleSummary(puzzle, userId), replay: false }), { status: 201 });
}
