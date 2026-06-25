import { BlogCategoryPage, parseBlogSearch } from "@/components/blog-pages";
import { formatBlogCopy } from "@/lib/blog-copy";
import { getCopy } from "@/lib/copy";
import { buildMetadata } from "@/lib/seo";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata(props: Props) {
  const params = await props.params;
  const copy = getCopy("en").blog;
  return buildMetadata({
    title: formatBlogCopy(copy.categoryTitle, { category: params.slug }),
    description: copy.categoryFallbackDescription,
    pathname: `/blog/category/${params.slug}`,
  });
}

export default async function Page(props: Props) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  return <BlogCategoryPage locale="en" slug={params.slug} search={parseBlogSearch(searchParams)} />;
}
