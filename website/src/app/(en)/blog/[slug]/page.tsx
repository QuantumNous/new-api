import { BlogArticlePage } from "@/components/blog-pages";
import { getBlogPost } from "@/lib/blog";
import { getCopy } from "@/lib/copy";
import { buildMetadata } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata(props: Props) {
  const params = await props.params;
  const post = await getBlogPost(params.slug, "en");
  const copy = getCopy("en").blog;
  return buildMetadata({
    title: post?.title ?? copy.articleFallbackTitle,
    description: post?.summary ?? copy.articleFallbackDescription,
    pathname: `/blog/${params.slug}`,
    image: post?.cover,
  });
}

export default async function Page(props: Props) {
  const params = await props.params;
  return <BlogArticlePage locale="en" slug={params.slug} />;
}
