import { notFound } from "next/navigation";
import { ModelLandingPage } from "@/components/model-landing-page";
import { isLocale, LOCALES } from "@/lib/locales";
import { CLAUDE_CONFIG } from "@/lib/model-landing";
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
    title: "Claude API pricing with one OpenAI-compatible key",
    description:
      "Use Claude through flatkey.ai with OpenAI-compatible routing, lower token costs, one API key, and unified billing.",
    pathname: "/models/claude-api",
    locale: params.locale,
  });
}

export default async function Page(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale) || params.locale === "en") notFound();
  return <ModelLandingPage config={CLAUDE_CONFIG} locale={params.locale} />;
}
