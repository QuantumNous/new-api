import type { Metadata } from "next";
import { DEFAULT_LOCALE, LOCALES, type Locale, localeAlternates, localeLanguageTag, localizePath } from "./locales";

export const SITE_ORIGIN = "https://flatkey.ai";
export const SITE_NAME = "flatkey.ai";
export const DEFAULT_SOCIAL_IMAGE = `${SITE_ORIGIN}/flatkey-logo-light.png`;
export const HOMEPAGE_SOCIAL_IMAGE = `${SITE_ORIGIN}/assets/og-image.png`;

export type SeoInput = {
  title: string;
  description: string;
  pathname: string;
  locale?: Locale;
  image?: string;
  noIndex?: boolean;
  /** Locales the page actually exists in. Defaults to all locales; pass ["en"] for English-only pages so hreflang never points at 404s. */
  locales?: readonly Locale[];
  /**
   * Physical single-locale routes (e.g. market pages /br, /id-market) that only
   * exist at their literal pathname: canonical is the raw pathname (never
   * locale-prefixed) and no hreflang alternates are emitted.
   */
  unlocalized?: boolean;
};

export function buildMetadata(input: SeoInput): Metadata {
  const locale = input.locale ?? DEFAULT_LOCALE;
  const canonicalPath = input.unlocalized ? input.pathname : localizePath(input.pathname, locale);
  const canonical = `${SITE_ORIGIN}${canonicalPath}`;
  const title = input.title;
  const socialImage = input.image ?? DEFAULT_SOCIAL_IMAGE;

  return {
    title,
    description: input.description,
    metadataBase: new URL(SITE_ORIGIN),
    alternates: {
      canonical,
      ...(input.unlocalized
        ? {}
        : {
            languages: {
              ...(input.locales && input.locales.length < LOCALES.length
                ? Object.fromEntries(
                    input.locales.map((altLocale) => [
                      localeLanguageTag(altLocale),
                      `${SITE_ORIGIN}${localizePath(input.pathname, altLocale)}`,
                    ])
                  )
                : localeAlternates(input.pathname)),
              "x-default": `${SITE_ORIGIN}${localizePath(input.pathname, DEFAULT_LOCALE)}`,
            },
          }),
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
      images: [{ url: socialImage }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: input.description,
      images: [socialImage],
    },
  };
}
