import { notFound } from "next/navigation";
import { CliMediaPromptDetailPage, getCliMediaDetailMetadata } from "@/components/cli-media-library-page";
import { getCliMediaPromptItems } from "@/lib/prompt-library";
import { isLocale, LOCALES } from "@/lib/locales";
import { buildMetadata } from "@/lib/seo";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== "en").flatMap((locale) =>
    getCliMediaPromptItems("image").map((item) => ({ locale, slug: item.slug })),
  );
}

export async function generateMetadata(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale)) return {};
  const meta = getCliMediaDetailMetadata("image", params.slug, params.locale);
  if (!meta) return {};
  return buildMetadata({
    title: meta.title,
    description: meta.description,
    pathname: meta.pathname,
    locale: params.locale,
  });
}

export default async function Page(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale) || params.locale === "en") notFound();
  const meta = getCliMediaDetailMetadata("image", params.slug, params.locale);
  if (!meta) notFound();
  return <CliMediaPromptDetailPage kind="image" locale={params.locale} slug={params.slug} />;
}
