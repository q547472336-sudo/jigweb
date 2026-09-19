"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/client/api";
import type { PuzzleSummary } from "@/lib/client/types";
import { ListingPage } from "./listing-page";

export function RemoteListingPage({ title, description, query }: { title: string; description?: string; query: string }) {
  const [items, setItems] = useState<PuzzleSummary[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => { if (!query) { setItems([]); setLoading(false); return; } setLoading(true); setError(""); apiRequest<{ items: PuzzleSummary[] }>(`/puzzles?${query}`).then((result) => setItems(result.items)).catch((reason) => setError(reason instanceof Error ? reason.message : "加载失败")).finally(() => setLoading(false)); }, [query]);
  if (loading) return <main className="shell page-main"><section className="empty-state"><p>正在加载拼图…</p></section></main>;
  if (error) return <main className="shell page-main"><section className="empty-state"><h2>加载失败</h2><p>{error}</p></section></main>;
  return <ListingPage title={title} description={description} items={items} />;
}
