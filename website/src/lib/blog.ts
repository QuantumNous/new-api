import sanitizeHtml from "sanitize-html";
import { DEFAULT_LOCALE, localizePath, stripLocale, type Locale } from "@/lib/locales";
import { APP_CONSOLE_ORIGIN } from "@/lib/origins";

const API_BASE_URL = APP_CONSOLE_ORIGIN;
const BLOGGER_API_URL = "https://blogger-api-5qjldqffdq-uc.a.run.app";
const BLOGGER_SITE_SLUG = "flatkey";
const BLOGGER_ACCESS_KEY = process.env.BLOGGER_ACCESS_KEY?.trim() ?? "";
const BLOG_REVALIDATE_SECONDS = 300;
const BLOGGER_PAGE_SIZE = 100;
const SITE_ORIGIN = "https://flatkey.ai";
const INTERNAL_PUBLIC_PATH_PREFIXES = [
  "/about",
  "/blog",
  "/models",
  "/pricing",
  "/privacy",
  "/rankings",
  "/refund-policy",
  "/sign-in",
  "/sign-up",
  "/sla",
  "/terms",
  "/use-case",
] as const;
export const BLOG_PAGE_SIZE = 18;
export type BlogEntityId = string | number;

export type BlogPost = {
  id: BlogEntityId;
  title: string;
  slug: string;
  cover?: string;
  summary?: string;
  date?: string;
  author?: string;
  categoryId?: BlogEntityId;
  categoryName?: string;
  categorySlug?: string;
  content?: string;
};

export type BlogCategory = {
  id: BlogEntityId;
  slug: string;
  name: string;
  description?: string;
};

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data: T;
};

export type BlogListResult = {
  list: BlogPost[];
  total: number;
  pageNo: number;
  pageSize: number;
};

type BloggerCategory = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
};

type BloggerPost = {
  id: string;
  title: string;
  slug: string;
  language: string;
  path: string;
  html_content: string;
  excerpt?: string | null;
  cover_image_url?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  canonical_url?: string | null;
  author_display_name?: string | null;
  published_at?: string | null;
  updated_at: string;
  author: {
    email: string;
    nickname?: string | null;
    avatar_url?: string | null;
  };
  category?: BloggerCategory | null;
};

async function fetchLegacyJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      next: { revalidate: BLOG_REVALIDATE_SECONDS },
      headers: { accept: "application/json" },
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as ApiResponse<T>;
    return payload.success ? payload.data : null;
  } catch {
    return null;
  }
}

