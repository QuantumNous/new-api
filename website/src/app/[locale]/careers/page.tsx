import { notFound } from "next/navigation";
import { CareersPage } from "@/components/careers-page";
import { buildMetadata } from "@/lib/seo";
import { isLocale, type Locale } from "@/lib/locales";

// Careers currently ships in English and Chinese only; other locales 404
// instead of showing untranslated copy.
const CAREERS_LOCALES: Locale[] = ["zh"];

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale) || !CAREERS_LOCALES.includes(locale)) return {};
  return buildMetadata({
    title: "加入我们 — 来硅谷建一家 AI-native 公司",
    description: "加入 San Jose 一支小而快乐的 AI-native 团队：每个人带一队 agent 工作。我们招真正动手做出过东西的 Builder 和增长工程师。",
    pathname: "/careers",
    locale,
    locales: ["en", "zh"],
  });
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale) || !CAREERS_LOCALES.includes(locale)) notFound();
  return <CareersPage locale={locale} pathname="/careers" />;
}
