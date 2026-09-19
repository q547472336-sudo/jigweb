"use client";

import Link from "next/link";
import { ArrowLeft, Clock, Trophy, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/client/api";

type LeaderboardItem = { rank: number; userId: string; displayName: string; elapsedMs: number; completedAt: string };
export function LeaderboardPage() {
  const [data, setData] = useState<{ date: string; items: LeaderboardItem[] }>(); const [error, setError] = useState("");
  useEffect(() => { apiRequest<{ date: string; items: LeaderboardItem[] }>("/leaderboard").then(setData).catch((reason) => setError(reason instanceof Error ? reason.message : "排行榜加载失败")); }, []);
  return <main className="leaderboard-page"><header className="simple-page-header"><Link href="/" className="icon-button" aria-label="返回发现"><ArrowLeft /></Link><div><p className="eyebrow">今日挑战</p><h1>排行榜</h1></div><Link className="button secondary" href="/challenge"><Clock />去挑战</Link></header><section className="leaderboard-card"><div className="leaderboard-card-head"><div><p className="eyebrow">{data?.date ?? "正在读取"}</p><h2>今天，谁最专注？</h2></div><Trophy size={30} /></div>{error ? <div className="empty-state"><WarningCircle size={30} /><p>{error}</p></div> : !data ? <div className="leaderboard-loading">正在加载榜单…</div> : data.items.length ? <div className="leaderboard-table" role="table" aria-label="今日挑战排行榜">{data.items.map((item) => <div className="leaderboard-row" role="row" key={item.userId}><strong>{item.rank}</strong><span>{item.displayName}</span><time>{formatDuration(item.elapsedMs)}</time></div>)}</div> : <div className="leaderboard-empty"><Trophy size={30} /><b>还没有正式成绩</b><span>完成今天的正式挑战后，你会出现在这里。</span><Link className="button primary" href="/challenge">开始挑战</Link></div>}</section></main>;
}
function formatDuration(value: number) { const safe = Math.max(0, value); return `${Math.floor(safe / 60000).toString().padStart(2, "0")}:${Math.floor(safe / 1000 % 60).toString().padStart(2, "0")}.${Math.floor(safe % 1000).toString().padStart(3, "0")}`; }
