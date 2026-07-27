import { notFound } from "next/navigation";
import { CliLandingPage } from "@/components/cli-landing-page";
import { CLI_LANDING_PATH, cliLandingCopy } from "@/lib/cli-landing";
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
  const copy = cliLandingCopy[params.locale];
  return buildMetadata({
    title: copy.seo.title,
    description: copy.seo.description,
    pathname: CLI_LANDING_PATH,
    locale: params.locale,
  });
}

export default async function Page(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale) || params.locale === "en") notFound();
  return <CliLandingPage locale={params.locale} />;
}
