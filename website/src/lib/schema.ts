import type { BlogPost } from "./blog";
import type { Locale } from "./locales";
import { isLocale, localeLanguageTag, localizePath } from "./locales";
import { SITE_NAME, SITE_ORIGIN } from "./seo";

type JsonLdValue = string | number | boolean | null | JsonLdObject | JsonLdValue[];
type JsonLdObject = { [key: string]: JsonLdValue | undefined };
const PRODUCT_IMAGE_URL = `${SITE_ORIGIN}/flatkey-mark.svg`;

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

type BasePageSchemaInput = {
  locale: Locale;
  pathname: string;
};

export function stringifyJsonLd(value: JsonLdObject | JsonLdGraph): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function buildBasePageSchema(input: BasePageSchemaInput): JsonLdGraph {
  const pagePath = localizePath(input.pathname, input.locale);
  const pageUrl = absoluteUrl(pagePath);
  const breadcrumbs = buildBreadcrumbItems(pagePath);

  return graph([
    websiteSchema(),
    {
      "@type": "WebPage",
      name: pageNameFromPath(input.pathname),
      url: pageUrl,
      inLanguage: localeLanguageTag(input.locale),
      isPartOf: websiteSchema(),
      publisher: organizationSchema(),
    },
    breadcrumbSchema(breadcrumbs),
  ]);
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
      inLanguage: localeLanguageTag(input.locale),
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
      inLanguage: localeLanguageTag(input.locale),
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
      inLanguage: localeLanguageTag(input.locale),
    },
    breadcrumbSchema([
      { name: "Blog", item: blogUrl },
      ...(post.categoryName && categoryUrl ? [{ name: post.categoryName, item: categoryUrl }] : []),
      { name: post.title, item: articleUrl },
    ]),
  ]);
}

type ModelSchemaInput = {
  locale: Locale;
  modelName: string;
  vendorName: string;
  description: string;
  // Effective price per 1M input tokens on flatkey, in USD.
  inputPriceUsd: number;
  // Localized page path, e.g. "/zh/models/gpt-4o-mini".
  pagePath: string;
  faq: Array<{ q: string; a: string }>;
};

export function buildModelSchema(input: ModelSchemaInput): JsonLdGraph {
  const modelsUrl = absoluteUrl(localizePath("/models", input.locale));
  const pageUrl = absoluteUrl(input.pagePath);
  // Only emit an Offer with a real, finite, non-negative price — a NaN/Infinity
  // or missing price would serialize to null / an invalid price and hand search
  // engines a broken price signal.
  const validPrice = Number.isFinite(input.inputPriceUsd) && input.inputPriceUsd >= 0;
  return graph([
    websiteSchema(),
    {
      "@type": "Product",
      name: `${input.modelName} API`,
      description: input.description,
      category: "AI model API",
      brand: { "@type": "Brand", name: input.vendorName },
      url: pageUrl,
      image: PRODUCT_IMAGE_URL,
      ...(validPrice
        ? {
            offers: {
              "@type": "Offer",
              priceCurrency: "USD",
              price: input.inputPriceUsd,
              description: `Effective ${SITE_NAME} price for ${input.modelName}`,
              availability: "https://schema.org/InStock",
              url: pageUrl,
              seller: organizationSchema(),
              hasMerchantReturnPolicy: digitalServiceReturnPolicy(),
              shippingDetails: digitalServiceShippingDetails(),
            },
          }
        : {}),
    },
    {
      "@type": "FAQPage",
      mainEntity: input.faq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    },
    breadcrumbSchema([
      { name: "Models", item: modelsUrl },
      { name: input.modelName, item: pageUrl },
    ]),
  ]);
}

type RankingsSchemaInput = {
  locale: Locale;
  title: string;
  // Ranked models, already ordered; `path` is the localized model-page path.
  items: Array<{ name: string; path: string; position: number }>;
};

export function buildRankingsSchema(input: RankingsSchemaInput): JsonLdGraph {
  const rankingsUrl = absoluteUrl(localizePath("/rankings", input.locale));
  return graph([
    websiteSchema(),
    {
      "@type": "ItemList",
      name: input.title,
      url: rankingsUrl,
      numberOfItems: input.items.length,
      itemListElement: input.items.map((item) => ({
        "@type": "ListItem",
        position: item.position,
        name: item.name,
        url: absoluteUrl(item.path),
      })),
    },
    breadcrumbSchema([{ name: input.title, item: rankingsUrl }]),
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

function digitalServiceReturnPolicy(): JsonLdObject {
  return {
    "@type": "MerchantReturnPolicy",
    applicableCountry: "US",
    returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted",
  };
}

function digitalServiceShippingDetails(): JsonLdObject {
  return {
    "@type": "OfferShippingDetails",
    shippingRate: {
      "@type": "MonetaryAmount",
      value: 0,
      currency: "USD",
    },
    shippingDestination: {
      "@type": "DefinedRegion",
      addressCountry: "US",
    },
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      handlingTime: {
        "@type": "QuantitativeValue",
        minValue: 0,
        maxValue: 0,
        unitCode: "DAY",
      },
      transitTime: {
        "@type": "QuantitativeValue",
        minValue: 0,
        maxValue: 0,
        unitCode: "DAY",
      },
    },
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

function buildBreadcrumbItems(localizedPath: string): Array<{ name: string; item: string }> {
  const segments = localizedPath.split("/").filter(Boolean);
  const localeSegment = isLocale(segments[0]) ? segments[0] : undefined;
  const contentSegments = localeSegment ? segments.slice(1) : segments;
  const homePath = localeSegment ? `/${localeSegment}` : "/";
  const pathSegments: string[] = [];
  const items = [{ name: "Home", item: absoluteUrl(homePath) }];

  for (const segment of contentSegments) {
    pathSegments.push(segment);
    items.push({
      name: breadcrumbName(segment),
      item: absoluteUrl(`${homePath === "/" ? "" : homePath}/${pathSegments.join("/")}`),
    });
  }

  return items;
}

function breadcrumbName(segment: string): string {
  return decodeURIComponent(segment)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function pageNameFromPath(pathname: string): string {
  const lastSegment = pathname.split("/").filter(Boolean).at(-1);
  return lastSegment ? `${breadcrumbName(lastSegment)} | ${SITE_NAME}` : SITE_NAME;
}

function absoluteUrl(path: string): string {
  return `${SITE_ORIGIN}${path}`;
}
