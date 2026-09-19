"use client";

import { useMemo, useState } from "react";
import type { PuzzleSummary } from "@/lib/client/types";
import { PuzzleCard } from "./puzzle-card";

export function ListingPage({ title, description, items }: { title: string; description?: string; items: PuzzleSummary[] }) {
  const [pieceRange, setPieceRange] = useState("");
  const [sort, setSort] = useState<"newest" | "popular">("newest");
  const [visible, setVisible] = useState(24);
  const filtered = useMemo(() => {
    const range = pieceRange ? pieceRange.split("-").map(Number) : undefined;
    return [...items]
      .filter((item) => !range || item.pieceCount >= range[0] && item.pieceCount <= range[1])
      .sort((a, b) => sort === "popular" ? b.playCount - a.playCount : b.createdAt.localeCompare(a.createdAt));
  }, [items, pieceRange, sort]);

  return (
    <main className="shell page-main">
      <header className="page-heading"><div><h1>{title}</h1>{description ? <p>{description}</p> : null}</div><span>{filtered.length} 幅拼图</span></header>
      <div className="filter-bar">
        <label><span>片数</span><select value={pieceRange} onChange={(event) => { setPieceRange(event.target.value); setVisible(24); }}><option value="">全部</option><option value="9-36">9 至 36</option><option value="37-100">37 至 100</option><option value="101-196">101 至 196</option><option value="197-500">197 至 500</option></select></label>
        <label><span>排序</span><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="newest">最新</option><option value="popular">最多人玩</option></select></label>
      </div>
      {filtered.length ? <div className="puzzle-grid">{filtered.slice(0, visible).map((puzzle) => <PuzzleCard key={puzzle.id} puzzle={puzzle} />)}</div> : <EmptyState />}
      {visible < filtered.length ? <button className="button secondary load-more" onClick={() => setVisible((value) => value + 24)}>加载更多</button> : null}
    </main>
  );
}

function EmptyState() {
  return <section className="empty-state"><h2>没有找到匹配的拼图</h2><p>调整片数条件，或者从其他分类继续发现。</p><button className="button secondary" onClick={() => location.reload()}>清除筛选</button></section>;
}
