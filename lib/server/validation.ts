import { validateUploadMetadata } from "@/lib/domain/m2-rules";
export function validateCreation(input: Record<string, unknown>) {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const description = typeof input.description === "string" ? input.description : "";
  const rows = Number(input.rows); const columns = Number(input.columns);
  if (!title || title.length > 60) return { error: "作品名称需为 1～60 个字符" };
  if (description.length > 500) return { error: "描述不能超过 500 个字符" };
  if (!Number.isInteger(rows) || !Number.isInteger(columns) || rows < 3 || columns < 3 || rows > 25 || columns > 25 || rows * columns < 9 || rows * columns > 500) return { error: "片数必须为 3～25 行列，且总数为 9～500" };
  const mime = typeof input.mimeType === "string" ? input.mimeType.toLowerCase() : "";
  const imageError = validateUploadMetadata({ mimeType: mime, bytes: Number(input.bytes ?? 0), width: Number(input.width ?? 0), height: Number(input.height ?? 0), animated: input.animated === true });
  if (imageError === "INVALID_IMAGE_TYPE") return { error: "仅支持 JPEG、PNG 和静态 WebP" };
  if (imageError === "IMAGE_TOO_LARGE") return { error: "图片不能超过 10MB" };
  if (imageError === "IMAGE_DIMENSION_INVALID") return { error: "图片尺寸不符合要求" };
  const ratios = { "1:1": 1, "4:3": 4 / 3, "16:9": 16 / 9 } as const;
  const cropRatio = typeof input.cropRatio === "string" ? input.cropRatio : "";
  const aspectRatio = Number(input.aspectRatio);
  const expectedRatio = cropRatio in ratios ? ratios[cropRatio as keyof typeof ratios] : undefined;
  if (!expectedRatio || !Number.isFinite(aspectRatio) || Math.abs(aspectRatio - expectedRatio) > 0.0001) return { error: "构图比例必须为 1:1、4:3 或 16:9" };
  return { value: { title, description, rows, columns, mime, aspectRatio, cropRatio } };
}
