"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/client/api";
import type { PuzzleSummary } from "@/lib/client/types";
import { useApp } from "./app-provider";
import { PuzzleGame } from "./puzzle-game";

export function PuzzleLoader({ id }: { id: string }) {
  const { user, authReady } = useApp();
  const [puzzle, setPuzzle] = useState<PuzzleSummary>();
  const [error, setError] = useState("");
  useEffect(() => {
    if (!authReady) return;
    setError("");
    apiRequest<PuzzleSummary>(`/puzzles/${id}`, {}, user?.id).then(setPuzzle).catch((reason) => setError(reason instanceof Error ? reason.message : "作品加载失败"));
  }, [authReady, id, user?.id]);
  if (error) return <main className="reserved-page"><p className="eyebrow">无法打开</p><h1>{error}</h1><Link className="button primary" href="/">返回发现</Link></main>;
  if (!puzzle) return <main className="reserved-page"><p className="eyebrow">正在准备棋盘</p><h1>加载拼图…</h1></main>;
  return <PuzzleGame puzzle={puzzle} />;
}
