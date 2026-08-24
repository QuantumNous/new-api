import { notFound } from "next/navigation";
import { CliMediaLibraryPage, getCliMediaMetadata } from "@/components/cli-media-library-page";
import { CLI_IMAGE_PATH } from "@/lib/cli-landing";
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
  const meta = getCliMediaMetadata("image", params.locale);
  return buildMetadata({
    title: meta.title,
    description: meta.description,
    pathname: CLI_IMAGE_PATH,
    locale: params.locale,
  });
}

export default async function Page(props: Props) {
  const params = await props.params;
  if (!isLocale(params.locale) || params.locale === "en") notFound();
  return <CliMediaLibraryPage kind="image" locale={params.locale} />;
}
