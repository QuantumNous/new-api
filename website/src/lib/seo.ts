import type { Metadata } from "next";
import { DEFAULT_LOCALE, type Locale, localeAlternates, localizePath } from "./locales";

export const SITE_ORIGIN = "https://flatkey.ai";
export const SITE_NAME = "flatkey.ai";

export type SeoInput = {
  title: string;
  description: string;
  pathname: string;
  locale?: Locale;
  image?: string;
  noIndex?: boolean;
};

export function buildMetadata(input: SeoInput): Metadata {
  const locale = input.locale ?? DEFAULT_LOCALE;
  const canonicalPath = localizePath(input.pathname, locale);
  const canonical = `${SITE_ORIGIN}${canonicalPath}`;
  const title = input.title;

  return {
    title,
    description: input.description,
    metadataBase: new URL(SITE_ORIGIN),
    alternates: {
      canonical,
      languages: {
        ...localeAlternates(input.pathname),
        "x-default": `${SITE_ORIGIN}${localizePath(input.pathname, DEFAULT_LOCALE)}`,
      },
    },
    robots: input.noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: {
      title,
      description: input.description,
      url: canonical,
      siteName: SITE_NAME,
      type: "website",
      images: input.image ? [{ url: input.image }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: input.description,
      images: input.image ? [input.image] : undefined,
    },
  };
}
