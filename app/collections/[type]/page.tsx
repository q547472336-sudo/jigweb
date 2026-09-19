import { SiteHeader } from "@/components/site-header";
import { RemoteListingPage } from "@/components/remote-listing-page";

const names: Record<string, string> = { popular: "热门拼图", featured: "编辑推荐", new: "新上架" };
export default async function CollectionPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  return <><SiteHeader /><RemoteListingPage title={names[type] ?? "拼图集合"} query={`sort=${type === "popular" ? "popular" : "newest"}`} /></>;
}
