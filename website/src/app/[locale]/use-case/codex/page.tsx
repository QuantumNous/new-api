import { notFound } from "next/navigation";
import { CODEX_USE_CASE, CodingAgentUseCasePage, getUseCaseConfig } from "@/components/coding-agent-use-case-page";
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
  if (!isLocale(params.locale)) return {};
  const config = getUseCaseConfig(CODEX_USE_CASE.pathname, params.locale);
  return buildMetadata({
    title: `${config.headlineLead} ${config.headlineAccent}`,
    description: config.intro,
    pathname: CODEX_USE_CASE.pathname,
    locale: params.locale,
  });
}

export default async function Page(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale) || params.locale === "en") notFound();
  return <CodingAgentUseCasePage config={CODEX_USE_CASE} locale={params.locale} />;
}
