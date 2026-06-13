import { notFound } from "next/navigation";
import { BlogIndexPage } from "@/components/blog-pages";
import { isLocale, LOCALES } from "@/lib/locales";
import { buildMetadata } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== "en").map((locale) => ({ locale }));
}

export async function generateMetadata(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale)) return {};
  return buildMetadata({
    title: "Blog",
    description: "AI API gateway, model routing, billing, and operations articles from flatkey.ai.",
    pathname: "/blog",
    locale: params.locale,
  });
}

export default async function Page(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale) || params.locale === "en") notFound();
  return <BlogIndexPage locale={params.locale} />;
}
