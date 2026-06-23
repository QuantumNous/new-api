import { notFound } from "next/navigation";
import { EdmLandingPage } from "@/components/edm-landing-page";
import { getEdmCampaign, getEdmMetadataInput } from "@/lib/edm-landing";
import { isLocale, LOCALES } from "@/lib/locales";
import { buildMetadata } from "@/lib/seo";

type Props = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== "en").map((locale) => ({ locale }));
}

export async function generateMetadata(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale) || params.locale === "en") return {};
  return buildMetadata(getEdmMetadataInput("cto-ai-savings", params.locale));
}

export default async function Page(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale) || params.locale === "en") notFound();
  return <EdmLandingPage campaign={getEdmCampaign("cto-ai-savings", params.locale)} locale={params.locale} pathname="/lp/cto-ai-savings" />;
}
