import { notFound } from "next/navigation";
import { ToolsLandingPage } from "@/components/tools-landing-page";
import { isLocale, LOCALES } from "@/lib/locales";
import { getToolsLandingMetadataInput } from "@/lib/tools-landing";
import { buildMetadata } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== "en").map((locale) => ({ locale }));
}

export async function generateMetadata(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale) || params.locale === "en") return {};
  return buildMetadata(getToolsLandingMetadataInput(params.locale));
}

export default async function Page(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale) || params.locale === "en") notFound();
  return <ToolsLandingPage locale={params.locale} />;
}
