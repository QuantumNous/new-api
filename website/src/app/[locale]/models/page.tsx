import { notFound } from "next/navigation";
import { ModelsPage, parsePricingSearch } from "@/components/pricing-page";
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
  return buildMetadata({
    title: "AI model directory and live pricing",
    description: "Search flatkey.ai supported AI models by provider, endpoint, pricing type, and live availability.",
    pathname: "/models",
    locale: params.locale,
  });
}

export default async function Page(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale) || params.locale === "en") notFound();
  const searchParams = await props.searchParams;
  return <ModelsPage locale={params.locale} search={parsePricingSearch(searchParams)} />;
}
