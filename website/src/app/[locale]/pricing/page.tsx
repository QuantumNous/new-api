import { notFound } from "next/navigation";
import { OnlinePricingPage } from "@/components/online-pricing-page";
import { DEFAULT_LOCALE, isLocale, LOCALES } from "@/lib/locales";
import { buildMetadata } from "@/lib/seo";

type Props = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== DEFAULT_LOCALE).map((locale) => ({ locale }));
}

export async function generateMetadata(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale)) return {};
  return buildMetadata({
    title: "flatkey - Pricing",
    description:
      "flatkey pricing with Go, Pro, Max and Enterprise plans covering official models and production usage controls.",
    pathname: "/pricing",
    locale: params.locale,
  });
}

export default async function Page(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale) || params.locale === DEFAULT_LOCALE) notFound();
  return <OnlinePricingPage locale={params.locale} />;
}
