import type { MetadataRoute } from "next";
import { getAllBlogPosts, getBlogCategories } from "@/lib/blog";
import { CLI_LANDING_PATH, HIGGSFIELD_ALTERNATIVE_PATH } from "@/lib/cli-landing";
import { LOCALES, type Locale, localeLanguageTag, localizePath } from "@/lib/locales";
import { getMarketPathnames } from "@/lib/market-landing";
import { getModelLandingPathnames } from "@/lib/model-landing";
import { seriesForModels } from "@/lib/model-directory-meta";
import { modelPublicPath } from "@/lib/model-public";
import { getSkagLandingLocales, SKAG_LANDING_SLUGS, skagLandingPath } from "@/lib/skag-landing";
import { getToolsAdLandingPathnames } from "@/lib/tools-ad-landing";
import { TOOLS_LANDING_PATH } from "@/lib/tools-landing";
import { APIFY_ALTERNATIVE_PATH } from "@/lib/tools-conquest-landing";
import { getPricingData } from "@/lib/pricing";

const base = "https://flatkey.ai";
const REDIRECT_MODEL_LANDING_PATHS = new Set(["/models/gpt-api", "/models/claude-api"]);

function entry(
  pathname: string,
  priority: number,
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
  locales: readonly Locale[] = LOCALES
) {
  return locales.map((locale) => ({
    url: `${base}${localizePath(pathname, locale)}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
    alternates: {
      languages: Object.fromEntries(locales.map((locale) => [localeLanguageTag(locale), `${base}${localizePath(pathname, locale)}`])),
    },
  }));
}

/** Like `entry`, but for a filtered view whose state lives in the query string. */
function queryEntry(
  pathname: string,
  query: string,
  priority: number,
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]
) {
  return LOCALES.map((locale) => ({
    url: `${base}${localizePath(pathname, locale)}?${query}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
    alternates: {
      languages: Object.fromEntries(
        LOCALES.map((alternate) => [localeLanguageTag(alternate), `${base}${localizePath(pathname, alternate)}?${query}`])
      ),
    },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [localizedPosts, categories, pricing] = await Promise.all([
    Promise.all(LOCALES.map(async (locale) => ({ locale, posts: await getAllBlogPosts(locale) }))),
    getBlogCategories(),
    getPricingData(),
  ]);
  const staticEntries = [
    ...entry("/", 1, "daily"),
    ...entry("/pricing", 0.8, "daily"),
    ...entry("/models", 0.82, "daily"),
    ...entry(TOOLS_LANDING_PATH, 0.9, "daily"),
    ...entry("/docs", 0.7, "weekly"),
    ...entry("/playground", 0.7, "weekly"),
    ...entry("/compute", 0.7, "weekly"),
    ...entry("/usecases", 0.7, "weekly"),
    ...entry("/status", 0.65, "daily"),
    ...entry(APIFY_ALTERNATIVE_PATH, 0.84, "weekly", ["en"]),
    ...entry(CLI_LANDING_PATH, 0.86, "weekly"),
    ...entry(HIGGSFIELD_ALTERNATIVE_PATH, 0.84, "weekly"),
    ...entry("/use-case/codex", 0.84, "weekly"),
    ...entry("/use-case/claude-code", 0.84, "weekly"),
    ...entry("/use-case/image-buddy", 0.84, "weekly"),
    ...entry("/glm-5-2", 0.86, "daily"),
    ...entry("/5-credit-promo", 0.8, "weekly", ["pt"]),
    ...entry("/rankings", 0.7, "daily"),
    ...entry("/about", 0.5, "monthly"),
    ...entry("/careers", 0.6, "monthly", ["en", "zh"]),
    ...entry("/contact", 0.5, "monthly"),
    ...entry("/blog", 0.9, "daily"),
    ...entry("/terms", 0.3, "yearly"),
    ...entry("/privacy", 0.3, "yearly"),
    ...entry("/sla", 0.3, "yearly"),
    ...entry("/refund-policy", 0.3, "yearly"),
  ];
  const modelLandingEntries = getModelLandingPathnames()
    .filter((pathname) => !REDIRECT_MODEL_LANDING_PATHS.has(pathname))
    .flatMap((pathname) => entry(pathname, 0.82, "daily"));
  const skagLandingEntries = SKAG_LANDING_SLUGS.flatMap((slug) =>
    entry(skagLandingPath(slug), 0.8, "weekly", getSkagLandingLocales(slug))
  );
  const toolsAdLandingEntries = getToolsAdLandingPathnames().flatMap((pathname) => entry(pathname, 0.8, "weekly", ["en"]));
  // Every live model gets its own public page (/models/<name>); include them so
  // search engines discover the full catalog, not just the curated landings.
  const landingSlugs = new Set(getModelLandingPathnames().map((pathname) => pathname.replace(/^\/models\//, "")));
  const modelPublicEntries = pricing.models
    .filter((model) => !landingSlugs.has(model.model_name))
    .flatMap((model) => entry(modelPublicPath(model.model_name), 0.6, "daily"));
  // Market acquisition pages are single-locale (no i18n alternates by design).
  const marketEntries = getMarketPathnames().map((pathname) => ({
    url: `${base}${pathname}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.84,
  }));
  const categoryEntries = categories.flatMap((category) => entry(`/blog/category/${category.slug}`, 0.7, "weekly"));
  const postsBySlug = new Map<string, Partial<Record<Locale, { date?: string }>>>();

  for (const { locale, posts } of localizedPosts) {
    for (const post of posts) {
      const existing = postsBySlug.get(post.slug) ?? {};
      existing[locale] = { date: post.date };
      postsBySlug.set(post.slug, existing);
    }
  }

  const postEntries = Array.from(postsBySlug.entries()).flatMap(([slug, locales]) => {
    const availableLocales = LOCALES.filter((locale) => locales[locale]);
    return availableLocales.map((locale) => {
      const localizedPost = locales[locale];
      return {
        url: `${base}${localizePath(`/blog/${slug}`, locale)}`,
        lastModified: localizedPost?.date ? new Date(localizedPost.date) : new Date(),
        changeFrequency: "monthly" as const,
        priority: 0.8,
        alternates: {
          languages: Object.fromEntries(
            availableLocales.map((availableLocale) => [
              localeLanguageTag(availableLocale),
              `${base}${localizePath(`/blog/${slug}`, availableLocale)}`,
            ])
          ),
        },
      };
    });
  });
  // Single-series directory views are indexable landing pages ("Claude API
  // pricing"), so they need to be discoverable. Any richer filter combination
  // is noindex — see model-directory-seo.ts — and is deliberately absent here.
  const seriesEntries = seriesForModels(pricing.models.map((model) => model.model_name)).flatMap((series) =>
    queryEntry("/models", `series=${encodeURIComponent(series)}`, 0.72, "daily")
  );

  return [
    ...staticEntries,
    ...marketEntries,
    ...modelLandingEntries,
    ...skagLandingEntries,
    ...toolsAdLandingEntries,
    ...modelPublicEntries,
    ...seriesEntries,
    ...categoryEntries,
    ...postEntries,
  ];
}
