import { notFound } from "next/navigation";
import { BlogIndexPage, parseBlogSearch } from "@/components/blog-pages";
import { getCopy } from "@/lib/copy";
import { isLocale, LOCALES } from "@/lib/locales";
import { buildMetadata } from "@/lib/seo";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== "en").map((locale) => ({ locale }));
}

export async function generateMetadata(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale)) return {};
  const copy = getCopy(params.locale).blog;
  return buildMetadata({
    title: copy.title,
    description: copy.description,
    pathname: "/blog",
    locale: params.locale,
  });
}

export default async function Page(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale) || params.locale === "en") notFound();
  const searchParams = await props.searchParams;
  return <BlogIndexPage locale={params.locale} search={parseBlogSearch(searchParams)} />;
}
