import { fail, ok } from "@/lib/domain/api-contract";
import { getUser, store } from "@/lib/server/local-store";
export async function POST(request: Request) { const userId = getUser(request); if (!userId) return fail("AUTH_REQUIRED", "请先登录", 401); const items = store.notifications.get(userId) ?? []; const at = new Date().toISOString(); items.forEach((item) => { item.readAt ??= at; }); store.notifications.set(userId, items); return Response.json(ok({ updated: items.length })); }
