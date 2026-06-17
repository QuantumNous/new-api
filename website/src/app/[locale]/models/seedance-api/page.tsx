import { notFound } from "next/navigation";
import { ModelLandingPage } from "@/components/model-landing-page";
import { isLocale, LOCALES } from "@/lib/locales";
import { SEEDANCE_CONFIG } from "@/lib/model-landing";
import { buildMetadata } from "@/lib/seo";

type Props = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== "en").map((locale) => ({ locale }));
}

export async function generateMetadata(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale)) return {};
  return buildMetadata({
    title: "Seedance video API — cheaper than official, OpenAI-compatible key",
    description:
      "Generate Seedance text/image-to-video through flatkey.ai at lower per-second cost, with OpenAI-compatible routing, one API key, and unified billing.",
    pathname: "/models/seedance-api",
    locale: params.locale,
  });
}

export default async function Page(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale) || params.locale === "en") notFound();
  return <ModelLandingPage config={SEEDANCE_CONFIG} locale={params.locale} />;
}
