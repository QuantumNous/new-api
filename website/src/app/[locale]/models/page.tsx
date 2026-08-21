import { notFound } from "next/navigation";
import { ModelsPage, parsePricingSearch } from "@/components/pricing-page";
import { isLocale, LOCALES } from "@/lib/locales";
import { buildDirectorySeo } from "@/lib/model-directory-seo";
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
  const searchParams = await props.searchParams;
  const seo = buildDirectorySeo(params.locale, searchParams);
  return buildMetadata({
    title: seo.title,
    description: seo.description,
    pathname: seo.canonicalQuery ? `/models?${seo.canonicalQuery}` : "/models",
    locale: params.locale,
    noIndex: seo.noIndex,
  });
}

export default async function Page(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale) || params.locale === "en") notFound();
  const searchParams = await props.searchParams;
  return <ModelsPage locale={params.locale} search={parsePricingSearch(searchParams)} searchParams={searchParams} />;
}
