"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { ImageSquare, UploadSimple } from "@phosphor-icons/react";
import { SiteHeader } from "@/components/site-header";
import { useApp } from "@/components/app-provider";
import { apiRequest } from "@/lib/client/api";

const ratios = { "1:1": 1, "4:3": 4 / 3, "3:4": 3 / 4, "16:9": 16 / 9, "9:16": 9 / 16 };
const presets = [[3, 3], [4, 4], [6, 6], [8, 8], [11, 11], [14, 14]];

async function cropForGame(source: string, sourceWidth: number, sourceHeight: number, targetRatio: number, mimeType: string) {
  const sourceRatio = sourceWidth / sourceHeight;
  const cropWidth = sourceRatio > targetRatio ? sourceHeight * targetRatio : sourceWidth;
  const cropHeight = sourceRatio > targetRatio ? sourceHeight : sourceWidth / targetRatio;
  if (Math.min(cropWidth, cropHeight) < 300) throw new Error("当前比例的裁剪区域短边不足 300px，请选择其他图片或比例");
  const scale = Math.min(1, 2048 / Math.max(cropWidth, cropHeight));
  const canvas = document.createElement("canvas"); canvas.width = Math.round(cropWidth * scale); canvas.height = Math.round(cropHeight * scale);
  const bitmap = await new Promise<HTMLImageElement>((resolve, reject) => { const value = new window.Image(); value.onload = () => resolve(value); value.onerror = reject; value.src = source; });
  canvas.getContext("2d")?.drawImage(bitmap, (sourceWidth - cropWidth) / 2, (sourceHeight - cropHeight) / 2, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(mimeType === "image/png" ? "image/png" : "image/jpeg", 0.9);
}

export default function CreatePage() {
  const { user, requestLogin } = useApp();
  const [image, setImage] = useState<string>();
  const [ratio, setRatio] = useState<keyof typeof ratios>("4:3");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("风景");
  const [rows, setRows] = useState(6);
  const [columns, setColumns] = useState(6);
  const [shape, setShape] = useState("classic");
  const [visibility, setVisibility] = useState("private");
  const [fileMeta, setFileMeta] = useState<{ mimeType: string; bytes: number; width: number; height: number }>();
  const [createdId, setCreatedId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const count = rows * columns;
  const valid = Boolean(image && title.trim() && rows >= 3 && columns >= 3 && rows <= 25 && columns <= 25 && count <= 500);
  const grid = useMemo(() => Array.from({ length: Math.min(count, 196) }), [count]);

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    setError("");
    if (![/^image\/jpeg$/, /^image\/png$/, /^image\/webp$/].some((type) => type.test(file.type)) || file.size > 10 * 1024 * 1024) { setError("仅支持 10MB 内的 JPEG、PNG 或静态 WebP"); return; }
    const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => { const preview = new window.Image(); preview.onload = () => resolve({ width: preview.naturalWidth, height: preview.naturalHeight }); preview.onerror = reject; preview.src = dataUrl; });
    if (dimensions.width < 300 || dimensions.height < 300 || dimensions.width * dimensions.height > 20_000_000) { setError("图片宽高需至少 300px，且不能超过 2000 万像素"); return; }
    setImage(dataUrl); setFileMeta({ mimeType: file.type, bytes: file.size, ...dimensions });
  }

  async function createPuzzle(event: React.FormEvent) {
    event.preventDefault(); if (!valid || !user || !fileMeta || !image) return;
    setBusy(true); setError("");
    try {
      const croppedImage = await cropForGame(image, fileMeta.width, fileMeta.height, ratios[ratio], fileMeta.mimeType);
      const upload = await apiRequest<{ uploadToken: string }>("/uploads/sign", { method: "POST", body: JSON.stringify(fileMeta) }, user.id);
      const result = await apiRequest<{ puzzle: { id: string } }>("/puzzles", { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ title, description, category, categorySlug: "other", rows, columns, shape, visibility, mimeType: fileMeta.mimeType, bytes: fileMeta.bytes, width: fileMeta.width, height: fileMeta.height, aspectRatio: ratios[ratio], cropRatio: ratio, uploadToken: upload.uploadToken, previewUrl: croppedImage }) }, user.id);
      setCreatedId(result.puzzle.id);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "创建失败，请重试"); }
    finally { setBusy(false); }
  }

  return <><SiteHeader /><main className="shell create-page"><header className="page-heading"><div><p className="eyebrow">单页完成</p><h1>创建你的拼图</h1><p>上传图片、调整构图并即时预览。</p></div></header>{!user ? <section className="login-gate"><ImageSquare size={42} /><h2>登录后开始创建</h2><p>作品和原图会安全保存在你的账号中。</p><button className="button primary" onClick={() => requestLogin()}>邮箱登录</button></section> : <div className="create-layout"><form className="creation-form" onSubmit={createPuzzle}>
    <FormSection title="1. 图片"><label className="upload-field"><UploadSimple size={28} /><b>{image ? "更换图片" : "选择或拖入图片"}</b><span>JPEG、PNG、静态 WebP，最大 10MB</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseFile} /></label></FormSection>
    <FormSection title="2. 构图比例"><div className="segmented">{Object.keys(ratios).map((value) => <button type="button" className={ratio === value ? "active" : ""} onClick={() => setRatio(value as keyof typeof ratios)} key={value}>{value}</button>)}</div></FormSection>
    <FormSection title="3. 作品信息"><label className="field"><span>名称</span><input value={title} maxLength={60} onChange={(event) => setTitle(event.target.value)} placeholder="给这幅拼图起个名字" /></label><label className="field"><span>描述</span><textarea value={description} maxLength={500} onChange={(event) => setDescription(event.target.value)} placeholder="补充一点关于这幅图的故事" /></label><label className="field"><span>分类</span><select value={category} onChange={(event) => setCategory(event.target.value)}>{["风景", "艺术", "动物", "插画", "建筑", "日常", "美食", "人物", "节日", "其他"].map((item) => <option key={item}>{item}</option>)}</select></label></FormSection>
    <FormSection title="4. 拼图设置"><div className="preset-grid">{presets.map(([r, c]) => <button type="button" className={rows === r && columns === c ? "active" : ""} onClick={() => { setRows(r); setColumns(c); }} key={`${r}x${c}`}>{r * c}<small>{r} × {c}</small></button>)}</div><div className="custom-size"><label className="field"><span>行</span><input type="number" min={3} max={25} value={rows} onChange={(event) => setRows(Number(event.target.value))} /></label><span>×</span><label className="field"><span>列</span><input type="number" min={3} max={25} value={columns} onChange={(event) => setColumns(Number(event.target.value))} /></label><b>{count} 片</b></div>{count > 500 ? <p className="field-error">最多 500 片</p> : null}<div className="segmented"><button type="button" className={shape === "classic" ? "active" : ""} onClick={() => setShape("classic")}>经典凹凸</button><button type="button" className={shape === "square" ? "active" : ""} onClick={() => setShape("square")}>直边矩形</button></div></FormSection>
    <FormSection title="5. 可见性"><div className="segmented"><button type="button" className={visibility === "private" ? "active" : ""} onClick={() => setVisibility("private")}>仅自己可见</button><button type="button" className={visibility === "public" ? "active" : ""} onClick={() => setVisibility("public")}>公开</button></div></FormSection>
    {error ? <p className="field-error" role="alert">{error}</p> : null}<button className="button primary wide create-submit" disabled={!valid || busy}>{busy ? "正在创建…" : "创建拼图"}</button>
  </form><aside className="creation-preview"><div className="preview-sticky"><div className="section-title"><h2>实时预览</h2><span>{count} 片</span></div><div className="preview-image" style={{ aspectRatio: ratios[ratio] }}>{image ? <><img src={image} alt="裁剪预览" /><div className="preview-grid" style={{ gridTemplateColumns: `repeat(${columns},1fr)` }}>{grid.map((_, index) => <span key={index} />)}</div></> : <div className="preview-empty"><ImageSquare size={38} /><span>选择图片后显示预览</span></div>}</div><h3>{title || "未命名拼图"}</h3><p>{category} · {shape === "classic" ? "经典凹凸" : "直边矩形"} · {visibility === "private" ? "仅自己可见" : "公开"}</p></div></aside></div>}</main>{createdId ? <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true"><p className="eyebrow">创建成功</p><h2>{title}</h2><p className="muted">作品已保存，可以立即开始或在“我的作品”中找到它。</p><a className="button primary wide" href={`/puzzle/${createdId}`}>开始拼图</a><a className="button ghost wide" href="/me/works">前往我的作品</a></section></div> : null}</>;
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="form-section"><h2>{title}</h2>{children}</section>; }
