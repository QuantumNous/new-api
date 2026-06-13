import { notFound } from "next/navigation";
import { BlogCategoryPage } from "@/components/blog-pages";
import { isLocale, LOCALES } from "@/lib/locales";
import { buildMetadata } from "@/lib/seo";

type Props = { params: Promise<{ locale: string; slug: string }> };

export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== "en").map((locale) => ({ locale }));
}

export async function generateMetadata(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale)) return {};
  return buildMetadata({
    title: `Blog category: ${params.slug}`,
    description: "Browse flatkey.ai blog articles by category.",
    pathname: `/blog/category/${params.slug}`,
    locale: params.locale,
  });
}

export default async function Page(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale) || params.locale === "en") notFound();
  return <BlogCategoryPage locale={params.locale} slug={params.slug} />;
}
