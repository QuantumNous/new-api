import { notFound } from "next/navigation";
import { HiggsfieldAlternativePage } from "@/components/cli-landing-page";
import { HIGGSFIELD_ALTERNATIVE_PATH, higgsfieldAlternativeCopy } from "@/lib/cli-landing";
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
  const copy = higgsfieldAlternativeCopy[params.locale];
  return buildMetadata({
    title: copy.seo.title,
    description: copy.seo.description,
    pathname: HIGGSFIELD_ALTERNATIVE_PATH,
    locale: params.locale,
  });
}

export default async function Page(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale) || params.locale === "en") notFound();
  return <HiggsfieldAlternativePage locale={params.locale} />;
}
