import { BlogArticlePage } from "@/components/blog-pages";
import { getBlogPost } from "@/lib/blog";
import { buildMetadata } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata(props: Props) {
  const params = await props.params;
  const post = await getBlogPost(params.slug);
  return buildMetadata({
    title: post?.title ?? "Blog article",
    description: post?.summary ?? "Article from flatkey.ai.",
    pathname: `/blog/${params.slug}`,
    image: post?.cover,
  });
}

export default async function Page(props: Props) {
  const params = await props.params;
  return <BlogArticlePage locale="en" slug={params.slug} />;
}
