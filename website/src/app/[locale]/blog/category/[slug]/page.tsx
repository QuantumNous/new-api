import { notFound } from "next/navigation";
import { BlogCategoryPage, parseBlogSearch } from "@/components/blog-pages";
import { formatBlogCopy } from "@/lib/blog-copy";
import { getCopy } from "@/lib/copy";
import { isLocale } from "@/lib/locales";
import { buildMetadata } from "@/lib/seo";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale)) return {};
  const copy = getCopy(params.locale).blog;
  return buildMetadata({
    title: formatBlogCopy(copy.categoryTitle, { category: params.slug }),
    description: copy.categoryFallbackDescription,
    pathname: `/blog/category/${params.slug}`,
    locale: params.locale,
  });
}

export default async function Page(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale) || params.locale === "en") notFound();
  const searchParams = await props.searchParams;
  return <BlogCategoryPage locale={params.locale} slug={params.slug} search={parseBlogSearch(searchParams)} />;
}
