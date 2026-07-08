import { notFound } from "next/navigation";
import { RankingsPage } from "@/components/rankings-page";
import { getPageContent } from "@/content/pages";
import { isLocale, LOCALES } from "@/lib/locales";
import { buildMetadata } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };
const pathname = "/rankings";

// Data revalidates hourly; the daily curve itself is a pure function of the
// calendar date, so the page effectively updates once a day.
export const revalidate = 3600;

export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== "en").map((locale) => ({ locale }));
}

export async function generateMetadata(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale)) return {};
  const content = getPageContent("rankings", params.locale);
  return buildMetadata({ title: content.title, description: content.description, pathname, locale: params.locale });
}

export default async function Page(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale) || params.locale === "en") notFound();
  return <RankingsPage locale={params.locale} pathname={pathname} />;
}
