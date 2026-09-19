"use client";

import Link from "next/link";
import { CheckCircle, Heart, LockSimple, Play } from "@phosphor-icons/react";
import type { PuzzleSummary } from "@/lib/client/types";
import { useApp } from "./app-provider";

export function PuzzleCard({ puzzle, personal = false }: { puzzle: PuzzleSummary; personal?: boolean }) {
  const { favorites, toggleFavorite } = useApp();
  const favorite = favorites.has(puzzle.id);
  return (
    <article className="puzzle-card">
      <Link href={`/puzzle/${puzzle.id}`} className="puzzle-card-link" aria-label={`${puzzle.title}，${puzzle.pieceCount}片`}>
        <div className="puzzle-cover" style={{ aspectRatio: puzzle.aspectRatio }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={puzzle.imageUrl} alt="" />
          {puzzle.playState === "completed" ? <span className="cover-state complete"><CheckCircle weight="fill" />已完成</span> : null}
          {puzzle.playState === "in_progress" ? <div className="progress-overlay"><span style={{ width: `${puzzle.progress ?? 0}%` }} /><b>{puzzle.progress}%</b></div> : null}
          <span className="play-button" aria-hidden="true"><Play weight="fill" /></span>
        </div>
        <div className="puzzle-info">
          <h3>{puzzle.title}</h3>
          <p>{personal ? `${new Date(puzzle.createdAt).toLocaleDateString("zh-CN")} · ${puzzle.visibility === "private" ? "仅自己可见" : "公开"}` : puzzle.author.name}</p>
          <div><span>{puzzle.pieceCount} 片</span><span>{puzzle.playCount.toLocaleString("zh-CN")} 人玩过</span>{personal && puzzle.visibility === "private" ? <LockSimple aria-label="私有" /> : null}</div>
        </div>
      </Link>
      <button className={`favorite-button ${favorite ? "active" : ""}`} aria-label={favorite ? "取消收藏" : "收藏"} onClick={() => toggleFavorite(puzzle.id)}><Heart weight={favorite ? "fill" : "regular"} /></button>
    </article>
  );
}
