import { fail, ok } from "@/lib/domain/api-contract";
import { getUser, store } from "@/lib/server/local-store";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { const userId = getUser(request); if (!userId) return fail("AUTH_REQUIRED", "请先登录", 401); const { id } = await params; const item = (store.notifications.get(userId) ?? []).find((entry) => entry.id === id); if (!item) return fail("NOT_FOUND", "通知不存在", 404); item.readAt = new Date().toISOString(); return Response.json(ok({ read: true })); }
