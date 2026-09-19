"use client";

import Link from "next/link";
import { ArrowRight, Bell, Heart, Images, Medal } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { PuzzleCard } from "@/components/puzzle-card";
import { useApp } from "@/components/app-provider";
import { apiRequest } from "@/lib/client/api";
import type { PuzzleSummary } from "@/lib/client/types";

type Profile = { name: string; email: string; stats: { works: number; favorites: number; completed: number } };

export default function MePage() {
  const { user } = useApp();
  const [profile, setProfile] = useState<Profile>();
  const [recent, setRecent] = useState<PuzzleSummary[]>([]);
  useEffect(() => {
    if (!user) return;
    Promise.all([
      apiRequest<Profile>("/me", {}, user.id),
      apiRequest<{ items: PuzzleSummary[] }>("/me/collections/recent", {}, user.id),
    ]).then(([nextProfile, nextRecent]) => { setProfile(nextProfile); setRecent(nextRecent.items.slice(0, 4)); });
  }, [user]);
  const shown = profile ?? { name: user?.name ?? "玩家", email: user?.email ?? "", stats: { works: 0, favorites: 0, completed: 0 } };
  return <><header className="profile-header"><div className="profile-avatar">{shown.name.slice(0, 1)}</div><div><p className="eyebrow">我的主页</p><h1>{shown.name}</h1><p>{shown.email}</p></div><Link className="button secondary" href="/me/settings">编辑资料</Link></header><section className="stats-row"><div><b>{shown.stats.works}</b><span>我的作品</span></div><div><b>{shown.stats.favorites}</b><span>收藏</span></div><div><b>{shown.stats.completed}</b><span>完成</span></div></section><section className="dashboard-section"><div className="section-title"><h2>最近玩过</h2><Link href="/me/recent">查看全部<ArrowRight /></Link></div>{recent.length ? <div className="puzzle-grid personal">{recent.map((puzzle) => <PuzzleCard puzzle={puzzle} key={puzzle.id} />)}</div> : <div className="notification-empty"><p>开始拖动拼图片后，记录会显示在这里。</p></div>}</section><section className="quick-grid"><Link href="/me/works"><Images /><b>我的作品</b><span>管理自己创建的拼图</span></Link><Link href="/me/favorites"><Heart /><b>我的收藏</b><span>回到喜欢的画面</span></Link><Link href="/me/completed"><Medal /><b>我的完成</b><span>查看已经拼好的作品</span></Link><Link href="/me/notifications"><Bell /><b>消息通知</b><span>查看最近处理结果</span></Link></section></>;
}
