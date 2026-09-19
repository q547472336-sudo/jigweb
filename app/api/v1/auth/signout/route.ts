import { fail, ok } from "@/lib/domain/api-contract";
import { getUser } from "@/lib/server/local-store";
export async function POST(request: Request) { if (!getUser(request)) return fail("AUTH_REQUIRED", "请先登录", 401); return Response.json(ok({ signedOut: true })); }
