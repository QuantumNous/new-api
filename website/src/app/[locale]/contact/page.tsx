import { notFound } from "next/navigation";
import { ContactPage } from "@/components/contact-page";
import { getHomeCopy } from "@/lib/home-copy";
import { isLocale, LOCALES } from "@/lib/locales";
import { buildMetadata } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };
const pathname = "/contact";

export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== "en").map((locale) => ({ locale }));
}

export async function generateMetadata(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale)) return {};
  const support = getHomeCopy(params.locale).support;
  return buildMetadata({ title: support.title, description: support.description, pathname, locale: params.locale });
}

export default async function Page(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale) || params.locale === "en") notFound();
  return <ContactPage locale={params.locale} />;
}
