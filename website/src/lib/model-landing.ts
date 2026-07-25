import type { Locale } from "./locales";
import { withIdFallback } from "@/lib/locales";
import type { PricingModel } from "./pricing";

export type ModelPriceRow = {
  label: string;
  flatkey: string;
  official?: string;
  value?: string;
};

export type ModelConfig = {
  slug: string;
  modelIds: string[];
  displayName: string;
  modelId: string;
  officialName: string;
  officialPrice: string;
  flatkeyPrice: string;
  estFlatkey: string;
  estOfficial: string;
  examplePrompt: string;
  priceUnit: ModelLandingKey;
  rows: ModelPriceRow[];
  seo: {
    title: string;
    description: string;
  };
  positioning: ModelLandingKey;
  useCases: ModelLandingKey[];
  faq: Array<{ question: ModelLandingKey; answer: ModelLandingKey }>;
};

const COVERAGE = "GPT · Gemini · Claude · DeepSeek · Kimi · Seedance";

export const CLAUDE_CONFIG: ModelConfig = {
  slug: "claude-api",
  modelIds: ["claude-opus-4", "claude-sonnet-4", "claude-haiku"],
  displayName: "Claude Opus 4",
  modelId: "claude-opus-4",
  officialName: "Anthropic",
  officialPrice: "$15.00",
  flatkeyPrice: "$10.00",
  estFlatkey: "$0.005",
  estOfficial: "$0.008",
  examplePrompt:
    "You are a senior backend engineer. In 3 sentences, explain why developers should use an LLM gateway instead of calling each official API directly.",
  priceUnit: "/ million output tokens",
  rows: [
    { label: "Opus 4 output", flatkey: "$10.0", official: "$15" },
    { label: "Sonnet 4 output", flatkey: "$10.0", official: "$15" },
    { label: "Haiku output", flatkey: "$2.7", official: "$4" },
    { label: "Cache reads", flatkey: "", value: "50% off" },
    { label: "Coverage", flatkey: "", value: COVERAGE },
  ],
  seo: {
    title: "Claude API pricing with one OpenAI-compatible key",
    description: "Use Claude through flatkey.ai with OpenAI-compatible routing, lower token costs, one API key, and unified billing.",
  },
  positioning: "Best for long-context reasoning, coding agents, and production assistants",
  useCases: ["Coding agents", "Support automation", "Long document analysis"],
  faq: [
    {
      question: "Does this use the same model id in my SDK?",
      answer: "Yes. Keep your SDK and switch base_url plus api_key.",
    },
    {
      question: "Can I control usage before scaling?",
      answer: "Yes. Plan limits, usage analytics, and one invoice keep spend bounded.",
    },
  ],
};

export const GPT_CONFIG: ModelConfig = {
  slug: "gpt-api",
  modelIds: ["gpt-5", "gpt-5-mini", "gpt-4o", "gpt-4.1"],
  displayName: "GPT-5",
  modelId: "gpt-5",
  officialName: "OpenAI",
  officialPrice: "$10.00",
  flatkeyPrice: "$6.67",
  estFlatkey: "$0.004",
  estOfficial: "$0.006",
  examplePrompt:
    "You are a senior backend engineer. In 3 sentences, explain why developers should use an LLM gateway instead of calling each official API directly.",
  priceUnit: "/ million output tokens",
  rows: [
    { label: "GPT-5 output", flatkey: "$6.7", official: "$10" },
    { label: "GPT-5 mini output", flatkey: "$1.3", official: "$2" },
    { label: "GPT-5 input", flatkey: "$0.83", official: "$1.25" },
    { label: "Cache reads", flatkey: "", value: "50% off" },
    { label: "Coverage", flatkey: "", value: COVERAGE },
  ],
  seo: {
    title: "GPT API pricing with one OpenAI-compatible key",
    description: "Use GPT models through flatkey.ai with OpenAI-compatible routing, lower token costs, one API key, and unified billing.",
  },
  positioning: "Best for general AI apps, agents, search, and high-volume API workloads",
  useCases: ["AI app backends", "Agent workflows", "Batch content generation"],
  faq: [
    {
      question: "Does this use the same model id in my SDK?",
      answer: "Yes. Keep your SDK and switch base_url plus api_key.",
    },
    {
      question: "Can I control usage before scaling?",
      answer: "Yes. Plan limits, usage analytics, and one invoice keep spend bounded.",
    },
  ],
};

export const GEMINI_CONFIG: ModelConfig = {
  slug: "gemini-api",
  modelIds: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"],
  displayName: "Gemini API",
  modelId: "gemini-2.5-pro",
  officialName: "Google Gemini",
  officialPrice: "$10.00",
  flatkeyPrice: "$6.67",
  estFlatkey: "$0.004",
  estOfficial: "$0.006",
  examplePrompt:
    "You are a senior backend engineer. In 3 sentences, explain why developers should use an LLM gateway instead of calling each official API directly.",
  priceUnit: "/ million output tokens",
  rows: [
    { label: "Gemini 2.5 Pro output", flatkey: "$6.67", official: "$10" },
    { label: "Gemini 2.5 Flash output", flatkey: "$1.67", official: "$2.50" },
    { label: "Gemini 2.5 Pro input", flatkey: "$0.83", official: "$1.25" },
    { label: "Cache reads", flatkey: "", value: "up to 50% off" },
    { label: "Coverage", flatkey: "", value: COVERAGE },
  ],
  seo: {
    title: "Gemini API without GCP setup — one OpenAI-compatible key",
    description:
      "Call Gemini 2.5 Pro and Flash through flatkey.ai with no Google Cloud project, billing account, or vendor SDK — one OpenAI-compatible key, lower token costs, unified billing.",
  },
  positioning: "Best for general AI apps, agents, search, and high-volume API workloads",
  useCases: ["AI app backends", "Agent workflows", "Batch content generation"],
  faq: [
    { question: "Does this use the same model id in my SDK?", answer: "Yes. Keep your SDK and switch base_url plus api_key." },
    { question: "Can I control usage before scaling?", answer: "Yes. Plan limits, usage analytics, and one invoice keep spend bounded." },
  ],
};

export const DEEPSEEK_CONFIG: ModelConfig = {
  slug: "deepseek-api",
  modelIds: ["deepseek-v4-flash", "deepseek-v4-pro", "deepseek-v3", "deepseek-v3.1", "deepseek-v3.2"],
  displayName: "DeepSeek API",
  modelId: "deepseek-v4-flash",
  officialName: "DeepSeek",
  officialPrice: "$0.14",
  flatkeyPrice: "$0.074667",
  estFlatkey: "$0.001",
  estOfficial: "$0.002",
  examplePrompt: "Compare two API gateway designs for reliability, cost control, and failover in three concise bullets.",
  priceUnit: "/ million output tokens",
  rows: [
    { label: "Coverage", flatkey: "", value: "DeepSeek V3 · V3.2 · V4 Flash · V4 Pro" },
    { label: "Cache reads", flatkey: "", value: "up to 50% off" },
  ],
  seo: {
    title: "DeepSeek API pricing — OpenAI-compatible access",
    description: "Call DeepSeek V3 and V4 models through flatkey.ai with live pricing, health metrics, one API key, and OpenAI-compatible code.",
  },
  positioning: "Best for general AI apps, agents, search, and high-volume API workloads",
  useCases: ["AI app backends", "Agent workflows", "Batch content generation"],
  faq: [
    { question: "Does this use the same model id in my SDK?", answer: "Yes. Keep your SDK and switch base_url plus api_key." },
    { question: "Can I control usage before scaling?", answer: "Yes. Plan limits, usage analytics, and one invoice keep spend bounded." },
  ],
};

