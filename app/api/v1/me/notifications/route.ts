import { fail, ok } from "@/lib/domain/api-contract";
import { getUser, store } from "@/lib/server/local-store";
export async function GET(request: Request) { const userId = getUser(request); if (!userId) return fail("AUTH_REQUIRED", "请先登录", 401); const items = store.notifications.get(userId) ?? []; return Response.json(ok({ items, page: 1, pageSize: 20, hasMore: false, total: items.length })); }
