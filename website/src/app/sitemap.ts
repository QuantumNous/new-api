import type { MetadataRoute } from "next";
import { getBlogCategories, getBlogPosts } from "@/lib/blog";
import { LOCALES, localizePath } from "@/lib/locales";
import { getPricingData, getTopVendors, getVendorName } from "@/lib/pricing";

const base = "https://flatkey.ai";

function entry(pathname: string, priority: number, changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]) {
  return LOCALES.map((locale) => ({
    url: `${base}${localizePath(pathname, locale)}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
    alternates: {
      languages: Object.fromEntries(LOCALES.map((locale) => [locale, `${base}${localizePath(pathname, locale)}`])),
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
  const [posts, categories, pricing] = await Promise.all([getBlogPosts(), getBlogCategories(), getPricingData()]);
  const staticEntries = [
    ...entry("/", 1, "daily"),
    ...entry("/pricing", 0.8, "daily"),
    ...entry("/rankings", 0.7, "daily"),
    ...entry("/about", 0.5, "monthly"),
    ...entry("/blog", 0.9, "daily"),
    ...entry("/terms", 0.3, "yearly"),
    ...entry("/privacy", 0.3, "yearly"),
    ...entry("/sla", 0.3, "yearly"),
    ...entry("/refund-policy", 0.3, "yearly"),
  ];
  const categoryEntries = categories.flatMap((category) => entry(`/blog/category/${category.slug}`, 0.7, "weekly"));
  const postEntries = posts.list.flatMap((post) => entry(`/blog/${post.slug}`, 0.8, "monthly"));
  const pricingModels = pricing.models.map((model) => ({
    ...model,
    vendor_name: getVendorName(model, pricing.vendors),
  }));
  const vendorEntries = getTopVendors(pricingModels, 18).flatMap((vendor) =>
    queryEntry("/pricing", `vendor=${encodeURIComponent(vendor)}`, 0.72, "daily")
  );

  return [...staticEntries, ...vendorEntries, ...categoryEntries, ...postEntries];
}
