import type { MetadataRoute } from "next";
import { getBlogCategories, getBlogPosts } from "@/lib/blog";
import { LOCALES, localizePath } from "@/lib/locales";

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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, categories] = await Promise.all([getBlogPosts(), getBlogCategories()]);
  const staticEntries = [
    ...entry("/", 1, "daily"),
    ...entry("/pricing", 0.8, "daily"),
    ...entry("/rankings", 0.7, "daily"),
    ...entry("/about", 0.5, "monthly"),
    ...entry("/blog", 0.9, "daily"),
    ...entry("/terms", 0.3, "yearly"),
    ...entry("/privacy", 0.3, "yearly"),
    ...entry("/sla", 0.3, "yearly"),
  ];
  const categoryEntries = categories.flatMap((category) => entry(`/blog/category/${category.slug}`, 0.7, "weekly"));
  const postEntries = posts.list.flatMap((post) => entry(`/blog/${post.slug}`, 0.8, "monthly"));
  return [...staticEntries, ...categoryEntries, ...postEntries];
}
