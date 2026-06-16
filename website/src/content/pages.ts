import type { Locale } from "@/lib/locales";
import { getDefaultLegalDocument, type LegalDocumentKind } from "./legal/default-documents";

type PageContent = {
  title: string;
  description: string;
  eyebrow: string;
  sections?: { title: string; body: string }[];
  document?: string;
  updated?: string;
};

const generic: Record<string, Omit<PageContent, "eyebrow">> = {
  pricing: {
    title: "Transparent AI model pricing",
    description:
      "Compare model access, routing, and billing options for production AI workloads on flatkey.ai.",
    sections: [
      { title: "Unified billing", body: "Track spend across providers, models, users, keys, and projects from one place." },
      { title: "Operational control", body: "Use routing, quotas, and analytics to keep production usage predictable." },
      { title: "Procurement ready", body: "Keep public pricing discoverable while detailed account controls stay in the app." },
    ],
  },
  rankings: {
    title: "AI model rankings and market signals",
    description:
      "Explore model availability, usage trends, and operational signals for teams choosing production AI models.",
    sections: [
      { title: "Model visibility", body: "Compare popular models by availability, usage, and platform fit." },
      { title: "Routing context", body: "Use rankings as a starting point for fallback and routing decisions." },
      { title: "Updated signals", body: "Public rankings can be generated server-side without depending on client JavaScript." },
    ],
  },
  about: {
    title: "About flatkey.ai",
    description:
      "flatkey.ai helps teams operate AI APIs with routing, billing, analytics, and access controls in one gateway.",
    sections: [
      { title: "Built for operators", body: "The product focuses on reliability, cost clarity, and day-to-day AI API operations." },
      { title: "Provider neutral", body: "Teams can connect multiple upstream providers while keeping one client-facing API." },
      { title: "Production first", body: "The public website is now separated from the application shell so search engines receive real HTML." },
    ],
  },
  terms: {
    title: "Terms of Service",
    description: "Read the terms that govern accounts, prepaid balance, model access, usage, billing, refunds, and dispute handling for flatkey.ai.",
    sections: [],
  },
  privacy: {
    title: "Privacy Policy",
    description: "Learn how flatkey.ai collects, uses, shares, retains, and protects account, payment, API usage, support, and security information.",
    sections: [],
  },
  sla: {
    title: "Service Level Agreement",
    description: "Review flatkey.ai availability scope, incident handling, maintenance, exclusions, support process, and remedies.",
    sections: [],
  },
  "refund-policy": {
    title: "Refund Policy",
    description: "Review how flatkey.ai handles refund eligibility, unused balance, consumed API usage, duplicate charges, disputes, taxes, and support requests.",
    sections: [],
  },
};

const legalDocumentByPage: Partial<Record<keyof typeof generic, LegalDocumentKind>> = {
  terms: "terms",
  privacy: "privacy",
  sla: "sla",
  "refund-policy": "refund",
};

function getMarkdownTitle(markdown: string): string | undefined {
  return markdown
    .split("\n")
    .find((line) => line.startsWith("# "))
    ?.replace(/^#\s+/, "")
    .trim();
}

const eyebrowByLocale: Record<Locale, string> = {
  en: "Official website",
  zh: "官方网站",
  es: "Sitio oficial",
  fr: "Site officiel",
  pt: "Site oficial",
  ru: "Официальный сайт",
  ja: "公式サイト",
  vi: "Trang chính thức",
  de: "Offizielle Website",
};

export type PublicPageKey = keyof typeof generic;

export function getPageContent(key: PublicPageKey, locale: Locale): PageContent {
  const legalKind = legalDocumentByPage[key];
  const document = legalKind ? getDefaultLegalDocument(legalKind, locale) : undefined;
  const title = document ? (getMarkdownTitle(document) ?? generic[key].title) : generic[key].title;
  return {
    ...generic[key],
    title,
    eyebrow: eyebrowByLocale[locale] ?? eyebrowByLocale.en,
    document,
    updated: legalKind ? "June 4, 2026" : undefined,
  };
}
