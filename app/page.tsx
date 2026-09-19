import Link from "next/link";
import { ArrowRight, Clock, Trophy } from "@phosphor-icons/react/dist/ssr";
import { SiteHeader } from "@/components/site-header";
import { HomeHero } from "@/components/home-hero";
import { PuzzleCard } from "@/components/puzzle-card";
import { store } from "@/lib/server/local-store";
import { puzzleSummary } from "@/lib/server/puzzle-summary";

const puzzles = [...store.puzzles.values()].filter((puzzle) => puzzle.visibility === "public" && puzzle.status === "published").map((puzzle) => puzzleSummary(puzzle, null));

export default function HomePage() {
  return <><SiteHeader /><main className="shell home-main"><section className="home-layout"><div>
    <HomeHero slides={puzzles.slice(0, 3).map((puzzle) => ({ id: puzzle.id, title: puzzle.title, imageUrl: puzzle.imageUrl, pieceCount: puzzle.pieceCount }))} />
    <PuzzleSection title="热门拼图" type="popular" items={puzzles.slice(0, 8)} /><PuzzleSection title="编辑推荐" type="featured" items={puzzles.slice(8, 16)} /><PuzzleSection title="新上架" type="new" items={puzzles.slice(16, 24)} />
  </div><aside className="home-sidebar"><section className="challenge-card"><Clock size={24} /><p>今日挑战</p><h2>晨雾山谷 · 64 片</h2><span>和今天的玩家使用同一幅图和排列。</span><Link className="button primary wide" href="/challenge">开始今日挑战</Link></section><section className="leader-card"><div className="section-title"><h2>今日排行榜</h2><Trophy /></div>{["Juno", "Mori", "Lina", "Theo", "Maple"].map((name, index) => <div className="leader-row" key={name}><b>{index + 1}</b><span>{name}</span><time>{`0${2 + index}:${14 + index * 7}`}</time></div>)}<Link href="/leaderboard" className="text-link">查看完整榜单<ArrowRight /></Link></section><section className="create-callout"><h2>把自己的照片变成拼图</h2><p>上传、裁剪和设置都在一个页面完成。</p><Link className="button secondary wide" href="/create">创建作品</Link></section></aside></section></main></>;
}

function PuzzleSection({ title, type, items }: { title: string; type: string; items: typeof puzzles }) {
  return <section className="puzzle-section"><div className="section-title"><h2>{title}</h2><Link href={`/collections/${type}`}>查看全部<ArrowRight /></Link></div><div className="puzzle-grid compact">{items.map((puzzle) => <PuzzleCard key={puzzle.id} puzzle={puzzle} />)}</div></section>;
}