async function fetchBloggerJson<T>(path: string): Promise<T | null> {
  if (!isBloggerEnabled()) return null;

  try {
    const response = await fetch(`${BLOGGER_API_URL}${path}`, {
      next: { revalidate: BLOG_REVALIDATE_SECONDS },
      headers: {
        accept: "application/json",
        "x-access-key": BLOGGER_ACCESS_KEY,
      },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export type BlogListQuery = {
  page?: number;
  q?: string;
  categoryIds?: BlogEntityId[];
  pageSize?: number;
};

function isBloggerEnabled(): boolean {
  return BLOGGER_ACCESS_KEY.length > 0;
}

export function mapBloggerCategory(category: BloggerCategory): BlogCategory {
  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    description: category.description ?? undefined,
  };
}

export function mapBloggerPost(post: BloggerPost): BlogPost {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    cover: post.cover_image_url ?? undefined,
    summary: post.excerpt ?? post.meta_description ?? undefined,
    date: post.published_at ?? post.updated_at ?? undefined,
    author: post.author_display_name ?? post.author.nickname ?? undefined,
    categoryId: post.category?.id,
    categoryName: post.category?.name,
    categorySlug: post.category?.slug,
    content: post.html_content,
  };
}

export function applyBlogFilters(posts: BlogPost[], query: BlogListQuery = {}): BlogListResult {
  const page = query.page && query.page > 0 ? query.page : 1;
  const pageSize = query.pageSize ?? BLOG_PAGE_SIZE;
  let filtered = posts;

  if (query.categoryIds?.length) {
    const allowedCategoryIds = new Set(query.categoryIds.map((categoryId) => String(categoryId)));
    filtered = filtered.filter((post) => post.categoryId && allowedCategoryIds.has(String(post.categoryId)));
  }

  const q = query.q?.trim().toLocaleLowerCase();
  if (q) {
    filtered = filtered.filter((post) =>
      [post.title, post.summary, post.categoryName, post.author]
        .filter(Boolean)
        .some((value) => value?.toLocaleLowerCase().includes(q))
    );
  }

  const offset = (page - 1) * pageSize;
  return {
    list: filtered.slice(offset, offset + pageSize),
    total: filtered.length,
    pageNo: page,
    pageSize,
  };
}

async function getAllBloggerPosts(locale: Locale): Promise<BlogPost[] | null> {
  const posts: BlogPost[] = [];
  let offset = 0;

  while (true) {
    const params = new URLSearchParams({
      language: locale,
      limit: String(BLOGGER_PAGE_SIZE),
      offset: String(offset),
    });
    const batch = await fetchBloggerJson<BloggerPost[]>(
      `/api/integration/sites/${encodeURIComponent(BLOGGER_SITE_SLUG)}/posts?${params.toString()}`
    );
    if (batch === null) return null;
    if (!batch.length) break;
    posts.push(...batch.map(mapBloggerPost));
    if (batch.length < BLOGGER_PAGE_SIZE) break;
    offset += batch.length;
  }

  return posts;
}

export async function getAllBlogPosts(locale: Locale = DEFAULT_LOCALE): Promise<BlogPost[]> {
  const bloggerPosts = await getAllBloggerPosts(locale);
  if (bloggerPosts !== null) {
    return bloggerPosts;
  }
  if (locale !== DEFAULT_LOCALE) return [];

  const pageSize = 200;
  const params = new URLSearchParams({
    page: "1",
    pageSize: String(pageSize),
  });
  const result = await fetchLegacyJson<BlogListResult>(`/api/blog/list?${params.toString()}`);
  return result?.list ?? [];
}

export async function getBlogPosts(query: BlogListQuery = {}, locale: Locale = DEFAULT_LOCALE): Promise<BlogListResult> {
  const posts = await getAllBlogPosts(locale);
  if (posts.length > 0 || locale !== DEFAULT_LOCALE) return applyBlogFilters(posts, query);

  const page = query.page && query.page > 0 ? query.page : 1;
  const pageSize = query.pageSize ?? BLOG_PAGE_SIZE;
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (query.q) params.set("q", query.q);
  query.categoryIds?.forEach((categoryId) => params.append("categoryIds", String(categoryId)));
  return (
    (await fetchLegacyJson<BlogListResult>(`/api/blog/list?${params.toString()}`)) ?? {
      list: [],
      total: 0,
      pageNo: page,
      pageSize,
    }
  );
}

export async function getBlogCategories(): Promise<BlogCategory[]> {
  const categories = await fetchBloggerJson<BloggerCategory[]>(
    `/api/integration/sites/${encodeURIComponent(BLOGGER_SITE_SLUG)}/categories`
  );
  if (categories !== null) {
    return categories.map(mapBloggerCategory);
  }

  return (await fetchLegacyJson<BlogCategory[]>("/api/blog/categories")) ?? [];
}

export async function getBlogPost(slug: string, locale: Locale = DEFAULT_LOCALE): Promise<BlogPost | null> {
  const params = new URLSearchParams({ language: locale });
  const post = await fetchBloggerJson<BloggerPost>(
    `/api/integration/sites/${encodeURIComponent(BLOGGER_SITE_SLUG)}/posts/${encodeURIComponent(slug)}?${params.toString()}`
  );
  if (post) {
    return mapBloggerPost(post);
  }
  if (locale !== DEFAULT_LOCALE) return null;

  return fetchLegacyJson<BlogPost>(`/api/blog/detail/${encodeURIComponent(slug)}`);
}

export function sanitizeBlogHtml(html: string, locale: Locale = DEFAULT_LOCALE): string {
  return ensureHeadingIds(sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "img",
      "h1",
      "h2",
      "h3",
      "h4",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ["href", "name", "target", "rel", "id"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      h1: ["id"],
      h2: ["id"],
      h3: ["id"],
      h4: ["id"],
      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: rewriteBlogAnchorAttributes(attribs, locale),
      }),
    },
  }));
}

