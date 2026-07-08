import type { MetadataRoute } from "next";
import { getAllBlogPosts, getBlogCategories } from "@/lib/blog";
import { LOCALES, type Locale, localizePath } from "@/lib/locales";
import { getModelLandingPathnames } from "@/lib/model-landing";
import { modelPublicPath } from "@/lib/model-public";
import { getPricingData, getTopVendors, getVendorName } from "@/lib/pricing";

const base = "https://flatkey.ai";

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
      languages: Object.fromEntries(locales.map((locale) => [locale, `${base}${localizePath(pathname, locale)}`])),
    },
  }));
}

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
      languages: Object.fromEntries(LOCALES.map((locale) => [locale, `${base}${localizePath(pathname, locale)}?${query}`])),
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
    ...entry("/use-case/codex", 0.84, "weekly"),
    ...entry("/use-case/claude-code", 0.84, "weekly"),
    ...entry("/use-case/image-buddy", 0.84, "weekly"),
    ...entry("/glm-5-2", 0.86, "daily"),
    ...entry("/rankings", 0.7, "daily"),
    ...entry("/about", 0.5, "monthly"),
    ...entry("/contact", 0.5, "monthly"),
    ...entry("/blog", 0.9, "daily"),
    ...entry("/terms", 0.3, "yearly"),
    ...entry("/privacy", 0.3, "yearly"),
    ...entry("/sla", 0.3, "yearly"),
    ...entry("/refund-policy", 0.3, "yearly"),
  ];
  const modelLandingEntries = getModelLandingPathnames().flatMap((pathname) => entry(pathname, 0.82, "daily"));
  // Every live model gets its own public page (/models/<name>); include them so
  // search engines discover the full catalog, not just the curated landings.
  const landingSlugs = new Set(getModelLandingPathnames().map((pathname) => pathname.replace(/^\/models\//, "")));
  const modelPublicEntries = pricing.models
    .filter((model) => !landingSlugs.has(model.model_name))
    .flatMap((model) => entry(modelPublicPath(model.model_name), 0.6, "daily"));
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
              availableLocale,
              `${base}${localizePath(`/blog/${slug}`, availableLocale)}`,
            ])
          ),
        },
      };
    });
  });
  const pricingModels = pricing.models.map((model) => ({
    ...model,
    vendor_name: getVendorName(model, pricing.vendors),
  }));
  const vendorEntries = getTopVendors(pricingModels, 18).flatMap((vendor) =>
    queryEntry("/models", `vendor=${encodeURIComponent(vendor)}`, 0.72, "daily")
  );

  return [
    ...staticEntries,
    ...modelLandingEntries,
    ...modelPublicEntries,
    ...vendorEntries,
    ...categoryEntries,
    ...postEntries,
  ];
}
