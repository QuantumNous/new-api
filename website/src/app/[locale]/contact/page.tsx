import { notFound } from "next/navigation";
import { OnlineContactPage } from "@/components/online-contact-page";
import { DEFAULT_LOCALE, isLocale, LOCALES } from "@/lib/locales";
import { buildMetadata } from "@/lib/seo";

type Props = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== DEFAULT_LOCALE).map((locale) => ({ locale }));
}

export async function generateMetadata(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale)) return {};
  return buildMetadata({
    title: "flatkey - Contact sales",
    description:
      "Talk to flatkey sales for enterprise contracts below self-serve pricing, invoices, token governance and SLA support.",
    pathname: "/contact",
    locale: params.locale,
  });
}

export default async function Page(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale) || params.locale === DEFAULT_LOCALE) notFound();
  return <OnlineContactPage locale={params.locale} />;
}
