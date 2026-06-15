import { notFound } from "next/navigation";
import { PublicPage } from "@/components/public-page";
import { getPageContent } from "@/content/pages";
import { isLocale, LOCALES } from "@/lib/locales";
import { buildMetadata } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };
const pageKey = "rankings";
const pathname = "/rankings";

export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== "en").map((locale) => ({ locale }));
}

export async function generateMetadata(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale)) return {};
  const content = getPageContent(pageKey, params.locale);
  return buildMetadata({ title: content.title, description: content.description, pathname, locale: params.locale });
}

export default async function Page(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale) || params.locale === "en") notFound();
  return <PublicPage locale={params.locale} pageKey={pageKey} pathname={pathname} />;
}
