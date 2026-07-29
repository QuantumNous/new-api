import { consoleUrl } from "./origins";
import type { SeoInput } from "./seo";

export const APIFY_ALTERNATIVE_PATH = "/apify-alternative";
export const APIFY_ALTERNATIVE_KEYWORD = "apify alternative";
export const APIFY_ALTERNATIVE_SETUP_COMMAND = "Set up Flatkey from https://flatkey.ai/SKILL.md";

export const apifyAlternativeCopy = {
  badge: "Built for agent workflows",
  h1Lead: "Apify",
  h1Accent: "Alternative",
  description:
    "Run web, search, social, commerce, enrichment, and media tools with one Flatkey API key and one prepaid balance—without making every workflow a separate Actor project.",
  primaryCta: "Browse 1,000+ tools",
  secondaryCta: "Get a Flatkey API key",
  trustLine: "One key · one balance · exact price before each run · Flatkey-side failures cost $0",
  setupLabel: "Give this line to your agent",
  copyLabel: "Copy",
  copiedLabel: "Copied",
  previewTitle: "From intent to a metered result",
  previewSteps: [
    { label: "Discover", value: "Find the smallest tool for the job" },
    { label: "Inspect", value: "Check schema, billing unit, and exact price" },
    { label: "Run", value: "Receive output, latency, charge, and balance" },
  ],
  whyEyebrow: "Why teams evaluate alternatives",
  whyTitle: "Use a tool. Do not build a platform project for every task.",
  whyBody:
    "Flatkey is designed for teams that want an agent to discover and run a metered capability, then move on to the next step with the same key and wallet.",
  benefits: [
    {
      title: "One runtime for tools and models",
      body: "Use 1,000+ metered tools and 300+ AI models from the same Flatkey account and prepaid balance.",
    },
    {
      title: "Price before execution",
      body: "Inspect required fields, examples, billing unit, and the exact Flatkey price before a billable run.",
    },
    {
      title: "Agent-native discovery",
      body: "Let an agent search by intent instead of requiring it to know a provider, Actor, or integration name in advance.",
    },
    {
      title: "A request-level ledger",
      body: "Each response surfaces the result, latency, final charge, and remaining balance for traceable automation.",
    },
  ],
  comparisonEyebrow: "Flatkey vs Apify",
  comparisonTitle: "Choose the operating model that matches the work.",
  comparisonBody:
    "Apify is a mature platform for building and running Actors. Flatkey is the simpler fit when agents need many ready-to-run capabilities plus AI models behind one commercial surface.",
  comparisonHeaders: ["Decision", "Flatkey Tools", "Apify"],
  comparisonRows: [
    ["Primary unit", "A metered tool with a visible schema and price", "An Actor or API integration running on the Apify platform"],
    ["Credentials", "One Flatkey API key", "An Apify API token; some Actors can require additional credentials"],
    ["Commercial model", "One prepaid balance shared by tools and 300+ models", "Platform usage plus Actor-specific pricing; verify current terms on official pages"],
    ["Agent entry points", "Public Skill, API, and Tools Marketplace", "Actors, API, SDKs, and integrations supported by Apify"],
    ["Best fit", "Agents that move across web, GTM, social, commerce, and media jobs", "Teams building, publishing, or operating reusable Actors on Apify Cloud"],
  ],
  comparisonNote:
    "Comparison reflects public product documentation reviewed July 28, 2026. Product capabilities and pricing can change.",
  sourceLinks: [
    { label: "Apify Actors documentation", href: "https://docs.apify.com/platform/actors" },
    { label: "Apify pricing", href: "https://apify.com/pricing" },
  ],
  migrationEyebrow: "Low-risk migration",
  migrationTitle: "Prove one job before moving a workflow.",
  migrationSteps: [
    { number: "01", title: "Name the output", body: "Start with the result your agent needs, not the provider or Actor currently producing it." },
    { number: "02", title: "Inspect the matching tool", body: "Verify required input, example output, billing unit, and exact price in the live catalog." },
    { number: "03", title: "Run a bounded test", body: "Use an idempotency key and a small input; compare result quality, latency, and total charge." },
    { number: "04", title: "Move only the winner", body: "Keep the current path as fallback until the Flatkey result meets your acceptance threshold." },
  ],
  useCasesEyebrow: "One key, more than scraping",
  useCasesTitle: "Keep the workflow moving after the page is fetched.",
  useCases: [
    "Search and structured web extraction",
    "Company, people, and contact enrichment",
    "Social and creator intelligence",
    "Commerce listings, reviews, and demand signals",
    "Browser-driven research and evidence capture",
    "Image, video, voice, and media generation",
  ],
  faqEyebrow: "Questions before switching",
  faqTitle: "Evaluate Flatkey on the job that matters.",
  faqs: [
    {
      question: "Is Flatkey a drop-in replacement for every Apify Actor?",
      answer:
        "No. Match the required output against the live Flatkey catalog first. Keep Apify when you need a custom Actor or platform capability that Flatkey does not provide.",
    },
    {
      question: "Do I need a separate key for each data provider?",
      answer:
        "No. Supported Flatkey tools use one Flatkey API key. The live listing shows the required inputs and price before execution.",
    },
    {
      question: "How do I compare cost fairly?",
      answer:
        "Compare total cost per accepted result, including retries, failed runs, platform usage, and downstream processing—not only the advertised unit price.",
    },
    {
      question: "Are failed calls charged?",
      answer:
        "Flatkey-side failures should not consume balance. Use the execution response and request ledger as the source of truth for the final charge.",
    },
    {
      question: "Is Flatkey affiliated with Apify?",
      answer:
        "No. Flatkey and Apify are independent products. Apify is a trademark of its respective owner and is referenced only for factual comparison.",
    },
  ],
  finalTitle: "Test one Apify workflow with one Flatkey key.",
  finalBody: "Inspect the live schema and price, run a bounded example, and keep the path that produces the best accepted result.",
  finalCta: "Open the Tools Marketplace",
  seo: {
    title: "Apify Alternative for AI Agents — one key for 1,000+ tools",
    description:
      "Compare Flatkey as an Apify alternative for agent workflows: 1,000+ metered tools, 300+ AI models, one API key, one balance, and request-level billing.",
  },
} as const;

export function getApifyAlternativeMarketplaceUrl(): string {
  return consoleUrl("/api-marketplace", "lng=en");
}

export function getApifyAlternativeSignupUrl(): string {
  return consoleUrl("/sign-up", `redirect=${encodeURIComponent("/api-marketplace")}&lng=en`);
}

export function getApifyAlternativeMetadataInput(): SeoInput {
  return {
    title: apifyAlternativeCopy.seo.title,
    description: apifyAlternativeCopy.seo.description,
    pathname: APIFY_ALTERNATIVE_PATH,
    locale: "en",
    locales: ["en"],
  };
}
