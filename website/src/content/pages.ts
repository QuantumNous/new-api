import type { Locale } from "@/lib/locales";

type PageContent = {
  title: string;
  description: string;
  eyebrow: string;
  sections: { title: string; body: string }[];
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
    description: "Read the terms that govern use of flatkey.ai products and services.",
    sections: [
      { title: "Service use", body: "Use of flatkey.ai must comply with applicable laws, provider policies, and account limits." },
      { title: "Accounts", body: "Customers are responsible for account security, API keys, and activity under their organization." },
      { title: "Changes", body: "The service and these terms may be updated as the product and compliance requirements evolve." },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    description: "Learn how flatkey.ai handles product, account, billing, and usage data.",
    sections: [
      { title: "Data we process", body: "We process account, billing, usage, and operational data needed to provide the service." },
      { title: "Security", body: "Controls are designed around API gateway operations, access management, and auditability." },
      { title: "Contact", body: "Privacy requests can be sent to the support contact listed in your service agreement." },
    ],
  },
  sla: {
    title: "Service Level Agreement",
    description: "Review flatkey.ai service availability principles and support expectations.",
    sections: [
      { title: "Availability", body: "The service is operated for production AI workloads with monitoring and incident response." },
      { title: "Support", body: "Support channels and response expectations depend on the customer plan and agreement." },
      { title: "Exclusions", body: "Upstream provider outages, customer configuration errors, and force majeure events may be excluded." },
    ],
  },
};

const eyebrowByLocale: Record<Locale, string> = {
  en: "Official website",
  zh: "官方网站",
  es: "Sitio oficial",
  fr: "Site officiel",
  pt: "Site oficial",
  ru: "Официальный сайт",
  ja: "公式サイト",
  vi: "Trang chính thức",
};

export type PublicPageKey = keyof typeof generic;

export function getPageContent(key: PublicPageKey, locale: Locale): PageContent {
  return {
    ...generic[key],
    eyebrow: eyebrowByLocale[locale] ?? eyebrowByLocale.en,
  };
}
