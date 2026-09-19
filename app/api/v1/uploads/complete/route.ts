import { fail, jsonBody, ok } from "@/lib/domain/api-contract";
import { decodeImageMetadata } from "@/lib/domain/image-metadata";
import { validateUploadMetadata } from "@/lib/domain/m2-rules";
import { getDataAdapter } from "@/lib/server/data-adapter";
import { getUser, store } from "@/lib/server/local-store";

export async function POST(request: Request) {
  const adapter = getDataAdapter();
  if (adapter.mode === "supabase") return fail("UPLOAD_FAILED", "生产上传必须由服务端派生图任务确认后完成", 503, true);
  const userId = getUser(request); if (!userId) return fail("AUTH_REQUIRED", "请先登录", 401);
  const body = await jsonBody(request); const token = typeof body?.uploadToken === "string" ? body.uploadToken : ""; const intent = store.uploadIntents.get(token);
  if (!intent || intent.userId !== userId || intent.expiresAt < Date.now() || intent.completedAt) return fail("UPLOAD_FAILED", "上传凭证无效或已过期", 422, false, "uploadToken");
  const encoded = typeof body?.fileBase64 === "string" ? body.fileBase64 : "";
  let bytes: Uint8Array;
  try { bytes = Uint8Array.from(Buffer.from(encoded, "base64")); } catch { return fail("UPLOAD_FAILED", "无法读取图片内容", 422); }
  const decoded = decodeImageMetadata(bytes);
  if (!decoded || decoded.mimeType !== intent.mimeType || decoded.width !== intent.width || decoded.height !== intent.height) return fail("UPLOAD_FAILED", "图片实际格式或尺寸与上传声明不一致", 422);
  const error = validateUploadMetadata({ ...decoded, bytes: bytes.byteLength });
  if (error) return fail("UPLOAD_FAILED", "图片实际内容未通过校验", 422);
  intent.completedAt = Date.now();
  return Response.json(ok({ uploadToken: token, storagePath: intent.storagePath, verified: true, width: decoded.width, height: decoded.height, mimeType: decoded.mimeType }));
}
