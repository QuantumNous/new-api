import { consoleUrl } from "./origins";

export const CLAUDE_TOOLS_AD_SLUGS = [
  "web-scraping-api",
  "google-search-api",
  "apify-alternative",
] as const;

export type ClaudeToolsAdSlug = (typeof CLAUDE_TOOLS_AD_SLUGS)[number];

export type ClaudeToolsAdConfig = {
  slug: ClaudeToolsAdSlug;
  eyebrow: string;
  h1: string;
  description: string;
  primaryCta: string;
  secondaryCta: string;
  marketplaceQuery: string;
  input: string;
  pricedRows: Array<{ status: string; tool: string; capability: string; price: string }>;
  proofTitle: string;
  proofBody: string;
  proofRows: Array<{ label: string; value: string }>;
  workflow: Array<{ step: string; title: string; body: string }>;
  finalTitle: string;
  finalBody: string;
  caveats?: string[];
};

const CONFIGS: Record<ClaudeToolsAdSlug, ClaudeToolsAdConfig> = {
  "web-scraping-api": {
    slug: "web-scraping-api",
    eyebrow: "WEB SCRAPING API · METERED PER CALL",
    h1: "A web scraping API you don't have to pick a plan for",
    description:
      "Describe the output, compare supported tools, and inspect the exact Flatkey price before a billable run. One key and one prepaid balance carry the result into the rest of your agent workflow.",
    primaryCta: "Create a key and run a call",
    secondaryCta: "Browse scraping tools",
    marketplaceQuery: "web scraping",
    input: "get the full HTML and clean text of a product page, JS-rendered",
    pricedRows: [
      { status: "MATCH", tool: "web.extract", capability: "render + clean text", price: "SHOWN PRE-RUN" },
      { status: "MATCH", tool: "browser.fetch", capability: "browser evidence", price: "SHOWN PRE-RUN" },
      { status: "NEXT", tool: "model.parse", capability: "structured fields", price: "SAME BALANCE" },
    ],
    proofTitle: "The billable unit is visible before the agent commits.",
    proofBody:
      "Inspect a live tool's input schema, output example, billing unit, and exact Flatkey price. Start with one bounded URL; keep the path only when its output passes your acceptance check.",
    proofRows: [
      { label: "ACCESS", value: "One Flatkey API key for supported metered tools" },
      { label: "CONTROL", value: "Exact Flatkey price shown before execution" },
      { label: "RECEIPT", value: "Request id, final charge, and balance stay together" },
    ],
    workflow: [
      { step: "01", title: "State the accepted output", body: "Define fields, page type, rendering need, and source limits." },
      { step: "02", title: "Inspect the contract", body: "Review the live schema, example, billing unit, and price." },
      { step: "03", title: "Run one bounded call", body: "Validate the output and reconcile the returned charge before scaling." },
    ],
    finalTitle: "Get one call working, then decide",
    finalBody: "No plan selection is required to test a supported tool. Fund one balance, inspect the contract, and prove the data path.",
  },
  "google-search-api": {
    slug: "google-search-api",
    eyebrow: "GOOGLE SEARCH API · SERP · METERED PER CALL",
    h1: "Google Search API access without picking a SERP vendor first",
    description:
      "Compare supported search tools at the request level. See the contract and exact Flatkey price before execution, then use the same balance to research or summarize the returned sources.",
    primaryCta: "Create a key and run a search",
    secondaryCta: "Browse search tools",
    marketplaceQuery: "google search",
    input: "organic results + related queries for ‘best crm for agencies’, US desktop",
    pricedRows: [
      { status: "MATCH", tool: "serp.organic", capability: "ranked results", price: "SHOWN PRE-RUN" },
      { status: "MATCH", tool: "serp.related", capability: "related queries", price: "SHOWN PRE-RUN" },
      { status: "NEXT", tool: "model.research", capability: "source analysis", price: "SAME BALANCE" },
    ],
    proofTitle: "Choose the request contract, not a long-term vendor bet.",
    proofBody:
      "Set the query, market, language, device, and result depth. Compare the live tool contracts, retain source URLs, and reconcile the accepted result against its final charge.",
    proofRows: [
      { label: "SCOPE", value: "Query, market, language, device, and result limit" },
      { label: "OUTPUT", value: "Structured result fields with source URLs" },
      { label: "NEXT", value: "Search and AI-model steps use the same balance" },
    ],
    workflow: [
      { step: "01", title: "Define search context", body: "Lock the query, geography, language, device, and maximum rows." },
      { step: "02", title: "Compare live contracts", body: "Select a supported tool by fields, scope, billing unit, and price." },
      { step: "03", title: "Keep the sources moving", body: "Classify, enrich, or summarize the evidence with the same account." },
    ],
    finalTitle: "One query, one price, one balance",
    finalBody: "Run a bounded search first. Preserve every source URL and measure the cost of the useful downstream result.",
  },
  "apify-alternative": {
    slug: "apify-alternative",
    eyebrow: "APIFY ALTERNATIVE · ACCESS + BILLING LAYER",
    h1: "A simpler commercial layer for the tools your agent actually runs",
    description:
      "Flatkey is not a drop-in replacement for every Apify Actor. It is a different operating layer: discover supported metered tools, see the exact Flatkey price before execution, and use one key and prepaid balance across tools and AI models.",
    primaryCta: "Create a Flatkey key",
    secondaryCta: "Compare supported tools",
    marketplaceQuery: "web scraping",
    input: "find a supported tool for product-page extraction, then pass the result to a model",
    pricedRows: [
      { status: "CHECK", tool: "tool.catalog", capability: "live coverage", price: "VISIBLE FIRST" },
      { status: "MATCH", tool: "web.extract", capability: "supported output", price: "SHOWN PRE-RUN" },
      { status: "NEXT", tool: "model.parse", capability: "downstream AI", price: "SAME BALANCE" },
    ],
    proofTitle: "Flatkey changes the buying surface—not the meaning of coverage.",
    proofBody:
      "Verify every capability in the live catalog. Where Flatkey has a supported fit, the difference is operational: one commercial account, upfront request pricing, and a shared ledger across tools and models.",
    proofRows: [
      { label: "DISCOVER", value: "Search supported tools by the output you need" },
      { label: "VERIFY", value: "Inspect the live schema and current coverage" },
      { label: "OPERATE", value: "One key, prepaid balance, and request-level ledger" },
    ],
    workflow: [
      { step: "01", title: "Inventory the job", body: "List the Actor output and inputs your production path depends on." },
      { step: "02", title: "Verify live coverage", body: "Confirm a supported Flatkey tool matches the required contract." },
      { step: "03", title: "Prove one migration path", body: "Run a bounded call and compare accepted output plus total workflow cost." },
    ],
    caveats: [
      "Not a replacement for every Apify Actor.",
      "Not a claim that each Actor has equivalent coverage.",
      "It is one key + one prepaid balance + exact Flatkey price before run for supported tools.",
    ],
    finalTitle: "Compare the operating layer on one real job",
    finalBody: "Start from your required output, verify live coverage, and migrate only the path that passes your acceptance criteria.",
  },
};

export function getClaudeToolsAdConfig(slug: ClaudeToolsAdSlug): ClaudeToolsAdConfig {
  return CONFIGS[slug];
}

export function getClaudeToolsAdConfigs(): ClaudeToolsAdConfig[] {
  return CLAUDE_TOOLS_AD_SLUGS.map((slug) => CONFIGS[slug]);
}

export function getClaudeToolsAdMarketplaceUrl(config: ClaudeToolsAdConfig): string {
  return consoleUrl("/api-marketplace", `lng=en&q=${encodeURIComponent(config.marketplaceQuery)}`);
}

export function getClaudeToolsAdSignupUrl(config: ClaudeToolsAdConfig): string {
  const redirect = `/api-marketplace?q=${encodeURIComponent(config.marketplaceQuery)}`;
  return consoleUrl("/sign-up", `redirect=${encodeURIComponent(redirect)}&lng=en`);
}
