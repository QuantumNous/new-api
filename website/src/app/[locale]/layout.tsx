import { notFound } from "next/navigation";
import { RootDocument, rootMetadata } from "@/components/root-document";
import { DEFAULT_LOCALE, LOCALES, isLocale } from "@/lib/locales";
import "../globals.css";

export const metadata = rootMetadata;

type Props = Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>;

export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== DEFAULT_LOCALE).map((locale) => ({ locale }));
}

export default async function RootLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!isLocale(locale) || locale === DEFAULT_LOCALE) notFound();

  return <RootDocument lang={locale}>{children}</RootDocument>;
}