export function rewriteBlogHref(href: string | undefined, locale: Locale = DEFAULT_LOCALE): string | undefined {
  const value = href?.trim();
  if (!value) return value;
  if (
    value.startsWith("#") ||
    value.startsWith("mailto:") ||
    value.startsWith("tel:") ||
    value.startsWith("data:")
  ) {
    return value;
  }

  const isAbsolute = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value) || value.startsWith("//");
  if (!isAbsolute && !value.startsWith("/")) {
    return value;
  }

  try {
    const url = new URL(value, SITE_ORIGIN);
    const hostname = url.hostname.toLowerCase();
    if (isAbsolute && hostname !== "flatkey.ai" && hostname !== "www.flatkey.ai") {
      return value;
    }

    const normalizedPath = localizeInternalPublicPath(url.pathname, locale);
    if (!normalizedPath) return value;

    const result = `${normalizedPath}${url.search}${url.hash}`;
    return isAbsolute ? `${SITE_ORIGIN}${result}` : result;
  } catch {
    return value;
  }
}

const BLOG_DATE_LOCALES: Record<Locale, string> = {
  en: "en-US",
  zh: "zh-CN",
  es: "es-ES",
  fr: "fr-FR",
  pt: "pt-PT",
  ru: "ru-RU",
  ja: "ja-JP",
  vi: "vi-VN",
  de: "de-DE",
};

export function formatBlogDate(value: string | undefined, length: "short" | "long", locale: Locale = "en"): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(BLOG_DATE_LOCALES[locale], {
    year: "numeric",
    month: length === "long" ? "long" : "short",
    day: "numeric",
  }).format(date);
}

export type BlogTocItem = {
  id: string;
  text: string;
  level: number;
};

export function getBlogToc(html: string): BlogTocItem[] {
  const items: BlogTocItem[] = [];
  const headingPattern = /<h([23])\b([^>]*)>([\s\S]*?)<\/h\1>/gi;
  let match: RegExpExecArray | null;

  while ((match = headingPattern.exec(html))) {
    const attrs = match[2] ?? "";
    const idMatch = attrs.match(/\sid=["']([^"']+)["']/i);
    if (!idMatch?.[1]) continue;
    const text = stripTags(match[3] ?? "").trim();
    if (!text) continue;
    items.push({ id: idMatch[1], text, level: Number(match[1]) });
  }

  return items;
}

function ensureHeadingIds(html: string): string {
  const used = new Set<string>();
  const headingPattern = /<h([23])\b([^>]*)>([\s\S]*?)<\/h\1>/gi;

  return html.replace(headingPattern, (full, level: string, attrs: string, inner: string) => {
    const existing = attrs.match(/\sid=["']([^"']+)["']/i)?.[1];
    if (existing) {
      used.add(existing);
      return full;
    }

    const base = slugifyHeading(stripTags(inner)) || `heading-${used.size + 1}`;
    let id = base;
    let suffix = 2;
    while (used.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    used.add(id);
    return `<h${level}${attrs} id="${id}">${inner}</h${level}>`;
  });
}

function slugifyHeading(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/&[a-z0-9#]+;/gi, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
}

function rewriteBlogAnchorAttributes(
  attribs: Record<string, string>,
  locale: Locale
): Record<string, string> {
  const href = rewriteBlogHref(attribs.href, locale);
  return href ? { ...attribs, href } : attribs;
}

function localizeInternalPublicPath(pathname: string, locale: Locale): string | null {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const stripped = stripLocale(normalized) || "/";
  if (!shouldLocalizeInternalPublicPath(stripped)) {
    return null;
  }
  return localizePath(stripped, locale);
}

function shouldLocalizeInternalPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return INTERNAL_PUBLIC_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
