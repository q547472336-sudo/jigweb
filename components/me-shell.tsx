"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ClockCounterClockwise, Gear, Heart, House, Images, Medal, Question } from "@phosphor-icons/react";
import { SiteHeader } from "./site-header";
import { useApp } from "./app-provider";

const links = [["/me", "概览", House], ["/me/works", "我的作品", Images], ["/me/favorites", "我的收藏", Heart], ["/me/completed", "我的完成", Medal], ["/me/recent", "最近玩过", ClockCounterClockwise], ["/me/notifications", "消息通知", Bell], ["/me/settings", "账号设置", Gear], ["/help", "帮助与反馈", Question]] as const;

export function MeShell({ children }: { children: React.ReactNode }) {
  const path = usePathname(); const { user, requestLogin } = useApp();
  return <><SiteHeader /><main className="shell me-layout"><aside className="me-sidebar">{links.map(([href, label, Icon]) => <Link key={href} href={href} className={path === href ? "active" : ""}><Icon /><span>{label}</span></Link>)}</aside><section className="me-content">{user ? children : <div className="login-gate"><House size={42} /><h1>登录后查看个人空间</h1><p>继续拼图、收藏和创建记录都会汇集在这里。</p><button className="button primary" onClick={() => requestLogin()}>邮箱登录</button></div>}</section></main></>;
}
