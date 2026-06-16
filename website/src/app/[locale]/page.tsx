import { notFound } from "next/navigation";
import { HomePage } from "@/components/home-page";
import { getCopy } from "@/lib/copy";
import { isLocale, LOCALES, type Locale } from "@/lib/locales";
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
  const copy = getCopy(params.locale);
  return buildMetadata({
    title: copy.home.title,
    description: copy.home.description,
    pathname: "/",
    locale: params.locale,
  });
}

export default async function Page(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale) || params.locale === "en") notFound();
  return <HomePage locale={params.locale as Locale} />;
}
