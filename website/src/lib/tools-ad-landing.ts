import { consoleUrl } from "./origins";
import type { SeoInput } from "./seo";

export const TOOLS_AD_LANDING_SLUGS = ["web-scraping-api", "google-search-api"] as const;

export type ToolsAdLandingSlug = (typeof TOOLS_AD_LANDING_SLUGS)[number];

export type ToolsAdLandingConfig = {
  slug: ToolsAdLandingSlug;
  keyword: string;
  marketplaceQuery: string;
  badge: string;
  h1: string;
  h1Accent: string;
  description: string;
  primaryCta: string;
  secondaryCta: string;
  promptLabel: string;
  prompt: string;
  receiptTitle: string;
  receiptRows: Array<{ label: string; value: string }>;
  chips: string[];
  benefits: Array<{ title: string; body: string }>;
  workflowTitle: string;
  workflowBody: string;
  workflowSteps: Array<{ number: string; title: string; body: string }>;
  useCasesTitle: string;
  useCases: string[];
  faqs: Array<{ question: string; answer: string }>;
  comparison: {
    eyebrow: string;
    title: string;
    body: string;
    headers: string[];
    rows: string[][];
    note: string;
    sources: Array<{ label: string; href: string }>;
  };
  finalTitle: string;
  finalBody: string;
  seo: { title: string; description: string };
};

const WEB_SCRAPING_API: ToolsAdLandingConfig = {
  slug: "web-scraping-api",
  keyword: "web scraping api",
  marketplaceQuery: "web scraping",
  badge: "Web data · browser automation · structured output",
  h1: "Web Scraping API",
  h1Accent: "for AI agents.",
  description:
    "Give an agent one Flatkey key to discover and run metered web extraction tools. Inspect the schema and exact Flatkey price before execution, then keep the result and charge in the same request trail.",
  primaryCta: "Browse scraping tools",
  secondaryCta: "Get a Flatkey key",
  promptLabel: "Example job",
  prompt: "Extract product name, price, availability, and source URL from 25 product pages.",
  receiptTitle: "Execution receipt",
  receiptRows: [
    { label: "Tool", value: "Matched by output and input schema" },
    { label: "Result", value: "25 structured rows with source URLs" },
    { label: "Ledger", value: "Final charge and balance returned" },
  ],
  chips: ["One API key", "Price before run", "Request-level ledger"],
  benefits: [
    {
      title: "Choose by output, not vendor",
      body: "Search the live catalog for the smallest capability that produces the fields your workflow actually needs.",
    },
    {
      title: "Know the price before execution",
      body: "Inspect required inputs, examples, billing unit, and the exact Flatkey price before a billable run.",
    },
    {
      title: "Keep evidence with the result",
      body: "Return structured output, latency, charge, and remaining balance so agents can reconcile every accepted run.",
    },
    {
      title: "Continue with the same balance",
      body: "Pass extracted data to 300+ AI models and other metered tools without opening another provider account.",
    },
  ],
  workflowTitle: "From URL to accepted data in one bounded workflow.",
  workflowBody:
    "Start with a small input, inspect the contract, run once, and only scale the path after the returned rows meet your acceptance criteria.",
  workflowSteps: [
    { number: "01", title: "Describe the output", body: "Name the fields, source limits, geography, and freshness your agent needs." },
    { number: "02", title: "Inspect the contract", body: "Review schema, sample output, billing unit, and exact price before execution." },
    { number: "03", title: "Run and reconcile", body: "Store the result together with request id, latency, final charge, and remaining balance." },
  ],
  useCasesTitle: "Built for web-data jobs that feed a larger agent workflow.",
  useCases: [
    "Product and price monitoring",
    "Market and competitor research",
    "Lead and company data collection",
    "Review and listing extraction",
    "Browser-driven evidence capture",
    "RAG and agent data pipelines",
  ],
  faqs: [
    {
      question: "Is this one universal scraper endpoint?",
      answer:
        "No. Flatkey gives an agent one commercial surface for discovering and running supported metered tools. Inspect the live catalog to select the right tool for each output.",
    },
    {
      question: "Do I need a separate key for every scraping provider?",
      answer:
        "Supported Flatkey tools use one Flatkey API key and prepaid balance. The live tool listing shows any required inputs before execution.",
    },
    {
      question: "What happens when a Flatkey-side call fails?",
      answer:
        "Flatkey-side failures should not consume balance. Use the execution response and request ledger as the source of truth for the final charge.",
    },
  ],
  comparison: {
    eyebrow: "Flatkey vs a dedicated scraping API",
    title: "Compare the operating model, not just the request.",
    body: "Single-purpose scraping APIs such as ScraperAPI, Bright Data, and Zyte are built to run one kind of extraction well. Flatkey is the better fit when an agent needs many ready-to-run web-data tools plus AI models behind one key and one prepaid balance.",
    headers: ["Decision", "Flatkey Tools", "A dedicated scraping API"],
    rows: [
      [
        "Primary unit",
        "A metered tool with a visible schema and exact price shown before each run",
        "A scraping endpoint or plan you integrate and manage per provider",
      ],
      [
        "Credentials",
        "One Flatkey API key and one prepaid balance",
        "A provider-specific key and account, usually one per vendor",
      ],
      [
        "Commercial model",
        "Pay per accepted run; the same balance also covers 300+ AI models and other tools",
        "Subscription tiers or credit packs scoped to that scraping product; verify current terms",
      ],
      [
        "After extraction",
        "Continue to models, search, and other tools on the same account and request trail",
        "Move the data into a separate AI or tooling stack you wire up yourself",
      ],
      [
        "Best fit",
        "Agents that mix web extraction with search, models, and downstream jobs",
        "Teams that want one specialized scraper tuned and operated in-house",
      ],
    ],
    note: "Comparison reflects public product documentation reviewed July 29, 2026. Capabilities and pricing change often; confirm current terms on each vendor's official pages.",
    sources: [
      { label: "ScraperAPI docs", href: "https://docs.scraperapi.com/" },
      { label: "Bright Data pricing", href: "https://brightdata.com/pricing" },
      { label: "Zyte pricing", href: "https://www.zyte.com/pricing/" },
    ],
  },
  finalTitle: "Prove one web-data job before you scale it.",
  finalBody: "Inspect the live contract, run a bounded example, and keep the path only when the returned data meets your acceptance threshold.",
  seo: {
    title: "Web Scraping API for AI Agents — one Flatkey key",
    description:
      "Run metered web scraping and browser automation tools with one Flatkey API key. Inspect schemas and exact pricing before execution, then reconcile every result.",
  },
};

