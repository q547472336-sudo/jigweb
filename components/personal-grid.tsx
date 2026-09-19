import { PuzzleCard } from "./puzzle-card";
import type { PuzzleSummary } from "@/lib/client/types";

export function PersonalGrid({ title, description, items, personal = false, empty }: { title: string; description: string; items: PuzzleSummary[]; personal?: boolean; empty: string }) {
  return <><header className="page-heading"><div><h1>{title}</h1><p>{description}</p></div><span>{items.length} 项</span></header>{items.length ? <div className="puzzle-grid personal">{items.map((puzzle) => <PuzzleCard key={puzzle.id} puzzle={puzzle} personal={personal} />)}</div> : <section className="empty-state"><h2>{empty}</h2><p>从首页发现一幅喜欢的拼图吧。</p><a className="button secondary" href="/">去发现拼图</a></section>}</>;
}
