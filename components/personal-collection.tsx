"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/client/api";
import type { PuzzleSummary } from "@/lib/client/types";
import { PersonalGrid } from "./personal-grid";
import { useApp } from "./app-provider";

export function PersonalCollection({ type, title, description, empty, personal = false }: { type: "works" | "favorites" | "completed" | "recent"; title: string; description: string; empty: string; personal?: boolean }) {
  const { user } = useApp();
  const [items, setItems] = useState<PuzzleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    apiRequest<{ items: PuzzleSummary[] }>(`/me/collections/${type}`, {}, user.id).then((result) => setItems(result.items)).catch(() => setItems([])).finally(() => setLoading(false));
  }, [type, user]);
  if (loading) return <section className="empty-state"><p>正在加载…</p></section>;
  return <PersonalGrid title={title} description={description} items={items} personal={personal} empty={empty} />;
}