const GOOGLE_SEARCH_API: ToolsAdLandingConfig = {
  slug: "google-search-api",
  keyword: "google search api",
  marketplaceQuery: "google search",
  badge: "SERP data · search intelligence · agent-ready output",
  h1: "Google Search API",
  h1Accent: "for agent workflows.",
  description:
    "Collect structured search results through metered Flatkey tools, then research, enrich, or summarize them with the same key and prepaid balance.",
  primaryCta: "Browse search tools",
  secondaryCta: "Get a Flatkey key",
  promptLabel: "Example job",
  prompt: "Search “best LLM API gateway” in the United States and return ranked results with titles, URLs, and snippets.",
  receiptTitle: "Search receipt",
  receiptRows: [
    { label: "Scope", value: "Query, country, language, and result limit" },
    { label: "Result", value: "Structured ranked results with source URLs" },
    { label: "Next", value: "Research or summarize with the same balance" },
  ],
  chips: ["SERP-ready output", "One prepaid balance", "Source URLs preserved"],
  benefits: [
    {
      title: "Search data an agent can use",
      body: "Return structured result fields instead of making downstream steps parse a rendered search page.",
    },
    {
      title: "Control the search scope",
      body: "Select a supported tool whose schema matches the query, market, language, and result depth your workflow needs.",
    },
    {
      title: "Inspect cost before the run",
      body: "See the billing unit and exact Flatkey price before execution rather than discovering spend after a large batch.",
    },
    {
      title: "Move from result to decision",
      body: "Use 300+ AI models and other tools from the same Flatkey account to classify, enrich, or summarize the search evidence.",
    },
  ],
  workflowTitle: "Search is the first step, not the final deliverable.",
  workflowBody:
    "Flatkey keeps search collection, downstream analysis, and request-level billing on one commercial surface so agents can complete the whole job.",
  workflowSteps: [
    { number: "01", title: "Set the query context", body: "Define the keyword, market, language, result type, and maximum row count." },
    { number: "02", title: "Collect structured results", body: "Choose a supported search tool and retain source URLs with every returned row." },
    { number: "03", title: "Analyze and activate", body: "Classify, enrich, summarize, or route the evidence with the same key and balance." },
  ],
  useCasesTitle: "A SERP API surface for research and automation.",
  useCases: [
    "Competitor and category monitoring",
    "SEO and AI-search research",
    "Lead discovery from search intent",
    "Source-backed content research",
    "Brand and product monitoring",
    "Agentic research pipelines",
  ],
  faqs: [
    {
      question: "Is Flatkey the Google Custom Search API?",
      answer:
        "No. Flatkey provides access to supported metered search tools through one key and balance. Inspect each live tool listing for its current scope and data fields.",
    },
    {
      question: "Can one result feed another Flatkey tool or model?",
      answer:
        "Yes. Search output can continue into supported enrichment, research, or AI-model steps using the same Flatkey account and prepaid balance.",
    },
    {
      question: "How should I control spend?",
      answer:
        "Inspect the exact Flatkey price, start with a small result limit, keep an idempotency key where supported, and reconcile the final charge from the execution response.",
    },
  ],
  comparison: {
    eyebrow: "Flatkey vs a dedicated SERP API",
    title: "Compare the operating model, not just the query.",
    body: "Single-purpose SERP APIs such as SerpApi, SearchApi, and Bright Data SERP specialize in returning search results. Flatkey fits when an agent needs search collection plus research, enrichment, and AI models on one key and one prepaid balance.",
    headers: ["Decision", "Flatkey Tools", "A dedicated SERP API"],
    rows: [
      [
        "Primary unit",
        "A metered search tool with a visible schema and exact price shown before each run",
        "A search endpoint or plan you integrate and manage per provider",
      ],
      [
        "Credentials",
        "One Flatkey API key and one prepaid balance",
        "A provider-specific key and account, usually one per vendor",
      ],
      [
        "Commercial model",
        "Pay per accepted run; the same balance also covers 300+ AI models and other tools",
        "Monthly search quotas or credit tiers scoped to that SERP product; verify current terms",
      ],
      [
        "After the results",
        "Classify, enrich, or summarize with models on the same account and request trail",
        "Move results into a separate AI or tooling stack you wire up yourself",
      ],
      [
        "Best fit",
        "Agents that turn search into a decision across research, GTM, and content jobs",
        "Teams that only need raw SERP data at high volume from one vendor",
      ],
    ],
    note: "Comparison reflects public product documentation reviewed July 29, 2026. Capabilities and pricing change often; confirm current terms on each vendor's official pages.",
    sources: [
      { label: "SerpApi search API", href: "https://serpapi.com/search-api" },
      { label: "SearchApi", href: "https://www.searchapi.io/" },
      { label: "Bright Data SERP API", href: "https://brightdata.com/products/serp-api" },
    ],
  },
  finalTitle: "Turn one search query into a complete agent workflow.",
  finalBody: "Start with a bounded search, preserve the source URLs, and measure the cost of the accepted downstream result—not only the first API call.",
  seo: {
    title: "Google Search API and SERP tools for AI agents — Flatkey",
    description:
      "Run metered Google Search and SERP tools with one Flatkey API key and prepaid balance, then analyze or enrich structured results on the same account.",
  },
};

