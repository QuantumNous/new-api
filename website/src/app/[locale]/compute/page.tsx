import { notFound } from "next/navigation";
import { StaticFeaturePage } from "@/components/static-feature-page";
import { isLocale, LOCALES } from "@/lib/locales";
import { buildMetadata } from "@/lib/seo";
import { staticFeaturePages } from "@/lib/static-feature-pages";

type Props = {
  params: Promise<{ locale: string }>;
};

const page = staticFeaturePages.compute;

export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== "en").map((locale) => ({ locale }));
}

export async function generateMetadata(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale)) return {};
  return buildMetadata({ title: page.metadataTitle, description: page.metadataDescription, pathname: page.pathname, locale: params.locale });
}

export default async function Page(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale) || params.locale === "en") notFound();
  return <StaticFeaturePage pageKey="compute" locale={params.locale} />;
}
