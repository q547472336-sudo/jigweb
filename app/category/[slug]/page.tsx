import { SiteHeader } from "@/components/site-header";
import { RemoteListingPage } from "@/components/remote-listing-page";

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const category = decodeURIComponent(slug);
  return <><SiteHeader /><RemoteListingPage title={`${category}拼图`} description={`浏览关于${category}的公开作品`} query={`category=${encodeURIComponent(category)}`} /></>;
}