export const QWEN_CONFIG: ModelConfig = {
  slug: "qwen-api",
  modelIds: ["qwen3.7-plus", "qwen3.7-max", "qwen3.6-plus", "qwen3.5-plus", "qwen3.5-flash"],
  displayName: "Qwen API",
  modelId: "qwen3.7-plus",
  officialName: "Alibaba Qwen",
  officialPrice: "$0.40",
  flatkeyPrice: "$0.24",
  estFlatkey: "$0.002",
  estOfficial: "$0.004",
  examplePrompt: "Design a multilingual support-agent workflow and return the architecture in three concise bullets.",
  priceUnit: "/ million output tokens",
  rows: [
    { label: "Coverage", flatkey: "", value: "Qwen 3.5 · 3.6 · 3.7 · Max · Plus" },
    { label: "Cache reads", flatkey: "", value: "up to 50% off" },
  ],
  seo: {
    title: "Qwen API pricing — one OpenAI-compatible key",
    description: "Use Qwen 3.5, 3.6, and 3.7 models through flatkey.ai with live pricing, one API key, and OpenAI-compatible routing.",
  },
  positioning: "Best for general AI apps, agents, search, and high-volume API workloads",
  useCases: ["AI app backends", "Agent workflows", "Batch content generation"],
  faq: [
    { question: "Does this use the same model id in my SDK?", answer: "Yes. Keep your SDK and switch base_url plus api_key." },
    { question: "Can I control usage before scaling?", answer: "Yes. Plan limits, usage analytics, and one invoice keep spend bounded." },
  ],
};

export const GLM_API_CONFIG: ModelConfig = {
  slug: "glm-api",
  modelIds: ["glm-5.2", "glm-5-turbo", "glm-4.7"],
  displayName: "GLM API",
  modelId: "glm-5.2",
  officialName: "Z.ai",
  officialPrice: "$1.40",
  flatkeyPrice: "$0.56",
  estFlatkey: "$0.003",
  estOfficial: "$0.006",
  examplePrompt: "Review this API migration plan for cost, latency, and rollback risk in three concise bullets.",
  priceUnit: "/ million output tokens",
  rows: [
    { label: "Coverage", flatkey: "", value: "GLM 4.7 · GLM 5 Turbo · GLM 5.2" },
    { label: "Cache reads", flatkey: "", value: "up to 50% off" },
  ],
  seo: {
    title: "GLM API pricing — GLM 5.2 and Z.ai models",
    description: "Call GLM 4.7, GLM 5 Turbo, and GLM 5.2 through flatkey.ai with live pricing, one API key, and OpenAI-compatible routing.",
  },
  positioning: "Best for general AI apps, agents, search, and high-volume API workloads",
  useCases: ["AI app backends", "Agent workflows", "Batch content generation"],
  faq: [
    { question: "Does this use the same model id in my SDK?", answer: "Yes. Keep your SDK and switch base_url plus api_key." },
    { question: "Can I control usage before scaling?", answer: "Yes. Plan limits, usage analytics, and one invoice keep spend bounded." },
  ],
};

export const SEEDANCE_CONFIG: ModelConfig = {
  slug: "seedance-api",
  modelIds: ["seedance-2-0", "seedance-2.0", "seedance"],
  displayName: "Seedance 2.0",
  modelId: "seedance-2-0",
  officialName: "fal.ai",
  officialPrice: "$0.07",
  flatkeyPrice: "$0.047",
  estFlatkey: "$0.23",
  estOfficial: "$0.35",
  examplePrompt:
    "A cinematic drone shot flying over a neon-lit Tokyo street at night, rain reflections, 5 seconds.",
  priceUnit: "/ second",
  rows: [
    { label: "Seedance video / sec", flatkey: "$0.047", official: "$0.07" },
    { label: "Image-to-video / sec", flatkey: "$0.053", official: "$0.08" },
    { label: "1080p / sec", flatkey: "$0.067", official: "$0.10" },
    { label: "Coverage", flatkey: "", value: "Seedance · Kling · Veo · Sora · GPT · Claude" },
  ],
  seo: {
    title: "Seedance video API — cheaper than official, one API key",
    description: "Generate Seedance text/image-to-video through flatkey.ai at lower per-second cost, with one API key and unified billing.",
  },
  positioning: "Best for product videos, ad creative, and image-to-video production",
  useCases: ["UGC ad clips", "Product motion", "Social video variants"],
  faq: [
    {
      question: "Does this use the same model id in my SDK?",
      answer: "Yes. Keep your SDK and switch base_url plus api_key.",
    },
    {
      question: "Can I control usage before scaling?",
      answer: "Yes. Plan limits, usage analytics, and one invoice keep spend bounded.",
    },
  ],
};

export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  [CLAUDE_CONFIG.slug]: CLAUDE_CONFIG,
  [DEEPSEEK_CONFIG.slug]: DEEPSEEK_CONFIG,
  [GEMINI_CONFIG.slug]: GEMINI_CONFIG,
  [GLM_API_CONFIG.slug]: GLM_API_CONFIG,
  [GPT_CONFIG.slug]: GPT_CONFIG,
  [QWEN_CONFIG.slug]: QWEN_CONFIG,
  [SEEDANCE_CONFIG.slug]: SEEDANCE_CONFIG,
};

export type ModelLandingKey =
  | "↓ Go $10 · Pro $30 · Max $100 per month — usage worth up to 4.5× the price"
  | "▶ Sign in to run"
  | "(flatkey · official ≈ {{price}})"
  | "{{model}} · OpenAI-compatible · one key, all models"
  | "* Illustrative pricing — see flatkey pricing page"
  | "/ million output tokens"
  | "/ second"
  | "# Your existing OpenAI code:"
  | "up to 50% off"
  | "covers every model"
  | "Est. this run"
  | "One subscription"
  | "Google / GitHub one-click · no credit card to start"
  | "migrate.py — change one line"
  | "Text, image and video in one plan · overage billed as you go · cancel anytime"
  | "Playground (edit before sign-up)"
  | "Pricing vs official"
  | "Same {{official}} upstream, same quality — plans from $10/month include every frontier model, with monthly usage worth up to 4.5× the price. Change one line of base_url and your existing OpenAI SDK just works. Try it below, sign in when you are ready."
  | "See plans →"
  | "Starter / individual"
  | "Team / high-volume"
  | "The same {{model}},"
  | "You pay"
  | "per month on the Go plan"
  | "You get"
  | "of monthly model usage — 4.5× the price"
  | "from $10/month"
  | "Pro — $30/mo, up to $90 usage"
  | "Most popular"
  | "Go — $10/mo, up to $45 usage"
  | "Max — $100/mo, up to $300 usage"
  | "Opus 4 output"
  | "Sonnet 4 output"
  | "Haiku output"
  | "GPT-5 output"
  | "GPT-5 mini output"
  | "GPT-5 input"
  | "Gemini 2.5 Pro output"
  | "Gemini 2.5 Flash output"
  | "Gemini 2.5 Pro input"
  | "Seedance video / sec"
  | "Image-to-video / sec"
  | "1080p / sec"
  | "Cache reads"
  | "Coverage"
  | "AI app backends"
  | "Agent workflows"
  | "Batch content generation"
  | "Best for general AI apps, agents, search, and high-volume API workloads"
  | "Best for long-context reasoning, coding agents, and production assistants"
  | "Best for product videos, ad creative, and image-to-video production"
  | "Can I control usage before scaling?"
  | "Coding agents"
  | "Does this use the same model id in my SDK?"
  | "Live flatkey pricing"
  | "Live model data from pricing API"
  | "Long document analysis"
  | "Matched live models"
  | "Product motion"
  | "Social video variants"
  | "Support automation"
  | "UGC ad clips"
  | "Yes. Keep your SDK and switch base_url plus api_key."
  | "Yes. Plan limits, usage analytics, and one invoice keep spend bounded."
  | "50% off";

export function getModelLandingConfig(slug: string): ModelConfig | null {
  return MODEL_CONFIGS[slug] ?? null;
}

