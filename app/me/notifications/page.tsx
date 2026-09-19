"use client";

import { Bell } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/client/api";
import { useApp } from "@/components/app-provider";

type Notification = { id: string; type: string; message: string; createdAt: string; readAt: string | null };

export default function NotificationsPage() {
  const { user } = useApp(); const [items, setItems] = useState<Notification[]>([]);
  useEffect(() => { if (user) apiRequest<{ items: Notification[] }>("/me/notifications", {}, user.id).then((result) => setItems(result.items)); }, [user]);
  async function readAll() { if (!user) return; await apiRequest("/me/notifications/read-all", { method: "POST" }, user.id); const at = new Date().toISOString(); setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? at }))); }
  return <><header className="page-heading"><div><h1>消息通知</h1><p>多人完成、反馈处理和作品下线通知</p></div><button className="button secondary" disabled={!items.some((item) => !item.readAt)} onClick={readAll}>全部已读</button></header>{items.length ? <section className="help-grid">{items.map((item) => <article key={item.id}><h2>{item.message}</h2><p>{new Date(item.createdAt).toLocaleString("zh-CN")} · {item.readAt ? "已读" : "未读"}</p></article>)}</section> : <section className="empty-state"><Bell size={36} /><h2>暂无通知</h2><p>有真实事件发生后会显示在这里。</p></section>}</>;
}