const CONFIGS: Record<ToolsAdLandingSlug, ToolsAdLandingConfig> = {
  "web-scraping-api": WEB_SCRAPING_API,
  "google-search-api": GOOGLE_SEARCH_API,
};

export function getToolsAdLandingConfig(slug: ToolsAdLandingSlug): ToolsAdLandingConfig {
  return CONFIGS[slug];
}

export function getToolsAdLandingConfigs(): ToolsAdLandingConfig[] {
  return TOOLS_AD_LANDING_SLUGS.map((slug) => CONFIGS[slug]);
}

export function toolsAdLandingPath(slug: ToolsAdLandingSlug): string {
  return `/tools/${slug}`;
}

export function getToolsAdLandingPathnames(): string[] {
  return TOOLS_AD_LANDING_SLUGS.map(toolsAdLandingPath);
}

export function getToolsAdMarketplaceUrl(slug: ToolsAdLandingSlug): string {
  const config = getToolsAdLandingConfig(slug);
  return consoleUrl("/api-marketplace", `lng=en&q=${encodeURIComponent(config.marketplaceQuery)}`);
}

export function getToolsAdSignupUrl(slug: ToolsAdLandingSlug): string {
  const redirect = `/api-marketplace?q=${encodeURIComponent(getToolsAdLandingConfig(slug).marketplaceQuery)}`;
  return consoleUrl("/sign-up", `redirect=${encodeURIComponent(redirect)}&lng=en`);
}

export function getToolsAdLandingMetadataInput(slug: ToolsAdLandingSlug): SeoInput {
  const config = getToolsAdLandingConfig(slug);
  return {
    title: config.seo.title,
    description: config.seo.description,
    pathname: toolsAdLandingPath(slug),
    locale: "en",
    locales: ["en"],
  };
}
