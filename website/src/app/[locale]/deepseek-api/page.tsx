import { notFound } from "next/navigation";
import { SkagLandingPage } from "@/components/skag-landing-page";
import { isLocale } from "@/lib/locales";
import { getSkagLandingConfig, getSkagLandingLocales, getSkagLandingMetadataInput } from "@/lib/skag-landing";
import { buildMetadata } from "@/lib/seo";

type Props = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return getSkagLandingLocales("deepseek-api")
    .filter((locale) => locale !== "en")
    .map((locale) => ({ locale }));
}

export async function generateMetadata(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale) || !getSkagLandingLocales("deepseek-api").includes(params.locale)) return {};
  return buildMetadata(getSkagLandingMetadataInput("deepseek-api", params.locale));
}

export default async function Page(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale) || !getSkagLandingLocales("deepseek-api").includes(params.locale)) notFound();
  return <SkagLandingPage config={getSkagLandingConfig("deepseek-api", params.locale)} />;
}
