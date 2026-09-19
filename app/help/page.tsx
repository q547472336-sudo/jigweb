"use client";

import { FormEvent, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { useApp } from "@/components/app-provider";
import { apiRequest } from "@/lib/client/api";

export default function HelpPage() {
  const { user, requestLogin } = useApp(); const [type, setType] = useState("功能问题"); const [description, setDescription] = useState(""); const [ticket, setTicket] = useState(""); const [error, setError] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); if (!user) { requestLogin(); return; } setError(""); try { const result = await apiRequest<{ ticketNo: string }>("/feedback", { method: "POST", body: JSON.stringify({ type, description }) }, user.id); setTicket(result.ticketNo); setDescription(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "提交失败"); } }
  return <><SiteHeader /><main className="shell page-main help-page"><header className="page-heading"><div><h1>帮助与反馈</h1><p>查找拼图、保存和创建作品的常见问题。</p></div></header><section className="help-grid">{[["怎样保存拼图进度？","首次有效拖动后自动保存在当前浏览器。登录后还会同步到云端。"],["为什么挑战暂停后看不到画面？","暂停会遮住画布、托盘和原图，保证挑战计时公平。"],["私有作品可以分享吗？","V1 的私有作品仅自己可见，也不能创建多人房间。"]].map(([title, body]) => <article key={title}><h2>{title}</h2><p>{body}</p></article>)}</section><form className="feedback-form" onSubmit={submit}><h2>提交反馈</h2><label className="field"><span>类型</span><select value={type} onChange={(event) => setType(event.target.value)}><option>功能问题</option><option>建议</option><option>其他</option></select></label><label className="field"><span>描述</span><textarea required minLength={1} maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="请描述遇到的问题" /></label>{ticket ? <p className="save-status">已受理，编号：{ticket}</p> : null}{error ? <p className="field-error" role="alert">{error}</p> : null}<button className="button primary">{user ? "提交反馈" : "登录后提交"}</button></form></main></>;
}
