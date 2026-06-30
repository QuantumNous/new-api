import type { BlogPost } from "./blog";
import type { Locale } from "./locales";
import { localizePath } from "./locales";
import { SITE_NAME, SITE_ORIGIN } from "./seo";

type JsonLdValue = string | number | boolean | null | JsonLdObject | JsonLdValue[];
type JsonLdObject = { [key: string]: JsonLdValue | undefined };

export type JsonLdGraph = {
  "@context": "https://schema.org";
  "@graph": JsonLdObject[];
};

type BlogIndexSchemaInput = {
  locale: Locale;
  title: string;
  description: string;
};

type BlogCategorySchemaInput = {
  locale: Locale;
  slug: string;
  name: string;
  description: string;
};

type BlogArticleSchemaInput = {
  locale: Locale;
  post: BlogPost;
};

type HomepageSchemaInput = {
  locale: Locale;
  title: string;
  description: string;
};

export function stringifyJsonLd(value: JsonLdObject | JsonLdGraph): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function buildHomepageSchema(input: HomepageSchemaInput): JsonLdGraph {
  return graph([
    websiteSchema(),
    {
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      description: input.description,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      url: SITE_ORIGIN,
      publisher: organizationSchema(),
      offers: {
        "@type": "Offer",
        url: absoluteUrl(localizePath("/pricing", input.locale)),
      },
    },
    {
      "@type": "ItemList",
      name: `${input.title} main links`,
      itemListElement: [
        navigationItem(1, "Sign up", localizePath("/sign-up", input.locale)),
        navigationItem(2, "Pricing", localizePath("/pricing", input.locale)),
        navigationItem(3, "Use cases", localizePath("/use-case/codex", input.locale)),
        navigationItem(4, "Blog", localizePath("/blog", input.locale)),
      ],
    },
  ]);
}

export function buildBlogIndexSchema(input: BlogIndexSchemaInput): JsonLdGraph {
  const blogUrl = absoluteUrl(localizePath("/blog", input.locale));

  return graph([
    websiteSchema(),
    {
      "@type": "Blog",
      name: input.title,
      description: input.description,
      url: blogUrl,
      inLanguage: input.locale,
      publisher: organizationSchema(),
    },
  ]);
}

export function buildBlogCategorySchema(input: BlogCategorySchemaInput): JsonLdGraph {
  const blogUrl = absoluteUrl(localizePath("/blog", input.locale));
  const categoryUrl = absoluteUrl(localizePath(`/blog/category/${input.slug}`, input.locale));

  return graph([
    websiteSchema(),
    {
      "@type": "CollectionPage",
      name: input.name,
      description: input.description,
      url: categoryUrl,
      inLanguage: input.locale,
      isPartOf: { "@type": "Blog", name: SITE_NAME, url: blogUrl },
      publisher: organizationSchema(),
    },
    breadcrumbSchema([
      { name: "Blog", item: blogUrl },
      { name: input.name, item: categoryUrl },
    ]),
  ]);
}

export function buildBlogArticleSchema(input: BlogArticleSchemaInput): JsonLdGraph {
  const post = input.post;
  const blogUrl = absoluteUrl(localizePath("/blog", input.locale));
  const articleUrl = absoluteUrl(localizePath(`/blog/${post.slug}`, input.locale));
  const categoryUrl = post.categorySlug ? absoluteUrl(localizePath(`/blog/category/${post.categorySlug}`, input.locale)) : undefined;

  return graph([
    websiteSchema(),
    {
      "@type": "BlogPosting",
      headline: post.title,
      description: post.summary,
      url: articleUrl,
      mainEntityOfPage: articleUrl,
      datePublished: post.date,
      dateModified: post.date,
      image: post.cover ? [post.cover] : undefined,
      author: post.author ? { "@type": "Person", name: post.author } : organizationSchema(),
      publisher: organizationSchema(),
      articleSection: post.categoryName,
      inLanguage: input.locale,
    },
    breadcrumbSchema([
      { name: "Blog", item: blogUrl },
      ...(post.categoryName && categoryUrl ? [{ name: post.categoryName, item: categoryUrl }] : []),
      { name: post.title, item: articleUrl },
    ]),
  ]);
}

function graph(items: JsonLdObject[]): JsonLdGraph {
  return {
    "@context": "https://schema.org",
    "@graph": items,
  };
}

function websiteSchema(): JsonLdObject {
  return {
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_ORIGIN,
    publisher: organizationSchema(),
  };
}

function organizationSchema(): JsonLdObject {
  return {
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_ORIGIN,
  };
}

function breadcrumbSchema(items: Array<{ name: string; item: string }>): JsonLdObject {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.item,
    })),
  };
}

function navigationItem(position: number, name: string, path: string): JsonLdObject {
  return {
    "@type": "SiteNavigationElement",
    position,
    name,
    url: absoluteUrl(path),
  };
}

function absoluteUrl(path: string): string {
  return `${SITE_ORIGIN}${path}`;
}
