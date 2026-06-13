import sanitizeHtml from "sanitize-html";

const API_BASE_URL = process.env.FLATKEY_API_BASE_URL ?? "https://flatkey.ai";
const BLOG_PAGE_SIZE = 12;

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

export async function getBlogPosts(page = 1): Promise<BlogListResult> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(BLOG_PAGE_SIZE),
  });
  return (
    (await fetchJson<BlogListResult>(`/api/blog/list?${params.toString()}`)) ?? {
      list: [],
      total: 0,
      pageNo: page,
      pageSize: BLOG_PAGE_SIZE,
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
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2", "h3"]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ["href", "name", "target", "rel", "id"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      h1: ["id"],
      h2: ["id"],
      h3: ["id"],
    },
    allowedSchemes: ["http", "https", "mailto"],
  });
}