export function getModelLandingConfigForModel(modelId: string): ModelConfig | null {
  const normalized = normalizeModelId(modelId);
  return getModelLandingConfigs().find((config) =>
    config.modelIds.some((configuredId) => matchesModelId(normalized, configuredId))
  ) ?? null;
}

export function getModelLandingConfigs(): ModelConfig[] {
  return Object.values(MODEL_CONFIGS);
}

export function getModelLandingPathnames(): string[] {
  return getModelLandingConfigs().map((config) => `/models/${config.slug}`);
}

export function resolveModelLandingModels(config: ModelConfig, models: PricingModel[]): PricingModel[] {
  return models.filter((model) => {
    const normalized = normalizeModelId(model.model_name);
    return config.modelIds.some((configuredId) => matchesModelId(normalized, configuredId));
  });
}

export function normalizeModelId(modelId: string): string {
  return modelId.trim().toLowerCase().replace(/[_.\s]+/g, "-");
}

function matchesModelId(normalizedModelId: string, configuredId: string): boolean {
  const normalizedConfiguredId = normalizeModelId(configuredId);
  return (
    normalizedModelId === normalizedConfiguredId ||
    normalizedModelId.startsWith(`${normalizedConfiguredId}-`)
  );
}

const en: Record<ModelLandingKey, string> = {
  "You pay": "You pay",
  "per month on the Go plan": "per month on the Go plan",
  "You get": "You get",
  "of monthly model usage — 4.5× the price": "of monthly model usage — 4.5× the price",
    "from $10/month": "from $10/month",
    "Pro — $30/mo, up to $90 usage": "Pro — $30/mo, up to $90 usage",
    "Most popular": "Most popular",
  "↓ Go $10 · Pro $30 · Max $100 per month — usage worth up to 4.5× the price": "↓ Go $10 · Pro $30 · Max $100 per month — usage worth up to 4.5× the price",
  "▶ Sign in to run": "▶ Sign in to run",
  "(flatkey · official ≈ {{price}})": "(flatkey · official ≈ {{price}})",
  "{{model}} · OpenAI-compatible · one key, all models": "{{model}} · OpenAI-compatible · one key, all models",
  "* Illustrative pricing — see flatkey pricing page": "* Illustrative pricing — see flatkey pricing page",
  "/ million output tokens": "/ million output tokens",
  "/ second": "/ second",
  "# Your existing OpenAI code:": "# Your existing OpenAI code:",
  "up to 50% off": "up to 50% off",
  "covers every model": "covers every model",
  "Est. this run": "Est. this run",
  "One subscription": "One subscription",
  "Google / GitHub one-click · no credit card to start": "Google / GitHub one-click · no credit card to start",
  "migrate.py — change one line": "migrate.py — change one line",
  "Text, image and video in one plan · overage billed as you go · cancel anytime": "Text, image and video in one plan · overage billed as you go · cancel anytime",
  "Playground (edit before sign-up)": "Playground (edit before sign-up)",
  "Pricing vs official": "Pricing vs official",
  "Same {{official}} upstream, same quality — plans from $10/month include every frontier model, with monthly usage worth up to 4.5× the price. Change one line of base_url and your existing OpenAI SDK just works. Try it below, sign in when you are ready.": "Same {{official}} upstream, same quality — plans from $10/month include every frontier model, with monthly usage worth up to 4.5× the price. Change one line of base_url and your existing OpenAI SDK just works. Try it below, sign in when you are ready.",
  "See plans →": "See plans →",
  "Starter / individual": "Starter / individual",
  "Team / high-volume": "Team / high-volume",
  "The same {{model}},": "The same {{model}},",
  "Go — $10/mo, up to $45 usage": "Go — $10/mo, up to $45 usage",
  "Max — $100/mo, up to $300 usage": "Max — $100/mo, up to $300 usage",
  "Opus 4 output": "Opus 4 output",
  "Sonnet 4 output": "Sonnet 4 output",
  "Haiku output": "Haiku output",
  "GPT-5 output": "GPT-5 output",
  "GPT-5 mini output": "GPT-5 mini output",
  "GPT-5 input": "GPT-5 input",
  "Gemini 2.5 Pro output": "Gemini 2.5 Pro output",
  "Gemini 2.5 Flash output": "Gemini 2.5 Flash output",
  "Gemini 2.5 Pro input": "Gemini 2.5 Pro input",
  "Seedance video / sec": "Seedance video / sec",
  "Image-to-video / sec": "Image-to-video / sec",
  "1080p / sec": "1080p / sec",
  "Cache reads": "Cache reads",
  Coverage: "Coverage",
  "AI app backends": "AI app backends",
  "Agent workflows": "Agent workflows",
  "Batch content generation": "Batch content generation",
  "Best for general AI apps, agents, search, and high-volume API workloads": "Best for general AI apps, agents, search, and high-volume API workloads",
  "Best for long-context reasoning, coding agents, and production assistants": "Best for long-context reasoning, coding agents, and production assistants",
  "Best for product videos, ad creative, and image-to-video production": "Best for product videos, ad creative, and image-to-video production",
  "Can I control usage before scaling?": "Can I control usage before scaling?",
  "Coding agents": "Coding agents",
  "Does this use the same model id in my SDK?": "Does this use the same model id in my SDK?",
  "Live flatkey pricing": "Live flatkey pricing",
  "Live model data from pricing API": "Live model data from pricing API",
  "Long document analysis": "Long document analysis",
  "Matched live models": "Matched live models",
  "Product motion": "Product motion",
  "Social video variants": "Social video variants",
  "Support automation": "Support automation",
  "UGC ad clips": "UGC ad clips",
  "Yes. Keep your SDK and switch base_url plus api_key.": "Yes. Keep your SDK and switch base_url plus api_key.",
  "Yes. Plan limits, usage analytics, and one invoice keep spend bounded.": "Yes. Plan limits, usage analytics, and one invoice keep spend bounded.",
  "50% off": "50% off",
};

// Non-English dictionaries may lag behind the union: modelLandingCopy falls
// back to the English entry (then the key itself), so new keys only require
// an English translation. `id` falls back to English via withIdFallback.
const translations: Record<Locale, Partial<Record<ModelLandingKey, string>>> = withIdFallback<
  Partial<Record<ModelLandingKey, string>>
