import type { Locale } from "./locales";
import { withIdFallback } from "@/lib/locales";
import type { PricingModel } from "./pricing";

export type ModelPriceRow = {
  label: string;
  flatkey: string;
  official?: string;
  value?: string;
};

export type ModelGeneratorField = {
  name: string;
  label: string;
  type: "select" | "number" | "text" | "boolean";
  defaultValue: string | number | boolean;
  options?: string[];
  min?: number;
  max?: number;
  help?: string;
};

export type ModelGeneratorConfig = {
  kind: "image" | "video" | "audio";
  endpoint: string;
  storageKey: string;
  fields: ModelGeneratorField[];
};

export type ModelConfig = {
  slug: string;
  modelIds: string[];
  displayName: string;
  modelId: string;
  generator?: ModelGeneratorConfig;
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
  modelIds: ["gpt-5.5", "gpt-5", "gpt-5-mini", "gpt-4o", "gpt-4.1"],
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
  generator: {
    kind: "video",
    endpoint: "/v1/videos",
    storageKey: "flatkey:model-generator-draft:seedance-2-0",
    fields: [
      { name: "resolution", label: "Resolution", type: "select", defaultValue: "1080p", options: ["720p", "1080p"] },
      { name: "ratio", label: "Aspect ratio", type: "select", defaultValue: "16:9", options: ["16:9", "9:16", "1:1", "4:3", "3:4"] },
      { name: "duration", label: "Duration", type: "select", defaultValue: 5, options: ["5", "10"] },
      { name: "frames", label: "Frames", type: "number", defaultValue: 0, min: 0, max: 240, help: "Optional frame count override" },
      { name: "camera_fixed", label: "Camera fixed", type: "boolean", defaultValue: false },
      { name: "generate_audio", label: "Generate audio", type: "boolean", defaultValue: false },
      { name: "return_last_frame", label: "Return last frame", type: "boolean", defaultValue: false },
      { name: "seed", label: "Seed", type: "number", defaultValue: 0, min: 0, max: 2147483647, help: "0 means random" },
    ],
  },
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

export const GPT_IMAGE_2_CONFIG: ModelConfig = {
  slug: "gpt-image-2",
  modelIds: ["gpt-image-2"],
  displayName: "GPT-image-2",
  modelId: "gpt-image-2",
  generator: {
    kind: "image",
    endpoint: "/v1/images/generations",
    storageKey: "flatkey:model-generator-draft:gpt-image-2",
    fields: [
      { name: "n", label: "Images", type: "number", defaultValue: 1, min: 1, max: 10 },
      { name: "size", label: "Size", type: "select", defaultValue: "1024x1024", options: ["1024x1024", "1536x1024", "1024x1536", "auto"] },
      { name: "quality", label: "Quality", type: "select", defaultValue: "high", options: ["auto", "high", "medium", "low"] },
      { name: "output_format", label: "Output format", type: "select", defaultValue: "png", options: ["png", "jpeg", "webp"] },
      { name: "background", label: "Background", type: "select", defaultValue: "opaque", options: ["opaque", "auto"] },
      { name: "moderation", label: "Moderation", type: "select", defaultValue: "auto", options: ["auto", "low"] },
    ],
  },
  officialName: "OpenAI",
  officialPrice: "$0.06",
  flatkeyPrice: "$0.04",
  estFlatkey: "$0.04",
  estOfficial: "$0.06",
  examplePrompt:
    "A complex AI image generation mood wall photographed as one premium studio scene: a large violet-and-gold abstract floral artwork surrounded by pinned botanical sketches, macro insect study, translucent vellum flower sheets, black-and-white portrait, crystal minerals, perfume product render, architectural arch and staircase studies, film strips, fabric swatches, tape, brass pins, graphite notes, and warm spotlights on a charcoal wall.",
  priceUnit: "/ image",
  rows: [
    { label: "GPT-image-2 image", flatkey: "$0.04", official: "$0.06" },
    { label: "Square output", flatkey: "", value: "1024 × 1024" },
    { label: "Fast product mockups", flatkey: "", value: "image, ads, ecommerce" },
    { label: "Coverage", flatkey: "", value: "GPT-image-2 · Nano Banana Pro · Imagen · Qwen Image" },
  ],
  seo: {
    title: "GPT-image-2 image generator — configure prompts before signup",
    description:
      "Try a GPT-image-2 style image generator landing page, save your prompt settings locally, then continue to Flatkey signup or the console.",
  },
  positioning: "Best for product images, ad creatives, and ecommerce visual variants",
  useCases: ["Product mockups", "Ad creatives", "Ecommerce images"],
  faq: [
    {
      question: "Does this start a real generation?",
      answer: "The public page saves your draft settings first. Sign up or open the console to run the request with an API key.",
    },
    {
      question: "Where are my edited prompt settings stored?",
      answer: "They are stored in this browser's localStorage so the draft survives the signup handoff.",
    },
  ],
};

export const MINIMAX_H3_CONFIG: ModelConfig = {
  slug: "minimax-h3",
  modelIds: ["MiniMax-H3"],
  displayName: "MiniMax-H3",
  modelId: "MiniMax-H3",
  generator: {
    kind: "video",
    endpoint: "/v1/videos",
    storageKey: "flatkey:model-generator-draft:minimax-h3",
    fields: [
      { name: "resolution", label: "Resolution", type: "select", defaultValue: "768P", options: ["768P", "2K"] },
      { name: "duration", label: "Duration", type: "number", defaultValue: 6, min: 4, max: 15 },
      { name: "ratio", label: "Aspect ratio", type: "select", defaultValue: "16:9", options: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16", "adaptive"] },
      { name: "aigc_watermark", label: "AIGC watermark", type: "boolean", defaultValue: false },
    ],
  },
  officialName: "MiniMax",
  officialPrice: "$0.08",
  flatkeyPrice: "$0.053333",
  estFlatkey: "$0.32",
  estOfficial: "$0.48",
  examplePrompt:
    "A paper boat crosses a rain puddle at street level, cinematic macro shot, soft reflections, 6 seconds.",
  priceUnit: "/ second",
  rows: [
    { label: "MiniMax-H3 768P / sec", flatkey: "$0.053", official: "$0.08" },
    { label: "MiniMax-H3 2K / sec", flatkey: "$0.087", official: "$0.13" },
    { label: "Reference video input", flatkey: "", value: "same per-second rate" },
    { label: "Input image after free tier", flatkey: "$0.027", official: "$0.04" },
  ],
  seo: {
    title: "MiniMax-H3 video generator — configure prompts before signup",
    description:
      "Configure MiniMax-H3 video requests on flatkey.ai, save prompt settings locally, then continue to signup or the console.",
  },
  positioning: "Best for product videos, ad creative, and image-to-video production",
  useCases: ["UGC ad clips", "Product motion", "Social video variants"],
  faq: [
    {
      question: "Which MiniMax-H3 fields can I configure here?",
      answer: "Configure resolution, duration, ratio, and AIGC watermark before opening the console.",
    },
    {
      question: "Does this start a real generation?",
      answer: "The public page saves your draft settings first. Sign up or open the console to run the request with an API key.",
    },
  ],
};

export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  [CLAUDE_CONFIG.slug]: CLAUDE_CONFIG,
  [DEEPSEEK_CONFIG.slug]: DEEPSEEK_CONFIG,
  [GEMINI_CONFIG.slug]: GEMINI_CONFIG,
  [GPT_IMAGE_2_CONFIG.slug]: GPT_IMAGE_2_CONFIG,
  [GLM_API_CONFIG.slug]: GLM_API_CONFIG,
  [GPT_CONFIG.slug]: GPT_CONFIG,
  [MINIMAX_H3_CONFIG.slug]: MINIMAX_H3_CONFIG,
  [QWEN_CONFIG.slug]: QWEN_CONFIG,
  [SEEDANCE_CONFIG.slug]: SEEDANCE_CONFIG,
};

const GENERIC_MEDIA_PRICE_BY_KIND: Record<ModelGeneratorConfig["kind"], { priceUnit: ModelLandingKey; flatkey: string; official: string }> = {
  image: { priceUnit: "/ image", flatkey: "$0.04", official: "$0.06" },
  video: { priceUnit: "/ second", flatkey: "$0.047", official: "$0.07" },
  audio: { priceUnit: "/ request", flatkey: "$0.0048", official: "$0.009" },
};

const GENERIC_MEDIA_FIELDS: Record<ModelGeneratorConfig["kind"], ModelGeneratorField[]> = {
  image: [
    { name: "n", label: "Images", type: "number", defaultValue: 1, min: 1, max: 10 },
    { name: "size", label: "Size", type: "select", defaultValue: "1024x1024", options: ["1024x1024", "1536x1024", "1024x1536", "auto"] },
    { name: "quality", label: "Quality", type: "select", defaultValue: "high", options: ["auto", "high", "medium", "low"] },
    { name: "output_format", label: "Output format", type: "select", defaultValue: "png", options: ["png", "jpeg", "webp"] },
  ],
  video: [
    { name: "resolution", label: "Resolution", type: "select", defaultValue: "1080p", options: ["720p", "1080p"] },
    { name: "ratio", label: "Aspect ratio", type: "select", defaultValue: "16:9", options: ["16:9", "9:16", "1:1", "4:3", "3:4"] },
    { name: "duration", label: "Duration", type: "number", defaultValue: 5, min: 1, max: 30 },
    { name: "generate_audio", label: "Generate audio", type: "boolean", defaultValue: false },
  ],
  audio: [
    { name: "input_video_url", label: "Video URL", type: "text", defaultValue: "" },
    { name: "duration", label: "Duration", type: "number", defaultValue: 30, min: 5, max: 300 },
    { name: "output_format", label: "Output format", type: "select", defaultValue: "mp3", options: ["mp3", "m4a", "wav"] },
    { name: "variants", label: "Outputs", type: "number", defaultValue: 1, min: 1, max: 10 },
    { name: "preserve_speech", label: "Preserve speech", type: "boolean", defaultValue: true },
  ],
};

export type ModelLandingKey =
  | "↓ Go $10 · Pro $30 · Max $100 per month — usage worth up to 4.5× the price"
  | "▶ Sign in to run"
  | "Start generating"
  | "Generator setup"
  | "Saved before signup"
  | "Public demo"
  | "Size"
  | "Quality"
  | "Outputs"
  | "Edit the prompt and settings here. We save the draft locally, then open Flatkey so you can run it after signup."
  | "(flatkey · official ≈ {{price}})"
  | "{{model}} · OpenAI-compatible · one key, all models"
  | "* Illustrative pricing — see flatkey pricing page"
  | "/ million output tokens"
  | "/ image"
  | "/ second"
  | "/ request"
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
  | "GPT-image-2 image"
  | "Square output"
  | "Fast product mockups"
  | "Gemini 2.5 Pro output"
  | "Gemini 2.5 Flash output"
  | "Gemini 2.5 Pro input"
  | "Seedance video / sec"
  | "Image-to-video / sec"
  | "1080p / sec"
  | "MiniMax-H3 768P / sec"
  | "MiniMax-H3 2K / sec"
  | "Reference video input"
  | "Input image after free tier"
  | "same per-second rate"
  | "AIGC watermark"
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
  | "Product mockups"
  | "Ad creatives"
  | "Ecommerce images"
  | "Best for product images, ad creatives, and ecommerce visual variants"
  | "Does this start a real generation?"
  | "The public page saves your draft settings first. Sign up or open the console to run the request with an API key."
  | "Which MiniMax-H3 fields can I configure here?"
  | "Configure resolution, duration, ratio, and AIGC watermark before opening the console."
  | "Where are my edited prompt settings stored?"
  | "They are stored in this browser's localStorage so the draft survives the signup handoff."
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

export function getModelLandingConfigForPricingModel(model: PricingModel): ModelConfig | null {
  const explicitConfig = getModelLandingConfigForModel(model.model_name);
  if (explicitConfig) return modelLandingConfigForModel(explicitConfig, model);
  return buildGenericMediaLandingConfig(model);
}

export function modelLandingConfigForModel(config: ModelConfig, model: PricingModel): ModelConfig {
  return {
    ...config,
    slug: encodeURIComponent(model.model_name),
    modelIds: [model.model_name, ...config.modelIds],
    displayName: model.model_name,
    modelId: model.model_name,
    officialName: model.vendor_name ?? config.officialName,
  };
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

function buildGenericMediaLandingConfig(model: PricingModel): ModelConfig | null {
  const kind = inferMediaKind(model);
  if (!kind) return null;
  const price = GENERIC_MEDIA_PRICE_BY_KIND[kind];
  const displayName = model.model_name;
  const officialName = model.vendor_name ?? "Provider";
  return {
    slug: encodeURIComponent(model.model_name),
    modelIds: [model.model_name],
    displayName,
    modelId: model.model_name,
    generator: {
      kind,
      endpoint: mediaEndpointForModel(kind, model),
      storageKey: `flatkey:model-generator-draft:${normalizeModelId(model.model_name)}`,
      fields: GENERIC_MEDIA_FIELDS[kind],
    },
    officialName,
    officialPrice: model.model_price ? formatPriceLiteral(model.model_price) : price.official,
    flatkeyPrice: model.model_price ? formatPriceLiteral(model.model_price * 0.53) : price.flatkey,
    estFlatkey: model.model_price ? formatPriceLiteral(model.model_price * 0.53) : price.flatkey,
    estOfficial: model.model_price ? formatPriceLiteral(model.model_price) : price.official,
    examplePrompt: examplePromptForMediaKind(kind, displayName),
    priceUnit: price.priceUnit,
    rows: [
      { label: "Live flatkey pricing", flatkey: model.model_price ? formatPriceLiteral(model.model_price * 0.53) : price.flatkey, official: model.model_price ? formatPriceLiteral(model.model_price) : price.official },
      { label: "Live model data from pricing API", flatkey: "", value: officialName },
      { label: "Coverage", flatkey: "", value: "Text · image · video · audio" },
    ],
    seo: {
      title: `${displayName} generator — configure prompts before signup`,
      description: `Configure ${displayName} requests on flatkey.ai, save prompt settings locally, then continue to signup or the console.`,
    },
    positioning: kind === "image"
      ? "Best for product images, ad creatives, and ecommerce visual variants"
      : "Best for product videos, ad creative, and image-to-video production",
    useCases: kind === "image" ? ["Product mockups", "Ad creatives", "Ecommerce images"] : ["UGC ad clips", "Product motion", "Social video variants"],
    faq: [
      {
        question: "Does this start a real generation?",
        answer: "The public page saves your draft settings first. Sign up or open the console to run the request with an API key.",
      },
      {
        question: "Where are my edited prompt settings stored?",
        answer: "They are stored in this browser's localStorage so the draft survives the signup handoff.",
      },
    ],
  };
}

function inferMediaKind(model: PricingModel): ModelGeneratorConfig["kind"] | null {
  const name = normalizeModelId(model.model_name);
  const endpoints = (model.supported_endpoint_types ?? []).map((endpoint) => normalizeModelId(endpoint));
  const endpointText = endpoints.join("-");
  if (
    endpointText.includes("video-to-music") ||
    endpointText.includes("audio") ||
    endpointText.includes("music") ||
    endpointText.includes("sound") ||
    /(^|-)(audio|music|voice|tts|sfx|sound|sonilo|suno|lyrics)(-|$)/.test(name)
  ) {
    return "audio";
  }
  if (
    endpointText.includes("image-generation") ||
    /(^|-)(image|imagen|banana|flux|ideogram)(-|$)/.test(name)
  ) {
    return "image";
  }
  if (
    endpointText.includes("video") ||
    /(^|-)(video|sora|veo|kling|seedance|hailuo|runway|wan)(-|$)/.test(name)
  ) {
    return "video";
  }
  return null;
}

function mediaEndpointForModel(kind: ModelGeneratorConfig["kind"], model: PricingModel): string {
  const endpoints = (model.supported_endpoint_types ?? []).map((endpoint) => normalizeModelId(endpoint));
  if (endpoints.some((endpoint) => endpoint.includes("video-to-music"))) return "/v1/video-to-music";
  if (endpoints.some((endpoint) => endpoint.includes("sound"))) return "/v1/sound-generation";
  if (endpoints.some((endpoint) => endpoint.includes("music"))) return "/v1/music";
  if (kind === "image") return "/v1/images/generations";
  if (kind === "video") return "/v1/videos";
  return "/v1/music";
}

function examplePromptForMediaKind(kind: ModelGeneratorConfig["kind"], modelName: string): string {
  if (kind === "audio") {
    return `Create a polished music bed for ${modelName}: keep the video timing, preserve important speech, use a warm electronic style, and deliver a clean loopable ending.`;
  }
  if (kind === "video") {
    return `Create a short product video with ${modelName}: clear subject motion, realistic lighting, stable camera, and production-ready framing.`;
  }
  return `Create a high-quality product image with ${modelName}: clean composition, precise lighting, strong subject focus, and realistic detail.`;
}

function formatPriceLiteral(value: number): string {
  return `$${Number(value.toFixed(6)).toString()}`;
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
  "Start generating": "Start generating",
  "Generator setup": "Generator setup",
  "Saved before signup": "Saved before signup",
  "Public demo": "Public demo",
  Size: "Size",
  Quality: "Quality",
  Outputs: "Outputs",
  "Edit the prompt and settings here. We save the draft locally, then open Flatkey so you can run it after signup.": "Edit the prompt and settings here. We save the draft locally, then open Flatkey so you can run it after signup.",
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
  "/ image": "/ image",
  "/ request": "/ request",
  "Opus 4 output": "Opus 4 output",
  "Sonnet 4 output": "Sonnet 4 output",
  "Haiku output": "Haiku output",
  "GPT-5 output": "GPT-5 output",
  "GPT-5 mini output": "GPT-5 mini output",
  "GPT-5 input": "GPT-5 input",
  "GPT-image-2 image": "GPT-image-2 image",
  "Square output": "Square output",
  "Fast product mockups": "Fast product mockups",
  "Gemini 2.5 Pro output": "Gemini 2.5 Pro output",
  "Gemini 2.5 Flash output": "Gemini 2.5 Flash output",
  "Gemini 2.5 Pro input": "Gemini 2.5 Pro input",
  "Seedance video / sec": "Seedance video / sec",
  "Image-to-video / sec": "Image-to-video / sec",
  "1080p / sec": "1080p / sec",
  "MiniMax-H3 768P / sec": "MiniMax-H3 768P / sec",
  "MiniMax-H3 2K / sec": "MiniMax-H3 2K / sec",
  "Reference video input": "Reference video input",
  "Input image after free tier": "Input image after free tier",
  "same per-second rate": "same per-second rate",
  "AIGC watermark": "AIGC watermark",
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
  "Product mockups": "Product mockups",
  "Ad creatives": "Ad creatives",
  "Ecommerce images": "Ecommerce images",
  "Best for product images, ad creatives, and ecommerce visual variants": "Best for product images, ad creatives, and ecommerce visual variants",
  "Does this start a real generation?": "Does this start a real generation?",
  "The public page saves your draft settings first. Sign up or open the console to run the request with an API key.": "The public page saves your draft settings first. Sign up or open the console to run the request with an API key.",
  "Which MiniMax-H3 fields can I configure here?": "Which MiniMax-H3 fields can I configure here?",
  "Configure resolution, duration, ratio, and AIGC watermark before opening the console.": "Configure resolution, duration, ratio, and AIGC watermark before opening the console.",
  "Where are my edited prompt settings stored?": "Where are my edited prompt settings stored?",
  "They are stored in this browser's localStorage so the draft survives the signup handoff.": "They are stored in this browser's localStorage so the draft survives the signup handoff.",
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

const translations: Record<Locale, Record<string, string>> = withIdFallback<Record<string, string>>({
  en,
  zh: {
    "Back to Market": "返回模型市场",
    "Copy page": "复制页面",
    "Copy model id": "复制模型 ID",
    "Flatkey Router": "Flatkey Router",
    "Configure a {{model}} request on the public page. Flatkey saves the draft locally, then opens the console so you can run it with your account and API key.": "在公开页配置 {{model}} 请求。Flatkey 会先把草稿保存到本地，然后打开控制台，让你用自己的账号和 API Key 运行。",
    "Model Type": "模型类型",
    "Text to Video": "文生视频",
    Audio: "音频",
    "Image to Image": "图像生成",
    API: "API",
    Pricing: "价格",
    "Model ID": "模型 ID",
    Playground: "Playground",
    Examples: "示例",
    Similar: "相似模型",
    README: "README",
    Input: "输入",
    Form: "表单",
    "Join and run": "注册后运行",
    Output: "输出",
    Preview: "预览",
    "View API Docs": "查看 API 文档",
    "Get API Key": "获取 API Key",
    "Images generated": "已生成图片",
    "Videos generated": "已生成视频",
    "Avg. response time": "平均响应时间",
    Uptime: "可用性",
    "Ready for production": "可用于生产",
    "Generated Examples": "生成示例",
    "Explore what {{model}} can create": "看看 {{model}} 可以生成什么",
    "Create with this model": "用这个模型创建",
    "Generated with {{model}}": "使用 {{model}} 生成",
    "Transparent Pricing": "透明价格",
    "Flatkey {{model}} usage pricing": "Flatkey {{model}} 用量价格",
    "Use the same Flatkey balance and API key across image, video, audio, and text models.": "图像、视频、音频和文本模型共用同一个 Flatkey 余额和 API Key。",
    "Open wallet": "打开钱包",
    "Flatkey price": "Flatkey 价格",
    "Reference price": "官方价格",
    "Shared balance": "共用余额",
    "Why Flatkey": "为什么选择 Flatkey",
    "Why use Flatkey for {{model}}?": "为什么用 Flatkey 调用 {{model}}？",
    "Lower generation pricing": "更低的生成成本",
    "Route media workloads through Flatkey and keep prompt tests cheaper before scaling.": "媒体生成任务走 Flatkey，扩量前的 prompt 测试成本更可控。",
    "Draft handoff": "草稿接力",
    "The public page stores prompt settings locally before sending the user into Flatkey.": "公开页会先在本地保存 prompt 和参数，再把用户带到 Flatkey。",
    "Unified API access": "统一 API 入口",
    "Use one account and API key across image, video, audio, and language models.": "一个账号和 API Key 覆盖图像、视频、音频和语言模型。",
    "Start generating in three steps": "三步开始生成",
    "Try a prompt": "先试 prompt",
    "Use the playground to validate quality and style fit.": "在 playground 中验证质量、风格和参数是否合适。",
    "Create an API key": "创建 API Key",
    "Sign up, open Dashboard, and create a token for this model.": "注册后进入控制台，为这个模型创建 token。",
    "Ship your workflow": "接入你的工作流",
    "Call the same endpoint, then top up credits as usage grows.": "调用同一个 endpoint，并随用量增长充值额度。",
    "Built for generation teams": "为生成团队准备",
    "Ads and social creative": "广告与社媒创意",
    "Produce campaign concepts, thumbnails, posters, and localized variants.": "生成活动概念图、缩略图、海报和本地化版本。",
    "Product visuals": "产品视觉",
    "Generate product-style shots, merchandising scenes, and reference-guided variations.": "生成产品图、陈列场景和参考图引导的变体。",
    "Developer pipelines": "开发者流水线",
    "Add async generation for agents, CMS tools, and batch creative systems.": "为 Agent、CMS 工具和批量创意系统接入异步生成。",
    "{{model}} pricing FAQ": "{{model}} 价格 FAQ",
    "Generate your first {{model}} on Flatkey": "在 Flatkey 生成第一个 {{model}} 请求",
    "Save the draft, continue to signup if needed, or open the console directly when already logged in.": "先保存草稿；未登录会进入注册，已登录则直接打开控制台继续。",
    "Model Guide": "模型指南",
    "{{model}} is a production text model for chat, coding, long-context reasoning, and tool-enabled workflows through Flatkey-compatible API access.": "{{model}} 是适合聊天、代码、长上下文推理和工具工作流的生产级文本模型，可通过 Flatkey 兼容 API 访问。",
    Vendor: "供应商",
    Modalities: "模态",
    Text: "文本",
    Price: "价格",
    Updated: "更新日期",
    "Open in Playground": "在 Playground 打开",
    Docs: "文档",
    "Model Overview": "模型概览",
    "Quick Answer": "快速结论",
    "Best for chat, code generation, agent workflows, and production assistants.": "适合聊天、代码生成、Agent 工作流和生产级助手。",
    "Use Flatkey when you want OpenAI-compatible routing, unified billing, and reusable API keys.": "当你需要兼容 OpenAI 的路由、统一账单和可复用 API Key 时，可以使用 Flatkey。",
    "Start with the default parameters, then tune max tokens and temperature for your workload.": "先使用默认参数，再按任务调整 max_tokens 和 temperature。",
    "{{model}} Model Features": "{{model}} 模型能力",
    "Core capabilities and practical engineering value": "核心能力与工程价值",
    "How to Use {{model}} API": "如何使用 {{model}} API",
    "Create an API key and set Authorization: Bearer <YOUR_API_KEY>.": "创建 API Key，并设置 Authorization: Bearer <YOUR_API_KEY>。",
    "POST to /v1/chat/completions with at least model and messages.": "向 /v1/chat/completions 发起 POST 请求，至少包含 model 和 messages。",
    "Tune max_tokens, temperature, and top_p based on task complexity.": "根据任务复杂度调整 max_tokens、temperature 和 top_p。",
    "Enable streaming for chat UIs, terminal assistants, and agent workflows.": "聊天 UI、终端助手和 Agent 工作流可以启用 streaming。",
    "Use logs and retries to refine prompts before broader rollout.": "扩量前通过日志和重试优化 prompt。",
    "Common Errors": "常见错误",
    "Missing required fields, malformed messages, or unsupported parameter values.": "缺少必填字段、messages 格式错误，或参数值不支持。",
    "Missing Authorization header, malformed bearer token, or invalid API key.": "缺少 Authorization 头、Bearer token 格式错误，或 API Key 无效。",
    "Request rate, concurrency, or quota is above current account limits.": "请求速率、并发或额度超过当前账号限制。",
    "Transient upstream instability, tool execution failure, or processing issue.": "上游短暂不稳定、工具执行失败或处理异常。",
    "Ready to unify your AI model access?": "准备统一你的 AI 模型访问了吗？",
    "Use one Flatkey account to test prompts, compare models, and move the saved request into the console.": "用一个 Flatkey 账号测试 prompt、比较模型，并把保存的请求带入控制台。",
    "View Pricing": "查看价格",
    Prompt: "Prompt",
    "Quick Prompts": "快捷 Prompt",
    "Product Reveal": "产品展示",
    "UGC Ad": "UGC 广告",
    "Cinematic Scene": "电影感场景",
    "Social Clip": "社媒短片",
    "Product Photo": "产品摄影",
    "Anime Portrait": "动漫头像",
    "Realistic Human": "真人写实",
    "YouTube Thumbnail": "YouTube 缩略图",
    "Fantasy Landscape": "奇幻风景",
    "Advanced Options": "高级选项",
    "Reference Images": "参考图片",
    "Upload reference": "上传参考",
    "Example output": "示例输出",
    "Request preview": "请求预览",
    "Copy request": "复制请求",
    "Output format": "输出格式",
    Background: "背景",
    Moderation: "审核强度",
    Resolution: "分辨率",
    "Aspect ratio": "画面比例",
    Duration: "时长",
    Frames: "帧数",
    "Optional frame count override": "可选的帧数覆盖",
    "Camera fixed": "固定镜头",
    "Generate audio": "生成音频",
    "Return last frame": "返回尾帧",
    Seed: "随机种子",
    "0 means random": "0 表示随机",
    "OpenAI-compatible migration path": "兼容 OpenAI 的迁移路径",
    "Chat Completions-style payloads reduce switching friction from existing model stacks.": "Chat Completions 风格请求体能降低从现有模型栈迁移的成本。",
    "Structured and tool-based output": "结构化与工具输出",
    "Use structured JSON, tools, and code-generation flows for agentic workflows.": "可在 Agent 工作流中使用结构化 JSON、工具和代码生成流程。",
    "Streaming interaction": "流式交互",
    "Streaming supports chat UIs, terminal assistants, and progressive rendering.": "流式输出适合聊天 UI、终端助手和渐进式渲染。",
    "Production routing": "生产路由",
    "Keep usage, keys, quotas, and model routing in one Flatkey account.": "在一个 Flatkey 账号中管理用量、Key、额度和模型路由。",
    "Long-context work": "长上下文任务",
    "Useful for document summarization, codebase analysis, and knowledge workflows.": "适合文档总结、代码库分析和知识工作流。",
    "Coding and technical generation": "代码与技术生成",
    "Useful for code explanation, tests, refactors, SDK wrappers, and technical drafts.": "适合代码解释、测试、重构、SDK 封装和技术草稿。",
    "You pay": "你只付",
    "per month on the Go plan": "每月 · Go 套餐",
    "You get": "你获得",
    "of monthly model usage — 4.5× the price": "每月模型可用量 —— 套餐价的 4.5 倍",
    "from $10/month": "只需 $10/月起",
    "Pro — $30/mo, up to $90 usage": "Pro —— $30/月，可用 $90",
    "Most popular": "最受欢迎",
    "↓ Go $10 · Pro $30 · Max $100 per month — usage worth up to 4.5× the price": "↓ Go $10 · Pro $30 · Max $100 每月 —— 可用量最高达套餐价 4.5 倍",
    "▶ Sign in to run": "▶ 登录即可运行",
    "Start generating": "开始生成",
    "Generator setup": "生成器配置",
    "Saved before signup": "注册前保存",
    "Public demo": "公开演示",
    Size: "尺寸",
    Quality: "质量",
    Outputs: "输出数量",
    "Edit the prompt and settings here. We save the draft locally, then open Flatkey so you can run it after signup.": "在这里编辑 prompt 和参数。我们会先在本地保存草稿，然后打开 Flatkey，注册后即可运行。",
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
    "/ image": "/ 张图片",
    "Opus 4 output": "Opus 4 输出",
    "Sonnet 4 output": "Sonnet 4 输出",
    "Haiku output": "Haiku 输出",
    "GPT-5 output": "GPT-5 输出",
    "GPT-5 mini output": "GPT-5 mini 输出",
    "GPT-5 input": "GPT-5 输入",
    "Gemini 2.5 Pro output": "Gemini 2.5 Pro 输出",
    "Gemini 2.5 Flash output": "Gemini 2.5 Flash 输出",
    "Gemini 2.5 Pro input": "Gemini 2.5 Pro 输入",
    "GPT-image-2 image": "GPT-image-2 图片",
    "Square output": "方图输出",
    "Fast product mockups": "快速产品样机",
    "Seedance video / sec": "Seedance 视频/秒",
    "Image-to-video / sec": "图生视频/秒",
    "1080p / sec": "1080p/秒",
    "MiniMax-H3 768P / sec": "MiniMax-H3 768P/秒",
    "MiniMax-H3 2K / sec": "MiniMax-H3 2K/秒",
    "Reference video input": "参考视频输入",
    "Input image after free tier": "超出免费档的输入图片",
    "same per-second rate": "同输出秒价",
    "AIGC watermark": "AIGC 水印",
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
    "Product mockups": "产品样机",
    "Ad creatives": "广告素材",
    "Ecommerce images": "电商图片",
    "Best for product images, ad creatives, and ecommerce visual variants": "适合产品图、广告素材和电商视觉变体",
    "Does this start a real generation?": "这里会真的开始生成吗？",
    "The public page saves your draft settings first. Sign up or open the console to run the request with an API key.": "公开页面会先保存你的草稿配置。注册或进入控制台后，再用 API 密钥真正运行请求。",
    "Which MiniMax-H3 fields can I configure here?": "这里可以配置哪些 MiniMax-H3 字段？",
    "Configure resolution, duration, ratio, and AIGC watermark before opening the console.": "进入控制台前可以先配置分辨率、时长、画面比例和 AIGC 水印。",
    "Where are my edited prompt settings stored?": "我编辑过的 prompt 配置存在哪里？",
    "They are stored in this browser's localStorage so the draft survives the signup handoff.": "会保存在当前浏览器的 localStorage 中，因此注册跳转后草稿仍可保留。",
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
    "Start generating": "Empezar a generar",
    "Generator setup": "Configuración del generador",
    "Saved before signup": "Guardado antes del registro",
    "Public demo": "Demo pública",
    Size: "Tamaño",
    Quality: "Calidad",
    Outputs: "Salidas",
    "Edit the prompt and settings here. We save the draft locally, then open Flatkey so you can run it after signup.": "Edita el prompt y los ajustes aquí. Guardamos el borrador localmente y luego abrimos Flatkey para que puedas ejecutarlo tras registrarte.",
    "(flatkey · official ≈ {{price}})": "(flatkey · oficial ≈ {{price}})",
    "{{model}} · OpenAI-compatible · one key, all models": "{{model}} · compatible con OpenAI · una clave, todos los modelos",
    "* Illustrative pricing — see flatkey pricing page": "* Precios ilustrativos — consulta la página de precios de flatkey",
    "/ million output tokens": "/ millón de tokens de salida",
    "/ image": "/ imagen",
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
    "GPT-image-2 image": "Imagen GPT-image-2",
    "Square output": "Salida cuadrada",
    "Fast product mockups": "Mockups de producto rápidos",
    "Gemini 2.5 Pro output": "Salida de Gemini 2.5 Pro",
    "Gemini 2.5 Flash output": "Salida de Gemini 2.5 Flash",
    "Gemini 2.5 Pro input": "Entrada de Gemini 2.5 Pro",
    "Seedance video / sec": "Vídeo Seedance/seg",
    "Image-to-video / sec": "Imagen a vídeo/seg",
    "1080p / sec": "1080p/seg",
    "MiniMax-H3 768P / sec": "MiniMax-H3 768P/seg",
    "MiniMax-H3 2K / sec": "MiniMax-H3 2K/seg",
    "Reference video input": "Vídeo de referencia",
    "Input image after free tier": "Imagen de entrada tras el tramo gratis",
    "same per-second rate": "misma tarifa por segundo",
    "AIGC watermark": "Marca de agua AIGC",
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
    "Product mockups": "Mockups de producto",
    "Ad creatives": "Creatividades publicitarias",
    "Ecommerce images": "Imágenes de ecommerce",
    "Best for product images, ad creatives, and ecommerce visual variants": "Ideal para imágenes de producto, creatividades publicitarias y variantes visuales de ecommerce",
    "Does this start a real generation?": "¿Esto inicia una generación real?",
    "The public page saves your draft settings first. Sign up or open the console to run the request with an API key.": "La página pública primero guarda tus ajustes de borrador. Regístrate o abre la consola para ejecutar la solicitud con una clave API.",
    "Which MiniMax-H3 fields can I configure here?": "¿Qué campos de MiniMax-H3 puedo configurar aquí?",
    "Configure resolution, duration, ratio, and AIGC watermark before opening the console.": "Configura resolución, duración, relación de aspecto y marca de agua AIGC antes de abrir la consola.",
    "Where are my edited prompt settings stored?": "¿Dónde se guardan mis ajustes editados del prompt?",
    "They are stored in this browser's localStorage so the draft survives the signup handoff.": "Se guardan en el localStorage de este navegador para que el borrador sobreviva al paso de registro.",
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
    "Start generating": "Commencer la génération",
    "Generator setup": "Configuration du générateur",
    "Saved before signup": "Enregistré avant l'inscription",
    "Public demo": "Démo publique",
    Size: "Taille",
    Quality: "Qualité",
    Outputs: "Sorties",
    "Edit the prompt and settings here. We save the draft locally, then open Flatkey so you can run it after signup.": "Modifiez le prompt et les paramètres ici. Nous enregistrons le brouillon localement, puis ouvrons Flatkey pour que vous puissiez l'exécuter après inscription.",
    "(flatkey · official ≈ {{price}})": "(flatkey · officiel ≈ {{price}})",
    "{{model}} · OpenAI-compatible · one key, all models": "{{model}} · compatible OpenAI · une clé, tous les modèles",
    "* Illustrative pricing — see flatkey pricing page": "* Tarifs indicatifs — voir la page tarifs de flatkey",
    "/ million output tokens": "/ million de tokens de sortie",
    "/ image": "/ image",
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
    "GPT-image-2 image": "Image GPT-image-2",
    "Square output": "Sortie carrée",
    "Fast product mockups": "Mockups produit rapides",
    "Gemini 2.5 Pro output": "Sortie Gemini 2.5 Pro",
    "Gemini 2.5 Flash output": "Sortie Gemini 2.5 Flash",
    "Gemini 2.5 Pro input": "Entrée Gemini 2.5 Pro",
    "Seedance video / sec": "Vidéo Seedance/s",
    "Image-to-video / sec": "Image vers vidéo/s",
    "1080p / sec": "1080p/s",
    "MiniMax-H3 768P / sec": "MiniMax-H3 768P/s",
    "MiniMax-H3 2K / sec": "MiniMax-H3 2K/s",
    "Reference video input": "Vidéo de référence",
    "Input image after free tier": "Image d'entrée après le palier gratuit",
    "same per-second rate": "même tarif par seconde",
    "AIGC watermark": "Filigrane AIGC",
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
    "Product mockups": "Mockups produit",
    "Ad creatives": "Créations publicitaires",
    "Ecommerce images": "Images e-commerce",
    "Best for product images, ad creatives, and ecommerce visual variants": "Idéal pour les images produit, les créations publicitaires et les variantes visuelles e-commerce",
    "Does this start a real generation?": "Cela lance-t-il une vraie génération ?",
    "The public page saves your draft settings first. Sign up or open the console to run the request with an API key.": "La page publique enregistre d'abord vos paramètres de brouillon. Inscrivez-vous ou ouvrez la console pour exécuter la requête avec une clé API.",
    "Which MiniMax-H3 fields can I configure here?": "Quels champs MiniMax-H3 puis-je configurer ici ?",
    "Configure resolution, duration, ratio, and AIGC watermark before opening the console.": "Configurez la résolution, la durée, le ratio et le filigrane AIGC avant d'ouvrir la console.",
    "Where are my edited prompt settings stored?": "Où sont stockés mes paramètres de prompt modifiés ?",
    "They are stored in this browser's localStorage so the draft survives the signup handoff.": "Ils sont stockés dans le localStorage de ce navigateur afin que le brouillon survive au passage par l'inscription.",
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
    "Start generating": "Começar a gerar",
    "Generator setup": "Configuração do gerador",
    "Saved before signup": "Salvo antes do cadastro",
    "Public demo": "Demo pública",
    Size: "Tamanho",
    Quality: "Qualidade",
    Outputs: "Saídas",
    "Edit the prompt and settings here. We save the draft locally, then open Flatkey so you can run it after signup.": "Edite o prompt e as configurações aqui. Salvamos o rascunho localmente e depois abrimos o Flatkey para você executar após cadastrar.",
    "(flatkey · official ≈ {{price}})": "(flatkey · oficial ≈ {{price}})",
    "{{model}} · OpenAI-compatible · one key, all models": "{{model}} · compatível com OpenAI · uma chave, todos os modelos",
    "* Illustrative pricing — see flatkey pricing page": "* Preços ilustrativos — veja a página de preços do flatkey",
    "/ million output tokens": "/ milhão de tokens de saída",
    "/ image": "/ imagem",
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
    "GPT-image-2 image": "Imagem GPT-image-2",
    "Square output": "Saída quadrada",
    "Fast product mockups": "Mockups de produto rápidos",
    "Gemini 2.5 Pro output": "Saída do Gemini 2.5 Pro",
    "Gemini 2.5 Flash output": "Saída do Gemini 2.5 Flash",
    "Gemini 2.5 Pro input": "Entrada do Gemini 2.5 Pro",
    "Seedance video / sec": "Vídeo Seedance/seg",
    "Image-to-video / sec": "Imagem-para-vídeo/seg",
    "1080p / sec": "1080p/seg",
    "MiniMax-H3 768P / sec": "MiniMax-H3 768P/seg",
    "MiniMax-H3 2K / sec": "MiniMax-H3 2K/seg",
    "Reference video input": "Vídeo de referência",
    "Input image after free tier": "Imagem de entrada após a faixa grátis",
    "same per-second rate": "mesma tarifa por segundo",
    "AIGC watermark": "Marca d'água AIGC",
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
    "Product mockups": "Mockups de produto",
    "Ad creatives": "Criativos de anúncio",
    "Ecommerce images": "Imagens de ecommerce",
    "Best for product images, ad creatives, and ecommerce visual variants": "Ideal para imagens de produto, criativos de anúncio e variações visuais de ecommerce",
    "Does this start a real generation?": "Isso inicia uma geração real?",
    "The public page saves your draft settings first. Sign up or open the console to run the request with an API key.": "A página pública salva primeiro suas configurações de rascunho. Cadastre-se ou abra o console para executar a solicitação com uma chave API.",
    "Which MiniMax-H3 fields can I configure here?": "Quais campos do MiniMax-H3 posso configurar aqui?",
    "Configure resolution, duration, ratio, and AIGC watermark before opening the console.": "Configure resolução, duração, proporção e marca d'água AIGC antes de abrir o console.",
    "Where are my edited prompt settings stored?": "Onde meus ajustes editados do prompt são armazenados?",
    "They are stored in this browser's localStorage so the draft survives the signup handoff.": "Eles ficam no localStorage deste navegador para que o rascunho sobreviva ao fluxo de cadastro.",
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
    "Start generating": "Начать генерацию",
    "Generator setup": "Настройки генератора",
    "Saved before signup": "Сохранено до регистрации",
    "Public demo": "Публичная демо-страница",
    Size: "Размер",
    Quality: "Качество",
    Outputs: "Выходы",
    "Edit the prompt and settings here. We save the draft locally, then open Flatkey so you can run it after signup.": "Редактируйте prompt и параметры здесь. Мы сохраним черновик локально, затем откроем Flatkey, чтобы вы могли запустить его после регистрации.",
    "(flatkey · official ≈ {{price}})": "(flatkey · официальный ≈ {{price}})",
    "{{model}} · OpenAI-compatible · one key, all models": "{{model}} · совместим с OpenAI · один ключ, все модели",
    "* Illustrative pricing — see flatkey pricing page": "* Ориентировочные цены — см. страницу тарифов flatkey",
    "/ million output tokens": "/ млн выходных токенов",
    "/ image": "/ изображение",
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
    "GPT-image-2 image": "Изображение GPT-image-2",
    "Square output": "Квадратный вывод",
    "Fast product mockups": "Быстрые продуктовые макеты",
    "Gemini 2.5 Pro output": "Вывод Gemini 2.5 Pro",
    "Gemini 2.5 Flash output": "Вывод Gemini 2.5 Flash",
    "Gemini 2.5 Pro input": "Ввод Gemini 2.5 Pro",
    "Seedance video / sec": "Видео Seedance/сек",
    "Image-to-video / sec": "Изображение в видео/сек",
    "1080p / sec": "1080p/сек",
    "MiniMax-H3 768P / sec": "MiniMax-H3 768P/сек",
    "MiniMax-H3 2K / sec": "MiniMax-H3 2K/сек",
    "Reference video input": "Входное референс-видео",
    "Input image after free tier": "Входное изображение после бесплатного лимита",
    "same per-second rate": "та же посекундная ставка",
    "AIGC watermark": "Водяной знак AIGC",
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
    "Product mockups": "Продуктовые макеты",
    "Ad creatives": "Рекламные креативы",
    "Ecommerce images": "Изображения для e-commerce",
    "Best for product images, ad creatives, and ecommerce visual variants": "Подходит для продуктовых изображений, рекламных креативов и визуальных вариантов для e-commerce",
    "Does this start a real generation?": "Это запускает реальную генерацию?",
    "The public page saves your draft settings first. Sign up or open the console to run the request with an API key.": "Публичная страница сначала сохраняет настройки черновика. Зарегистрируйтесь или откройте консоль, чтобы запустить запрос с API-ключом.",
    "Which MiniMax-H3 fields can I configure here?": "Какие поля MiniMax-H3 можно настроить здесь?",
    "Configure resolution, duration, ratio, and AIGC watermark before opening the console.": "Настройте разрешение, длительность, соотношение сторон и водяной знак AIGC перед открытием консоли.",
    "Where are my edited prompt settings stored?": "Где хранятся отредактированные настройки prompt?",
    "They are stored in this browser's localStorage so the draft survives the signup handoff.": "Они хранятся в localStorage этого браузера, чтобы черновик сохранился при переходе к регистрации.",
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
    "Start generating": "生成を開始",
    "Generator setup": "生成設定",
    "Saved before signup": "登録前に保存",
    "Public demo": "公開デモ",
    Size: "サイズ",
    Quality: "品質",
    Outputs: "出力数",
    "Edit the prompt and settings here. We save the draft locally, then open Flatkey so you can run it after signup.": "ここでプロンプトと設定を編集します。下書きはローカルに保存され、その後 Flatkey を開いて登録後に実行できます。",
    "(flatkey · official ≈ {{price}})": "(flatkey · 公式 ≈ {{price}})",
    "{{model}} · OpenAI-compatible · one key, all models": "{{model}} · OpenAI 互換 · 1つのキーで全モデル",
    "* Illustrative pricing — see flatkey pricing page": "* 参考価格 — flatkey の料金ページをご覧ください",
    "/ million output tokens": "/ 出力トークン100万あたり",
    "/ image": "/ 画像",
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
    "GPT-image-2 image": "GPT-image-2 画像",
    "Square output": "正方形出力",
    "Fast product mockups": "高速な商品モックアップ",
    "Gemini 2.5 Pro output": "Gemini 2.5 Pro 出力",
    "Gemini 2.5 Flash output": "Gemini 2.5 Flash 出力",
    "Gemini 2.5 Pro input": "Gemini 2.5 Pro 入力",
    "Seedance video / sec": "Seedance 動画/秒",
    "Image-to-video / sec": "画像から動画/秒",
    "1080p / sec": "1080p/秒",
    "MiniMax-H3 768P / sec": "MiniMax-H3 768P/秒",
    "MiniMax-H3 2K / sec": "MiniMax-H3 2K/秒",
    "Reference video input": "参照動画入力",
    "Input image after free tier": "無料枠後の入力画像",
    "same per-second rate": "同じ秒単価",
    "AIGC watermark": "AIGC ウォーターマーク",
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
    "Product mockups": "商品モックアップ",
    "Ad creatives": "広告クリエイティブ",
    "Ecommerce images": "EC 画像",
    "Best for product images, ad creatives, and ecommerce visual variants": "商品画像、広告クリエイティブ、EC 向けビジュアルバリエーションに最適",
    "Does this start a real generation?": "ここで実際に生成が始まりますか？",
    "The public page saves your draft settings first. Sign up or open the console to run the request with an API key.": "公開ページではまず下書き設定を保存します。登録するかコンソールを開き、API キーでリクエストを実行してください。",
    "Which MiniMax-H3 fields can I configure here?": "ここで設定できる MiniMax-H3 の項目は何ですか？",
    "Configure resolution, duration, ratio, and AIGC watermark before opening the console.": "コンソールを開く前に、解像度、長さ、アスペクト比、AIGC ウォーターマークを設定できます。",
    "Where are my edited prompt settings stored?": "編集したプロンプト設定はどこに保存されますか？",
    "They are stored in this browser's localStorage so the draft survives the signup handoff.": "このブラウザの localStorage に保存されるため、登録への受け渡し後も下書きが残ります。",
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
    "Start generating": "Bắt đầu tạo",
    "Generator setup": "Thiết lập trình tạo",
    "Saved before signup": "Đã lưu trước khi đăng ký",
    "Public demo": "Demo công khai",
    Size: "Kích thước",
    Quality: "Chất lượng",
    Outputs: "Số đầu ra",
    "Edit the prompt and settings here. We save the draft locally, then open Flatkey so you can run it after signup.": "Chỉnh prompt và cài đặt tại đây. Chúng tôi lưu bản nháp cục bộ rồi mở Flatkey để bạn chạy sau khi đăng ký.",
    "(flatkey · official ≈ {{price}})": "(flatkey · chính thức ≈ {{price}})",
    "{{model}} · OpenAI-compatible · one key, all models": "{{model}} · tương thích OpenAI · một khóa, mọi mô hình",
    "* Illustrative pricing — see flatkey pricing page": "* Giá minh họa — xem trang giá của flatkey",
    "/ million output tokens": "/ triệu token đầu ra",
    "/ image": "/ ảnh",
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
    "GPT-image-2 image": "Ảnh GPT-image-2",
    "Square output": "Đầu ra vuông",
    "Fast product mockups": "Mockup sản phẩm nhanh",
    "Gemini 2.5 Pro output": "Đầu ra Gemini 2.5 Pro",
    "Gemini 2.5 Flash output": "Đầu ra Gemini 2.5 Flash",
    "Gemini 2.5 Pro input": "Đầu vào Gemini 2.5 Pro",
    "Seedance video / sec": "Video Seedance/giây",
    "Image-to-video / sec": "Ảnh thành video/giây",
    "1080p / sec": "1080p/giây",
    "MiniMax-H3 768P / sec": "MiniMax-H3 768P/giây",
    "MiniMax-H3 2K / sec": "MiniMax-H3 2K/giây",
    "Reference video input": "Video tham chiếu đầu vào",
    "Input image after free tier": "Ảnh đầu vào sau mức miễn phí",
    "same per-second rate": "cùng đơn giá mỗi giây",
    "AIGC watermark": "Watermark AIGC",
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
    "Product mockups": "Mockup sản phẩm",
    "Ad creatives": "Creative quảng cáo",
    "Ecommerce images": "Ảnh thương mại điện tử",
    "Best for product images, ad creatives, and ecommerce visual variants": "Phù hợp cho ảnh sản phẩm, creative quảng cáo và biến thể hình ảnh thương mại điện tử",
    "Does this start a real generation?": "Thao tác này có bắt đầu tạo thật không?",
    "The public page saves your draft settings first. Sign up or open the console to run the request with an API key.": "Trang công khai trước hết lưu cấu hình bản nháp. Đăng ký hoặc mở console để chạy request bằng API key.",
    "Which MiniMax-H3 fields can I configure here?": "Tôi có thể cấu hình trường MiniMax-H3 nào ở đây?",
    "Configure resolution, duration, ratio, and AIGC watermark before opening the console.": "Cấu hình độ phân giải, thời lượng, tỷ lệ khung hình và watermark AIGC trước khi mở console.",
    "Where are my edited prompt settings stored?": "Cài đặt prompt đã chỉnh sửa được lưu ở đâu?",
    "They are stored in this browser's localStorage so the draft survives the signup handoff.": "Chúng được lưu trong localStorage của trình duyệt này để bản nháp vẫn còn sau bước đăng ký.",
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
    "Start generating": "Generierung starten",
    "Generator setup": "Generator-Einstellungen",
    "Saved before signup": "Vor der Anmeldung gespeichert",
    "Public demo": "Öffentliche Demo",
    Size: "Größe",
    Quality: "Qualität",
    Outputs: "Ausgaben",
    "Edit the prompt and settings here. We save the draft locally, then open Flatkey so you can run it after signup.": "Bearbeiten Sie Prompt und Einstellungen hier. Wir speichern den Entwurf lokal und öffnen dann Flatkey, damit Sie ihn nach der Anmeldung ausführen können.",
    "(flatkey · official ≈ {{price}})": "(flatkey · offiziell ≈ {{price}})",
    "{{model}} · OpenAI-compatible · one key, all models": "{{model}} · OpenAI-kompatibel · ein Schlüssel, alle Modelle",
    "* Illustrative pricing — see flatkey pricing page": "* Beispielpreise — siehe flatkey-Preisseite",
    "/ million output tokens": "/ Million Output-Tokens",
    "/ image": "/ Bild",
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
    "GPT-image-2 image": "GPT-image-2-Bild",
    "Square output": "Quadratische Ausgabe",
    "Fast product mockups": "Schnelle Produkt-Mockups",
    "Gemini 2.5 Pro output": "Gemini 2.5 Pro Output",
    "Gemini 2.5 Flash output": "Gemini 2.5 Flash Output",
    "Gemini 2.5 Pro input": "Gemini 2.5 Pro Input",
    "Seedance video / sec": "Seedance-Video/Sek.",
    "Image-to-video / sec": "Bild-zu-Video/Sek.",
    "1080p / sec": "1080p/Sek.",
    "MiniMax-H3 768P / sec": "MiniMax-H3 768P/Sek.",
    "MiniMax-H3 2K / sec": "MiniMax-H3 2K/Sek.",
    "Reference video input": "Referenzvideo-Eingabe",
    "Input image after free tier": "Eingabebild nach dem kostenlosen Kontingent",
    "same per-second rate": "gleicher Sekundenpreis",
    "AIGC watermark": "AIGC-Wasserzeichen",
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
    "Product mockups": "Produkt-Mockups",
    "Ad creatives": "Anzeigen-Creatives",
    "Ecommerce images": "E-Commerce-Bilder",
    "Best for product images, ad creatives, and ecommerce visual variants": "Ideal für Produktbilder, Anzeigen-Creatives und visuelle Varianten für E-Commerce",
    "Does this start a real generation?": "Startet das eine echte Generierung?",
    "The public page saves your draft settings first. Sign up or open the console to run the request with an API key.": "Die öffentliche Seite speichert zuerst Ihre Entwurfseinstellungen. Registrieren Sie sich oder öffnen Sie die Konsole, um die Anfrage mit einem API-Schlüssel auszuführen.",
    "Which MiniMax-H3 fields can I configure here?": "Welche MiniMax-H3-Felder kann ich hier konfigurieren?",
    "Configure resolution, duration, ratio, and AIGC watermark before opening the console.": "Konfigurieren Sie Auflösung, Dauer, Seitenverhältnis und AIGC-Wasserzeichen, bevor Sie die Konsole öffnen.",
    "Where are my edited prompt settings stored?": "Wo werden meine bearbeiteten Prompt-Einstellungen gespeichert?",
    "They are stored in this browser's localStorage so the draft survives the signup handoff.": "Sie werden im localStorage dieses Browsers gespeichert, damit der Entwurf die Anmeldung übersteht.",
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
