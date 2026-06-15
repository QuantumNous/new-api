import { notFound } from "next/navigation";
import { PricingPage, parsePricingSearch } from "@/components/pricing-page";
import { getPageContent } from "@/content/pages";
import { isLocale, LOCALES } from "@/lib/locales";
import { buildMetadata } from "@/lib/seo";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};
const pageKey = "pricing";
const pathname = "/pricing";

export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== "en").map((locale) => ({ locale }));
}

export async function generateMetadata(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale)) return {};
  const content = getPageContent(pageKey, params.locale);
  return buildMetadata({ title: content.title, description: content.description, pathname, locale: params.locale });
}

export default async function Page(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale) || params.locale === "en") notFound();
  const searchParams = await props.searchParams;
  return <PricingPage locale={params.locale} search={parsePricingSearch(searchParams)} />;
}
