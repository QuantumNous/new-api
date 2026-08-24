import { notFound } from "next/navigation";
import { SkagLandingPage } from "@/components/skag-landing-page";
import { isLocale } from "@/lib/locales";
import { getSkagLandingConfig, getSkagLandingLocales, getSkagLandingMetadataInput } from "@/lib/skag-landing";
import { buildMetadata } from "@/lib/seo";

type Props = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return getSkagLandingLocales("chinese-ai-models-api")
    .filter((locale) => locale !== "en")
    .map((locale) => ({ locale }));
}

export async function generateMetadata(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale) || !getSkagLandingLocales("chinese-ai-models-api").includes(params.locale)) return {};
  return buildMetadata(getSkagLandingMetadataInput("chinese-ai-models-api", params.locale));
}

export default async function Page(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale) || !getSkagLandingLocales("chinese-ai-models-api").includes(params.locale)) notFound();
  return <SkagLandingPage config={getSkagLandingConfig("chinese-ai-models-api", params.locale)} />;
}
