import { SiteHeader } from "@/components/site-header";
import { RemoteListingPage } from "@/components/remote-listing-page";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  return <><SiteHeader /><RemoteListingPage title={q ? `“${q}”的搜索结果` : "搜索拼图"} description={q ? "按作品名、描述或作者匹配，多个词同时满足" : "在顶部输入关键词开始搜索"} query={q ? `q=${encodeURIComponent(q)}` : ""} /></>;
}
