import sanitizeHtml from "sanitize-html";
import type { Locale } from "@/lib/locales";
import { APP_CONSOLE_ORIGIN } from "@/lib/origins";

const API_BASE_URL = APP_CONSOLE_ORIGIN;
export const BLOG_PAGE_SIZE = 18;

export type BlogPost = {
  id: number;
  title: string;
  slug: string;
  cover?: string;
  summary?: string;
  date?: string;
  author?: string;
  categoryId?: number;
  categoryName?: string;
  categorySlug?: string;
  content?: string;
};

export type BlogCategory = {
  id: number;
  slug: string;
  name: string;
  description?: string;
};

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data: T;
};

type BlogListResult = {
  list: BlogPost[];
  total: number;
  pageNo: number;
  pageSize: number;
};

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      next: { revalidate: 300 },
      headers: { accept: "application/json" },
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as ApiResponse<T>;
    return payload.success ? payload.data : null;
  } catch {
    return null;
  }
}

type BlogListQuery = {
  page?: number;
  q?: string;
  categoryIds?: number[];
  pageSize?: number;
};

export async function getBlogPosts(query: BlogListQuery = {}): Promise<BlogListResult> {
  const page = query.page && query.page > 0 ? query.page : 1;
  const pageSize = query.pageSize ?? BLOG_PAGE_SIZE;
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (query.q) params.set("q", query.q);
  query.categoryIds?.forEach((categoryId) => params.append("categoryIds", String(categoryId)));
  return (
    (await fetchJson<BlogListResult>(`/api/blog/list?${params.toString()}`)) ?? {
      list: [],
      total: 0,
      pageNo: page,
      pageSize,
    }
  );
}

export async function getBlogCategories(): Promise<BlogCategory[]> {
  return (await fetchJson<BlogCategory[]>("/api/blog/categories")) ?? [];
}

export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  return fetchJson<BlogPost>(`/api/blog/detail/${encodeURIComponent(slug)}`);
}

export function sanitizeBlogHtml(html: string): string {
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
  }));
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
