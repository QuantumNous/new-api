import { BlogCategoryPage } from "@/components/blog-pages";
import { buildMetadata } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata(props: Props) {
  const params = await props.params;
  return buildMetadata({
    title: `Blog category: ${params.slug}`,
    description: "Browse flatkey.ai blog articles by category.",
    pathname: `/blog/category/${params.slug}`,
  });
}

export default async function Page(props: Props) {
  const params = await props.params;
  return <BlogCategoryPage locale="en" slug={params.slug} />;
}