>({
  en,
  zh: {
    "You pay": "你只付",
    "per month on the Go plan": "每月 · Go 套餐",
    "You get": "你获得",
    "of monthly model usage — 4.5× the price": "每月模型可用量 —— 套餐价的 4.5 倍",
    "from $10/month": "只需 $10/月起",
    "Pro — $30/mo, up to $90 usage": "Pro —— $30/月，可用 $90",
    "Most popular": "最受欢迎",
    "↓ Go $10 · Pro $30 · Max $100 per month — usage worth up to 4.5× the price": "↓ Go $10 · Pro $30 · Max $100 每月 —— 可用量最高达套餐价 4.5 倍",
    "▶ Sign in to run": "▶ 登录即可运行",
    "(flatkey · official ≈ {{price}})": "(flatkey · 官方 ≈ {{price}})",
    "{{model}} · OpenAI-compatible · one key, all models": "{{model}} · 兼容 OpenAI · 一个密钥，全部模型",
    "* Illustrative pricing — see flatkey pricing page": "* 示例价格 — 详见 flatkey 定价页",
    "/ million output tokens": "/ 百万输出 token",
    "/ second": "/ 秒",
    "# Your existing OpenAI code:": "# 你现有的 OpenAI 代码：",
    "up to 50% off": "最低 5 折",
    "covers every model": "覆盖全部模型",
    "Est. this run": "本次预估",
    "One subscription": "一份订阅",
    "Google / GitHub one-click · no credit card to start": "Google / GitHub 一键登录 · 无需信用卡即可开始",
    "migrate.py — change one line": "migrate.py — 改一行即可",
    "Text, image and video in one plan · overage billed as you go · cancel anytime": "文本·图像·视频一个套餐 · 超量按量计费 · 随时取消",
    "Playground (edit before sign-up)": "Playground（注册前可编辑）",
    "Pricing vs official": "与官方价格对比",
    "Same {{official}} upstream, same quality — plans from $10/month include every frontier model, with monthly usage worth up to 4.5× the price. Change one line of base_url and your existing OpenAI SDK just works. Try it below, sign in when you are ready.": "同款 {{official}} 上游，同等质量 —— $10/月起的套餐包含全部前沿模型，每月可用量最高达套餐价的 4.5 倍。只改一行 base_url，现有 OpenAI SDK 直接可用。先在下方试用，准备好再登录。",
    "See plans →": "查看套餐 →",
    "Starter / individual": "入门 / 个人",
    "Team / high-volume": "团队 / 大用量",
    "The same {{model}},": "同样的 {{model}}，",
    "Go — $10/mo, up to $45 usage": "Go —— $10/月，可用 $45",
    "Max — $100/mo, up to $300 usage": "Max —— $100/月，可用 $300",
    "Opus 4 output": "Opus 4 输出",
    "Sonnet 4 output": "Sonnet 4 输出",
    "Haiku output": "Haiku 输出",
    "GPT-5 output": "GPT-5 输出",
    "GPT-5 mini output": "GPT-5 mini 输出",
    "GPT-5 input": "GPT-5 输入",
    "Seedance video / sec": "Seedance 视频/秒",
    "Image-to-video / sec": "图生视频/秒",
    "1080p / sec": "1080p/秒",
    "Cache reads": "缓存读取",
    Coverage: "覆盖范围",
    "AI app backends": "AI 应用后端",
    "Agent workflows": "Agent 工作流",
    "Batch content generation": "批量内容生成",
    "Best for general AI apps, agents, search, and high-volume API workloads": "适合通用 AI 应用、Agent、搜索和高用量 API 场景",
    "Best for long-context reasoning, coding agents, and production assistants": "适合长上下文推理、编程 Agent 和生产级助手",
    "Best for product videos, ad creative, and image-to-video production": "适合产品视频、广告创意和图生视频生产",
    "Can I control usage before scaling?": "扩量前可以控制用量吗？",
    "Coding agents": "编程 Agent",
    "Does this use the same model id in my SDK?": "我的 SDK 里还能用同一个模型 ID 吗？",
    "Live flatkey pricing": "flatkey 实时价格",
    "Live model data from pricing API": "来自定价 API 的实时模型数据",
    "Long document analysis": "长文档分析",
    "Matched live models": "匹配到的实时模型",
    "Product motion": "产品动态视频",
    "Social video variants": "社媒视频变体",
    "Support automation": "客服自动化",
    "UGC ad clips": "UGC 广告短片",
    "Yes. Keep your SDK and switch base_url plus api_key.": "可以。保留现有 SDK，只切换 base_url 和 api_key。",
    "Yes. Plan limits, usage analytics, and one invoice keep spend bounded.": "可以。套餐上限、用量分析和统一账单让支出可控。",
    "50% off": "5 折",
  },
  es: {
    "You pay": "Pagas",
    "per month on the Go plan": "al mes en el plan Go",
    "You get": "Recibes",
    "of monthly model usage — 4.5× the price": "de uso mensual de modelos — 4.5× el precio",
    "from $10/month": "desde $10/mes",
    "Pro — $30/mo, up to $90 usage": "Pro — $30/mes, hasta $90 de uso",
    "Most popular": "Más popular",
    "↓ Go $10 · Pro $30 · Max $100 per month — usage worth up to 4.5× the price": "↓ Go $10 · Pro $30 · Max $100 al mes — uso de hasta 4.5× el precio",
    "▶ Sign in to run": "▶ Inicia sesión para ejecutar",
    "(flatkey · official ≈ {{price}})": "(flatkey · oficial ≈ {{price}})",
    "{{model}} · OpenAI-compatible · one key, all models": "{{model}} · compatible con OpenAI · una clave, todos los modelos",
    "* Illustrative pricing — see flatkey pricing page": "* Precios ilustrativos — consulta la página de precios de flatkey",
    "/ million output tokens": "/ millón de tokens de salida",
    "/ second": "/ segundo",
    "# Your existing OpenAI code:": "# Tu código OpenAI actual:",
    "up to 50% off": "hasta 50% menos",
    "covers every model": "cubre todos los modelos",
    "Est. this run": "Est. esta ejecución",
    "One subscription": "Una suscripción",
    "Google / GitHub one-click · no credit card to start": "Google / GitHub con un clic · sin tarjeta para empezar",
    "migrate.py — change one line": "migrate.py — cambia una línea",
    "Text, image and video in one plan · overage billed as you go · cancel anytime": "Texto, imagen y vídeo en un plan · el exceso se cobra por uso · cancela cuando quieras",
    "Playground (edit before sign-up)": "Playground (edita antes de registrarte)",
    "Pricing vs official": "Precios vs oficial",
    "Same {{official}} upstream, same quality — plans from $10/month include every frontier model, with monthly usage worth up to 4.5× the price. Change one line of base_url and your existing OpenAI SDK just works. Try it below, sign in when you are ready.": "Mismo upstream de {{official}}, misma calidad — los planes desde $10/mes incluyen todos los modelos frontera, con un uso mensual de hasta 4.5× lo que pagas. Cambia una línea de base_url y tu SDK de OpenAI existente simplemente funciona. Pruébalo abajo e inicia sesión cuando estés listo.",
    "See plans →": "Ver planes →",
    "Starter / individual": "Inicial / individual",
    "Team / high-volume": "Equipo / alto volumen",
    "The same {{model}},": "El mismo {{model}},",
    "Go — $10/mo, up to $45 usage": "Go — $10/mes, hasta $45 de uso",
    "Max — $100/mo, up to $300 usage": "Max — $100/mes, hasta $300 de uso",
    "Opus 4 output": "Salida de Opus 4",
    "Sonnet 4 output": "Salida de Sonnet 4",
    "Haiku output": "Salida de Haiku",
    "GPT-5 output": "Salida de GPT-5",
    "GPT-5 mini output": "Salida de GPT-5 mini",
    "GPT-5 input": "Entrada de GPT-5",
    "Seedance video / sec": "Vídeo Seedance/seg",
    "Image-to-video / sec": "Imagen a vídeo/seg",
    "1080p / sec": "1080p/seg",
    "Cache reads": "Lecturas de caché",
    Coverage: "Cobertura",
    "AI app backends": "Backends de apps de IA",
    "Agent workflows": "Flujos de agentes",
    "Batch content generation": "Generación de contenido por lotes",
    "Best for general AI apps, agents, search, and high-volume API workloads": "Ideal para apps de IA generales, agentes, búsqueda y cargas API de alto volumen",
    "Best for long-context reasoning, coding agents, and production assistants": "Ideal para razonamiento de contexto largo, agentes de código y asistentes en producción",
    "Best for product videos, ad creative, and image-to-video production": "Ideal para videos de producto, creatividades publicitarias y producción imagen-a-video",
    "Can I control usage before scaling?": "¿Puedo controlar el uso antes de escalar?",
    "Coding agents": "Agentes de código",
    "Does this use the same model id in my SDK?": "¿Uso el mismo id de modelo en mi SDK?",
    "Live flatkey pricing": "Precio en vivo de flatkey",
    "Live model data from pricing API": "Datos del modelo en vivo desde la API de precios",
    "Long document analysis": "Análisis de documentos largos",
    "Matched live models": "Modelos en vivo coincidentes",
    "Product motion": "Movimiento de producto",
    "Social video variants": "Variantes de video social",
    "Support automation": "Automatización de soporte",
    "UGC ad clips": "Clips publicitarios UGC",
    "Yes. Keep your SDK and switch base_url plus api_key.": "Sí. Mantén tu SDK y cambia base_url más api_key.",
    "Yes. Plan limits, usage analytics, and one invoice keep spend bounded.": "Sí. Los límites del plan, la analítica de uso y una única factura mantienen el gasto acotado.",
    "50% off": "50% de descuento",
  },
  fr: {
    "You pay": "Vous payez",
    "per month on the Go plan": "par mois avec le plan Go",
    "You get": "Vous recevez",
    "of monthly model usage — 4.5× the price": "d'usage mensuel des modèles — 4,5× le prix",
    "from $10/month": "dès $10/mois",
    "Pro — $30/mo, up to $90 usage": "Pro — $30/mois, jusqu'à $90 d'usage",
    "Most popular": "Le plus populaire",
    "↓ Go $10 · Pro $30 · Max $100 per month — usage worth up to 4.5× the price": "↓ Go $10 · Pro $30 · Max $100 par mois — usage jusqu'à 4,5× le prix",
    "▶ Sign in to run": "▶ Connectez-vous pour exécuter",
    "(flatkey · official ≈ {{price}})": "(flatkey · officiel ≈ {{price}})",
    "{{model}} · OpenAI-compatible · one key, all models": "{{model}} · compatible OpenAI · une clé, tous les modèles",
    "* Illustrative pricing — see flatkey pricing page": "* Tarifs indicatifs — voir la page tarifs de flatkey",
    "/ million output tokens": "/ million de tokens de sortie",
    "/ second": "/ seconde",
    "# Your existing OpenAI code:": "# Votre code OpenAI actuel :",
    "up to 50% off": "jusqu'à -50 %",
    "covers every model": "couvre tous les modèles",
    "Est. this run": "Est. pour cette exécution",
    "One subscription": "Un seul abonnement",
    "Google / GitHub one-click · no credit card to start": "Google / GitHub en un clic · sans carte bancaire pour commencer",
    "migrate.py — change one line": "migrate.py — changez une ligne",
    "Text, image and video in one plan · overage billed as you go · cancel anytime": "Texte, image et vidéo dans un plan · dépassement facturé à l'usage · annulable à tout moment",
    "Playground (edit before sign-up)": "Playground (modifiez avant l'inscription)",
    "Pricing vs official": "Tarifs vs officiel",
    "Same {{official}} upstream, same quality — plans from $10/month include every frontier model, with monthly usage worth up to 4.5× the price. Change one line of base_url and your existing OpenAI SDK just works. Try it below, sign in when you are ready.": "Même upstream {{official}}, même qualité — les plans dès $10/mois incluent tous les modèles frontière, avec un usage mensuel valant jusqu'à 4,5× le prix. Changez une ligne de base_url et votre SDK OpenAI existant fonctionne tel quel. Essayez ci-dessous, connectez-vous quand vous êtes prêt.",
    "See plans →": "Voir les plans →",
    "Starter / individual": "Débutant / individuel",
    "Team / high-volume": "Équipe / gros volume",
    "The same {{model}},": "Le même {{model}},",
    "Go — $10/mo, up to $45 usage": "Go — $10/mois, jusqu'à $45 d'usage",
    "Max — $100/mo, up to $300 usage": "Max — $100/mois, jusqu'à $300 d'usage",
    "Opus 4 output": "Sortie Opus 4",
    "Sonnet 4 output": "Sortie Sonnet 4",
    "Haiku output": "Sortie Haiku",
    "GPT-5 output": "Sortie GPT-5",
    "GPT-5 mini output": "Sortie GPT-5 mini",
    "GPT-5 input": "Entrée GPT-5",
    "Seedance video / sec": "Vidéo Seedance/s",
    "Image-to-video / sec": "Image vers vidéo/s",
    "1080p / sec": "1080p/s",
    "Cache reads": "Lectures de cache",
    Coverage: "Couverture",
    "AI app backends": "Backends d'apps IA",
    "Agent workflows": "Workflows d'agents",
    "Batch content generation": "Génération de contenu par lot",
    "Best for general AI apps, agents, search, and high-volume API workloads": "Idéal pour apps IA généralistes, agents, recherche et charges API à fort volume",
    "Best for long-context reasoning, coding agents, and production assistants": "Idéal pour raisonnement long contexte, agents de code et assistants en production",
    "Best for product videos, ad creative, and image-to-video production": "Idéal pour vidéos produit, créations publicitaires et production image-vers-vidéo",
    "Can I control usage before scaling?": "Puis-je contrôler l'usage avant de passer à l'échelle ?",
    "Coding agents": "Agents de code",
    "Does this use the same model id in my SDK?": "Puis-je garder le même id de modèle dans mon SDK ?",
    "Live flatkey pricing": "Tarifs flatkey en direct",
    "Live model data from pricing API": "Données modèle en direct depuis l'API tarifs",
    "Long document analysis": "Analyse de longs documents",
    "Matched live models": "Modèles en direct correspondants",
    "Product motion": "Animation produit",
    "Social video variants": "Variantes vidéo sociales",
    "Support automation": "Automatisation du support",
    "UGC ad clips": "Clips publicitaires UGC",
    "Yes. Keep your SDK and switch base_url plus api_key.": "Oui. Gardez votre SDK et changez base_url ainsi que api_key.",
    "Yes. Plan limits, usage analytics, and one invoice keep spend bounded.": "Oui. Les limites du plan, l'analyse d'usage et une facture unique gardent les dépenses maîtrisées.",
    "50% off": "50% de réduction",
  },
  pt: {
    "You pay": "Você paga",
    "per month on the Go plan": "por mês no plano Go",
    "You get": "Você recebe",
    "of monthly model usage — 4.5× the price": "de uso mensal de modelos — 4,5× o preço",
    "from $10/month": "a partir de $10/mês",
    "Pro — $30/mo, up to $90 usage": "Pro — $30/mês, até $90 de uso",
    "Most popular": "Mais popular",
    "↓ Go $10 · Pro $30 · Max $100 per month — usage worth up to 4.5× the price": "↓ Go $10 · Pro $30 · Max $100 por mês — uso de até 4,5× o preço",
    "▶ Sign in to run": "▶ Entrar para executar",
    "(flatkey · official ≈ {{price}})": "(flatkey · oficial ≈ {{price}})",
    "{{model}} · OpenAI-compatible · one key, all models": "{{model}} · compatível com OpenAI · uma chave, todos os modelos",
    "* Illustrative pricing — see flatkey pricing page": "* Preços ilustrativos — veja a página de preços do flatkey",
    "/ million output tokens": "/ milhão de tokens de saída",
    "/ second": "/ segundo",
    "# Your existing OpenAI code:": "# Seu código OpenAI atual:",
    "up to 50% off": "até 50% de desconto",
    "covers every model": "cobre todos os modelos",
    "Est. this run": "Est. desta execução",
    "One subscription": "Uma assinatura",
    "Google / GitHub one-click · no credit card to start": "Google / GitHub com um clique · sem cartão de crédito para começar",
    "migrate.py — change one line": "migrate.py — mude uma linha",
    "Text, image and video in one plan · overage billed as you go · cancel anytime": "Texto, imagem e vídeo em um plano · excedente cobrado por uso · cancele quando quiser",
    "Playground (edit before sign-up)": "Playground (edite antes de cadastrar)",
    "Pricing vs official": "Preços vs oficial",
    "Same {{official}} upstream, same quality — plans from $10/month include every frontier model, with monthly usage worth up to 4.5× the price. Change one line of base_url and your existing OpenAI SDK just works. Try it below, sign in when you are ready.": "Mesmo upstream da {{official}}, mesma qualidade — planos a partir de $10/mês incluem todos os modelos de fronteira, com uso mensal de até 4,5× o preço. Mude uma linha de base_url e seu SDK OpenAI existente simplesmente funciona. Teste abaixo e entre quando estiver pronto.",
    "See plans →": "Ver planos →",
    "Starter / individual": "Inicial / individual",
    "Team / high-volume": "Equipe / alto volume",
    "The same {{model}},": "O mesmo {{model}},",
    "Go — $10/mo, up to $45 usage": "Go — $10/mês, até $45 de uso",
    "Max — $100/mo, up to $300 usage": "Max — $100/mês, até $300 de uso",
    "Opus 4 output": "Saída do Opus 4",
    "Sonnet 4 output": "Saída do Sonnet 4",
    "Haiku output": "Saída do Haiku",
    "GPT-5 output": "Saída do GPT-5",
    "GPT-5 mini output": "Saída do GPT-5 mini",
    "GPT-5 input": "Entrada do GPT-5",
    "Seedance video / sec": "Vídeo Seedance/seg",
    "Image-to-video / sec": "Imagem-para-vídeo/seg",
    "1080p / sec": "1080p/seg",
    "Cache reads": "Leituras de cache",
    Coverage: "Cobertura",
    "AI app backends": "Backends de apps de IA",
    "Agent workflows": "Fluxos de agentes",
    "Batch content generation": "Geração de conteúdo em lote",
    "Best for general AI apps, agents, search, and high-volume API workloads": "Ideal para apps de IA, agentes, busca e cargas API de alto volume",
    "Best for long-context reasoning, coding agents, and production assistants": "Ideal para raciocínio de contexto longo, agentes de código e assistentes em produção",
    "Best for product videos, ad creative, and image-to-video production": "Ideal para vídeos de produto, criativos de anúncio e produção imagem-para-vídeo",
    "Can I control usage before scaling?": "Posso controlar o uso antes de escalar?",
    "Coding agents": "Agentes de código",
    "Does this use the same model id in my SDK?": "Uso o mesmo id de modelo no meu SDK?",
    "Live flatkey pricing": "Preço em tempo real da flatkey",
    "Live model data from pricing API": "Dados do modelo em tempo real da API de preços",
    "Long document analysis": "Análise de documentos longos",
    "Matched live models": "Modelos em tempo real correspondentes",
    "Product motion": "Movimento de produto",
    "Social video variants": "Variações de vídeo social",
    "Support automation": "Automação de suporte",
    "UGC ad clips": "Clipes de anúncio UGC",
    "Yes. Keep your SDK and switch base_url plus api_key.": "Sim. Mantenha seu SDK e troque base_url e api_key.",
    "Yes. Plan limits, usage analytics, and one invoice keep spend bounded.": "Sim. Limites do plano, análise de uso e uma única fatura mantêm o gasto sob controle.",
    "50% off": "50% de desconto",
  },
  ru: {
    "You pay": "Вы платите",
    "per month on the Go plan": "в месяц на плане Go",
    "You get": "Вы получаете",
    "of monthly model usage — 4.5× the price": "месячного использования моделей — 4,5× цены",
    "from $10/month": "от $10/мес",
    "Pro — $30/mo, up to $90 usage": "Pro — $30/мес, до $90 использования",
    "Most popular": "Самый популярный",
    "↓ Go $10 · Pro $30 · Max $100 per month — usage worth up to 4.5× the price": "↓ Go $10 · Pro $30 · Max $100 в месяц — использование до 4,5× цены",
    "▶ Sign in to run": "▶ Войдите, чтобы запустить",
    "(flatkey · official ≈ {{price}})": "(flatkey · официальный ≈ {{price}})",
    "{{model}} · OpenAI-compatible · one key, all models": "{{model}} · совместим с OpenAI · один ключ, все модели",
    "* Illustrative pricing — see flatkey pricing page": "* Ориентировочные цены — см. страницу тарифов flatkey",
    "/ million output tokens": "/ млн выходных токенов",
    "/ second": "/ секунду",
    "# Your existing OpenAI code:": "# Ваш текущий код OpenAI:",
    "up to 50% off": "до 50% дешевле",
    "covers every model": "покрывает все модели",
    "Est. this run": "Оценка за этот запуск",
    "One subscription": "Одна подписка",
    "Google / GitHub one-click · no credit card to start": "Google / GitHub в один клик · без карты для старта",
    "migrate.py — change one line": "migrate.py — измените одну строку",
    "Text, image and video in one plan · overage billed as you go · cancel anytime": "Текст, изображения и видео в одном плане · сверх лимита — по факту · отмена в любой момент",
    "Playground (edit before sign-up)": "Playground (правьте до регистрации)",
    "Pricing vs official": "Цены против официальных",
    "Same {{official}} upstream, same quality — plans from $10/month include every frontier model, with monthly usage worth up to 4.5× the price. Change one line of base_url and your existing OpenAI SDK just works. Try it below, sign in when you are ready.": "Тот же upstream {{official}}, то же качество — планы от $10/мес включают все передовые модели, с месячным использованием до 4,5× цены. Измените одну строку base_url — и ваш существующий OpenAI SDK просто работает. Попробуйте ниже, войдите, когда будете готовы.",
    "See plans →": "Смотреть планы →",
    "Starter / individual": "Начальный / индивидуальный",
    "Team / high-volume": "Команда / большой объём",
    "The same {{model}},": "Та же {{model}},",
    "Go — $10/mo, up to $45 usage": "Go — $10/мес, до $45 использования",
    "Max — $100/mo, up to $300 usage": "Max — $100/мес, до $300 использования",
    "Opus 4 output": "Вывод Opus 4",
    "Sonnet 4 output": "Вывод Sonnet 4",
    "Haiku output": "Вывод Haiku",
    "GPT-5 output": "Вывод GPT-5",
    "GPT-5 mini output": "Вывод GPT-5 mini",
    "GPT-5 input": "Ввод GPT-5",
    "Seedance video / sec": "Видео Seedance/сек",
    "Image-to-video / sec": "Изображение в видео/сек",
    "1080p / sec": "1080p/сек",
    "Cache reads": "Чтения из кэша",
    Coverage: "Покрытие",
    "AI app backends": "Бэкенды AI-приложений",
    "Agent workflows": "Agent workflow",
    "Batch content generation": "Пакетная генерация контента",
    "Best for general AI apps, agents, search, and high-volume API workloads": "Подходит для AI-приложений, агентов, поиска и больших API-нагрузок",
    "Best for long-context reasoning, coding agents, and production assistants": "Подходит для длинного контекста, кодовых агентов и production-ассистентов",
    "Best for product videos, ad creative, and image-to-video production": "Подходит для продуктовых видео, рекламы и image-to-video производства",
    "Can I control usage before scaling?": "Можно ли контролировать расход до масштабирования?",
    "Coding agents": "Кодовые агенты",
    "Does this use the same model id in my SDK?": "Можно ли использовать тот же model id в SDK?",
    "Live flatkey pricing": "Актуальные цены flatkey",
    "Live model data from pricing API": "Живые данные модели из pricing API",
    "Long document analysis": "Анализ длинных документов",
    "Matched live models": "Найденные живые модели",
    "Product motion": "Product motion",
    "Social video variants": "Варианты видео для соцсетей",
    "Support automation": "Автоматизация поддержки",
    "UGC ad clips": "UGC рекламные клипы",
    "Yes. Keep your SDK and switch base_url plus api_key.": "Да. Оставьте SDK и смените base_url вместе с api_key.",
    "Yes. Plan limits, usage analytics, and one invoice keep spend bounded.": "Да. Лимиты плана, аналитика использования и один счёт держат расходы под контролем.",
    "50% off": "скидка 50%",
  },
  ja: {
    "You pay": "支払うのは",
    "per month on the Go plan": "／月（Go プラン）",
    "You get": "使えるのは",
    "of monthly model usage — 4.5× the price": "月間モデル利用枠——料金の 4.5 倍",
    "from $10/month": "月額 $10 から",
    "Pro — $30/mo, up to $90 usage": "Pro — $30/月、利用枠 $90",
    "Most popular": "一番人気",
    "↓ Go $10 · Pro $30 · Max $100 per month — usage worth up to 4.5× the price": "↓ Go $10 · Pro $30 · Max $100 /月——利用枠は料金の最大 4.5 倍",
    "▶ Sign in to run": "▶ サインインして実行",
    "(flatkey · official ≈ {{price}})": "(flatkey · 公式 ≈ {{price}})",
    "{{model}} · OpenAI-compatible · one key, all models": "{{model}} · OpenAI 互換 · 1つのキーで全モデル",
    "* Illustrative pricing — see flatkey pricing page": "* 参考価格 — flatkey の料金ページをご覧ください",
    "/ million output tokens": "/ 出力トークン100万あたり",
    "/ second": "/ 秒",
    "# Your existing OpenAI code:": "# 既存の OpenAI コード:",
    "up to 50% off": "最大 50% オフ",
    "covers every model": "全モデルをカバー",
    "Est. this run": "今回の概算",
    "One subscription": "1 つのサブスクで",
    "Google / GitHub one-click · no credit card to start": "Google / GitHub ワンクリック · クレジットカード不要で開始",
    "migrate.py — change one line": "migrate.py — 1行変更するだけ",
    "Text, image and video in one plan · overage billed as you go · cancel anytime": "テキスト・画像・動画を 1 プランで · 超過分は従量課金 · いつでも解約可",
    "Playground (edit before sign-up)": "プレイグラウンド（登録前に編集可）",
    "Pricing vs official": "公式との価格比較",
    "Same {{official}} upstream, same quality — plans from $10/month include every frontier model, with monthly usage worth up to 4.5× the price. Change one line of base_url and your existing OpenAI SDK just works. Try it below, sign in when you are ready.": "同じ {{official}} アップストリーム、同じ品質——月額 $10 からのプランで全フロンティアモデルが使え、月間利用枠は料金の最大 4.5 倍。base_url を 1 行変えるだけで、既存の OpenAI SDK がそのまま動きます。まず下で試して、準備ができたらログインを。",
    "See plans →": "プランを見る →",
    "Starter / individual": "スターター / 個人",
    "Team / high-volume": "チーム / 大量利用",
    "The same {{model}},": "同じ {{model}}、",
    "Go — $10/mo, up to $45 usage": "Go — $10/月、利用枠 $45",
    "Max — $100/mo, up to $300 usage": "Max — $100/月、利用枠 $300",
    "Opus 4 output": "Opus 4 出力",
    "Sonnet 4 output": "Sonnet 4 出力",
    "Haiku output": "Haiku 出力",
    "GPT-5 output": "GPT-5 出力",
    "GPT-5 mini output": "GPT-5 mini 出力",
    "GPT-5 input": "GPT-5 入力",
    "Seedance video / sec": "Seedance 動画/秒",
    "Image-to-video / sec": "画像から動画/秒",
    "1080p / sec": "1080p/秒",
    "Cache reads": "キャッシュ読み取り",
    Coverage: "対応モデル",
    "AI app backends": "AI アプリのバックエンド",
    "Agent workflows": "Agent ワークフロー",
    "Batch content generation": "一括コンテンツ生成",
    "Best for general AI apps, agents, search, and high-volume API workloads": "汎用 AI アプリ、Agent、検索、高負荷 API ワークロードに最適",
    "Best for long-context reasoning, coding agents, and production assistants": "長文脈推論、コーディング Agent、本番アシスタントに最適",
    "Best for product videos, ad creative, and image-to-video production": "商品動画、広告クリエイティブ、画像から動画制作に最適",
    "Can I control usage before scaling?": "拡張前に使用量を管理できますか？",
    "Coding agents": "コーディング Agent",
    "Does this use the same model id in my SDK?": "SDK で同じモデル ID を使えますか？",
    "Live flatkey pricing": "flatkey のライブ料金",
    "Live model data from pricing API": "料金 API からのライブモデルデータ",
    "Long document analysis": "長文書分析",
    "Matched live models": "一致したライブモデル",
    "Product motion": "商品モーション",
    "Social video variants": "SNS 動画バリエーション",
    "Support automation": "サポート自動化",
    "UGC ad clips": "UGC 広告クリップ",
    "Yes. Keep your SDK and switch base_url plus api_key.": "はい。SDK はそのまま、base_url と api_key だけ変更します。",
    "Yes. Plan limits, usage analytics, and one invoice keep spend bounded.": "はい。プラン上限・利用分析・一括請求で支出を抑えられます。",
    "50% off": "50% オフ",
  },
  vi: {
    "You pay": "Bạn trả",
    "per month on the Go plan": "mỗi tháng với gói Go",
    "You get": "Bạn nhận",
    "of monthly model usage — 4.5× the price": "mức dùng model hằng tháng — 4,5× giá",
    "from $10/month": "từ $10/tháng",
    "Pro — $30/mo, up to $90 usage": "Pro — $30/tháng, dùng tới $90",
    "Most popular": "Phổ biến nhất",
    "↓ Go $10 · Pro $30 · Max $100 per month — usage worth up to 4.5× the price": "↓ Go $10 · Pro $30 · Max $100 mỗi tháng — mức dùng tới 4,5× giá",
    "▶ Sign in to run": "▶ Đăng nhập để chạy",
    "(flatkey · official ≈ {{price}})": "(flatkey · chính thức ≈ {{price}})",
    "{{model}} · OpenAI-compatible · one key, all models": "{{model}} · tương thích OpenAI · một khóa, mọi mô hình",
    "* Illustrative pricing — see flatkey pricing page": "* Giá minh họa — xem trang giá của flatkey",
    "/ million output tokens": "/ triệu token đầu ra",
    "/ second": "/ giây",
    "# Your existing OpenAI code:": "# Mã OpenAI hiện có của bạn:",
    "up to 50% off": "rẻ hơn tới 50%",
    "covers every model": "bao trọn mọi model",
    "Est. this run": "Ước tính lần chạy này",
    "One subscription": "Một gói thuê bao",
    "Google / GitHub one-click · no credit card to start": "Google / GitHub một chạm · không cần thẻ tín dụng để bắt đầu",
    "migrate.py — change one line": "migrate.py — đổi một dòng",
    "Text, image and video in one plan · overage billed as you go · cancel anytime": "Văn bản, ảnh và video trong một gói · vượt hạn mức tính theo dùng · hủy bất cứ lúc nào",
    "Playground (edit before sign-up)": "Playground (chỉnh sửa trước khi đăng ký)",
    "Pricing vs official": "Giá so với chính thức",
    "Same {{official}} upstream, same quality — plans from $10/month include every frontier model, with monthly usage worth up to 4.5× the price. Change one line of base_url and your existing OpenAI SDK just works. Try it below, sign in when you are ready.": "Cùng upstream {{official}}, cùng chất lượng — các gói từ $10/tháng bao gồm mọi model tiên phong, với mức dùng hằng tháng lên tới 4,5× giá gói. Đổi một dòng base_url và SDK OpenAI hiện có của bạn chạy ngay. Thử bên dưới, đăng nhập khi sẵn sàng.",
    "See plans →": "Xem các gói →",
    "Starter / individual": "Khởi đầu / cá nhân",
    "Team / high-volume": "Nhóm / khối lượng lớn",
    "The same {{model}},": "Cùng {{model}},",
    "Go — $10/mo, up to $45 usage": "Go — $10/tháng, dùng tới $45",
    "Max — $100/mo, up to $300 usage": "Max — $100/tháng, dùng tới $300",
    "Opus 4 output": "Đầu ra Opus 4",
    "Sonnet 4 output": "Đầu ra Sonnet 4",
    "Haiku output": "Đầu ra Haiku",
    "GPT-5 output": "Đầu ra GPT-5",
    "GPT-5 mini output": "Đầu ra GPT-5 mini",
    "GPT-5 input": "Đầu vào GPT-5",
    "Seedance video / sec": "Video Seedance/giây",
    "Image-to-video / sec": "Ảnh thành video/giây",
    "1080p / sec": "1080p/giây",
    "Cache reads": "Đọc bộ nhớ đệm",
    Coverage: "Phạm vi hỗ trợ",
    "AI app backends": "Backend ứng dụng AI",
    "Agent workflows": "Quy trình agent",
    "Batch content generation": "Tạo nội dung hàng loạt",
    "Best for general AI apps, agents, search, and high-volume API workloads": "Phù hợp cho ứng dụng AI phổ thông, agent, tìm kiếm và tải API lớn",
    "Best for long-context reasoning, coding agents, and production assistants": "Phù hợp cho suy luận ngữ cảnh dài, agent lập trình và trợ lý production",
    "Best for product videos, ad creative, and image-to-video production": "Phù hợp cho video sản phẩm, quảng cáo và sản xuất ảnh-thành-video",
    "Can I control usage before scaling?": "Tôi có thể kiểm soát mức dùng trước khi mở rộng không?",
    "Coding agents": "Agent lập trình",
    "Does this use the same model id in my SDK?": "SDK của tôi có dùng cùng model id không?",
    "Live flatkey pricing": "Giá flatkey trực tiếp",
    "Live model data from pricing API": "Dữ liệu mô hình trực tiếp từ API giá",
    "Long document analysis": "Phân tích tài liệu dài",
    "Matched live models": "Mô hình trực tiếp đã khớp",
    "Product motion": "Chuyển động sản phẩm",
    "Social video variants": "Biến thể video mạng xã hội",
    "Support automation": "Tự động hóa hỗ trợ",
    "UGC ad clips": "Clip quảng cáo UGC",
    "Yes. Keep your SDK and switch base_url plus api_key.": "Có. Giữ SDK, chỉ đổi base_url và api_key.",
    "Yes. Plan limits, usage analytics, and one invoice keep spend bounded.": "Có. Hạn mức gói, phân tích mức dùng và một hóa đơn duy nhất giữ chi tiêu trong tầm kiểm soát.",
    "50% off": "giảm 50%",
  },
  de: {
    "You pay": "Sie zahlen",
    "per month on the Go plan": "pro Monat im Go-Plan",
    "You get": "Sie erhalten",
    "of monthly model usage — 4.5× the price": "monatliche Modellnutzung — das 4,5-Fache des Preises",
    "from $10/month": "ab $10/Monat",
    "Pro — $30/mo, up to $90 usage": "Pro — $30/Monat, bis zu $90 Nutzung",
    "Most popular": "Am beliebtesten",
    "↓ Go $10 · Pro $30 · Max $100 per month — usage worth up to 4.5× the price": "↓ Go $10 · Pro $30 · Max $100 pro Monat — Nutzung bis zum 4,5-Fachen des Preises",
    "▶ Sign in to run": "▶ Zum Ausführen anmelden",
    "(flatkey · official ≈ {{price}})": "(flatkey · offiziell ≈ {{price}})",
    "{{model}} · OpenAI-compatible · one key, all models": "{{model}} · OpenAI-kompatibel · ein Schlüssel, alle Modelle",
    "* Illustrative pricing — see flatkey pricing page": "* Beispielpreise — siehe flatkey-Preisseite",
    "/ million output tokens": "/ Million Output-Tokens",
    "/ second": "/ Sekunde",
    "# Your existing OpenAI code:": "# Dein vorhandener OpenAI-Code:",
    "up to 50% off": "bis zu 50% günstiger",
    "covers every model": "deckt alle Modelle ab",
    "Est. this run": "Schätzung für diesen Lauf",
    "One subscription": "Ein Abo",
    "Google / GitHub one-click · no credit card to start": "Google / GitHub mit einem Klick · keine Kreditkarte nötig zum Start",
    "migrate.py — change one line": "migrate.py — eine Zeile ändern",
    "Text, image and video in one plan · overage billed as you go · cancel anytime": "Text, Bild und Video in einem Plan · Mehrverbrauch nach Verbrauch · jederzeit kündbar",
    "Playground (edit before sign-up)": "Playground (vor der Anmeldung bearbeiten)",
    "Pricing vs official": "Preise im Vergleich zum offiziellen Anbieter",
    "Same {{official}} upstream, same quality — plans from $10/month include every frontier model, with monthly usage worth up to 4.5× the price. Change one line of base_url and your existing OpenAI SDK just works. Try it below, sign in when you are ready.": "Gleicher {{official}}-Upstream, gleiche Qualität — Pläne ab $10/Monat enthalten alle Frontier-Modelle, mit monatlichem Nutzungswert bis zum 4,5-Fachen des Preises. Ändern Sie eine Zeile base_url und Ihr bestehendes OpenAI SDK funktioniert einfach. Unten ausprobieren, anmelden, wenn Sie bereit sind.",
    "See plans →": "Pläne ansehen →",
    "Starter / individual": "Starter / Einzelperson",
    "Team / high-volume": "Team / hohes Volumen",
    "The same {{model}},": "Das gleiche {{model}},",
    "Go — $10/mo, up to $45 usage": "Go — $10/Monat, bis zu $45 Nutzung",
    "Max — $100/mo, up to $300 usage": "Max — $100/Monat, bis zu $300 Nutzung",
    "Opus 4 output": "Opus 4 Output",
    "Sonnet 4 output": "Sonnet 4 Output",
    "Haiku output": "Haiku Output",
    "GPT-5 output": "GPT-5 Output",
    "GPT-5 mini output": "GPT-5 mini Output",
    "GPT-5 input": "GPT-5 Input",
    "Seedance video / sec": "Seedance-Video/Sek.",
    "Image-to-video / sec": "Bild-zu-Video/Sek.",
    "1080p / sec": "1080p/Sek.",
    "Cache reads": "Cache-Lesevorgänge",
    Coverage: "Abdeckung",
    "AI app backends": "Backends für AI-Apps",
    "Agent workflows": "Agent-Workflows",
    "Batch content generation": "Batch-Content-Erstellung",
    "Best for general AI apps, agents, search, and high-volume API workloads": "Ideal für allgemeine AI-Apps, Agents, Suche und API-Workloads mit hohem Volumen",
    "Best for long-context reasoning, coding agents, and production assistants": "Ideal für Long-Context-Reasoning, Coding-Agents und Produktionsassistenten",
    "Best for product videos, ad creative, and image-to-video production": "Ideal für Produktvideos, Anzeigen-Creatives und Bild-zu-Video-Produktion",
    "Can I control usage before scaling?": "Kann ich die Nutzung vor dem Skalieren kontrollieren?",
    "Coding agents": "Coding-Agents",
    "Does this use the same model id in my SDK?": "Nutze ich dieselbe Modell-ID in meinem SDK?",
    "Live flatkey pricing": "Live-Preise von flatkey",
    "Live model data from pricing API": "Live-Modelldaten aus der Pricing API",
    "Long document analysis": "Analyse langer Dokumente",
    "Matched live models": "Passende Live-Modelle",
    "Product motion": "Produktbewegung",
    "Social video variants": "Varianten für Social Videos",
    "Support automation": "Support-Automatisierung",
    "UGC ad clips": "UGC-Anzeigenclips",
    "Yes. Keep your SDK and switch base_url plus api_key.": "Ja. Behalte dein SDK und ändere base_url plus api_key.",
    "Yes. Plan limits, usage analytics, and one invoice keep spend bounded.": "Ja. Planlimits, Nutzungsanalysen und eine Rechnung halten die Ausgaben im Rahmen.",
    "50% off": "50% Rabatt",
  },
});

export function modelLandingCopy(locale: Locale, key: ModelLandingKey, vars: Record<string, string> = {}) {
  let value = translations[locale][key] ?? translations.en[key] ?? key;
  for (const [name, replacement] of Object.entries(vars)) {
    value = value.replaceAll(`{{${name}}}`, replacement);
  }
  return value;
}
