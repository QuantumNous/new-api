import type { Locale } from "./locales";
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

const COVERAGE = "GPT · Gemini · Claude · DeepSeek · Seedance";

export const CLAUDE_CONFIG: ModelConfig = {
  slug: "claude-api",
  modelIds: ["claude-opus-4", "claude-sonnet-4", "claude-haiku"],
  displayName: "Claude Opus 4",
  modelId: "claude-opus-4",
  officialName: "Anthropic",
  officialPrice: "$15.00",
  flatkeyPrice: "$7.50",
  estFlatkey: "$0.004",
  estOfficial: "$0.008",
  examplePrompt:
    "You are a senior backend engineer. In 3 sentences, explain why developers should use an LLM gateway instead of calling each official API directly.",
  priceUnit: "/ million output tokens",
  rows: [
    { label: "Opus 4 output", flatkey: "$7.5", official: "$15" },
    { label: "Sonnet 4 output", flatkey: "$7.5", official: "$15" },
    { label: "Haiku output", flatkey: "$2.0", official: "$4" },
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
      answer: "Yes. Prepaid balance, usage analytics, and one invoice keep spend bounded.",
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
  flatkeyPrice: "$5.50",
  estFlatkey: "$0.003",
  estOfficial: "$0.006",
  examplePrompt:
    "You are a senior backend engineer. In 3 sentences, explain why developers should use an LLM gateway instead of calling each official API directly.",
  priceUnit: "/ million output tokens",
  rows: [
    { label: "GPT-5 output", flatkey: "$5.5", official: "$10" },
    { label: "GPT-5 mini output", flatkey: "$1.1", official: "$2" },
    { label: "GPT-5 input", flatkey: "$0.7", official: "$1.25" },
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
      answer: "Yes. Prepaid balance, usage analytics, and one invoice keep spend bounded.",
    },
  ],
};

export const SEEDANCE_CONFIG: ModelConfig = {
  slug: "seedance-api",
  modelIds: ["seedance-2-0", "seedance-2.0", "seedance"],
  displayName: "Seedance 2.0",
  modelId: "seedance-2-0",
  officialName: "fal.ai",
  officialPrice: "$0.07",
  flatkeyPrice: "$0.035",
  estFlatkey: "$0.18",
  estOfficial: "$0.35",
  examplePrompt:
    "A cinematic drone shot flying over a neon-lit Tokyo street at night, rain reflections, 5 seconds.",
  priceUnit: "/ second",
  rows: [
    { label: "Seedance video / sec", flatkey: "$0.035", official: "$0.07" },
    { label: "Image-to-video / sec", flatkey: "$0.04", official: "$0.08" },
    { label: "1080p / sec", flatkey: "$0.05", official: "$0.10" },
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
      answer: "Yes. Prepaid balance, usage analytics, and one invoice keep spend bounded.",
    },
  ],
};

export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  [CLAUDE_CONFIG.slug]: CLAUDE_CONFIG,
  [GPT_CONFIG.slug]: GPT_CONFIG,
  [SEEDANCE_CONFIG.slug]: SEEDANCE_CONFIG,
};

export type ModelLandingKey =
  | "↓ Save 50% — double your token budget"
  | "▶ Sign in to run"
  | "(flatkey · official ≈ {{price}})"
  | "{{model}} · OpenAI-compatible · one key, all models"
  | "{{official}} official"
  | "* Illustrative pricing — see flatkey pricing page"
  | "/ million output tokens"
  | "/ second"
  | "# Your existing OpenAI code:"
  | "30–50% cheaper"
  | "50% bonus"
  | "Est. this run"
  | "First top-up"
  | "flatkey · same model, same quality"
  | "Google / GitHub one-click · no credit card to start"
  | "migrate.py — change one line"
  | "Pay to unlock · credited instantly · not a free-signup giveaway"
  | "Playground (edit before sign-up)"
  | "Pricing vs official"
  | "Same {{official}} upstream, same quality — flatkey costs half. Change one line of base_url and your existing OpenAI SDK just works. Try it below, sign in when you are ready."
  | "Sign in to claim →"
  | "Starter / individual"
  | "Team / high-volume"
  | "The same {{model}},"
  | "Top up $1000 get $500"
  | "Top up $200 get $100"
  | "Opus 4 output"
  | "Sonnet 4 output"
  | "Haiku output"
  | "GPT-5 output"
  | "GPT-5 mini output"
  | "GPT-5 input"
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
  | "Yes. Prepaid balance, usage analytics, and one invoice keep spend bounded."
  | "50% off";

export function getModelLandingConfig(slug: string): ModelConfig | null {
  return MODEL_CONFIGS[slug] ?? null;
}

export function getModelLandingConfigForModel(modelId: string): ModelConfig | null {
  const normalized = normalizeModelId(modelId);
  return getModelLandingConfigs().find((config) =>
    config.modelIds.some((configuredId) => normalizeModelId(configuredId) === normalized)
  ) ?? null;
}

export function getModelLandingConfigs(): ModelConfig[] {
  return Object.values(MODEL_CONFIGS);
}

export function getModelLandingPathnames(): string[] {
  return getModelLandingConfigs().map((config) => `/models/${config.slug}`);
}

export function resolveModelLandingModels(config: ModelConfig, models: PricingModel[]): PricingModel[] {
  const configuredIds = new Set(config.modelIds.map(normalizeModelId));
  return models.filter((model) => configuredIds.has(normalizeModelId(model.model_name)));
}

function normalizeModelId(modelId: string): string {
  return modelId.trim().toLowerCase().replace(/[_\s]+/g, "-");
}

const en: Record<ModelLandingKey, string> = {
  "↓ Save 50% — double your token budget": "↓ Save 50% — double your token budget",
  "▶ Sign in to run": "▶ Sign in to run",
  "(flatkey · official ≈ {{price}})": "(flatkey · official ≈ {{price}})",
  "{{model}} · OpenAI-compatible · one key, all models": "{{model}} · OpenAI-compatible · one key, all models",
  "{{official}} official": "{{official}} official",
  "* Illustrative pricing — see flatkey pricing page": "* Illustrative pricing — see flatkey pricing page",
  "/ million output tokens": "/ million output tokens",
  "/ second": "/ second",
  "# Your existing OpenAI code:": "# Your existing OpenAI code:",
  "30–50% cheaper": "30–50% cheaper",
  "50% bonus": "50% bonus",
  "Est. this run": "Est. this run",
  "First top-up": "First top-up",
  "flatkey · same model, same quality": "flatkey · same model, same quality",
  "Google / GitHub one-click · no credit card to start": "Google / GitHub one-click · no credit card to start",
  "migrate.py — change one line": "migrate.py — change one line",
  "Pay to unlock · credited instantly · not a free-signup giveaway": "Pay to unlock · credited instantly · not a free-signup giveaway",
  "Playground (edit before sign-up)": "Playground (edit before sign-up)",
  "Pricing vs official": "Pricing vs official",
  "Same {{official}} upstream, same quality — flatkey costs half. Change one line of base_url and your existing OpenAI SDK just works. Try it below, sign in when you are ready.":
    "Same {{official}} upstream, same quality — flatkey costs half. Change one line of base_url and your existing OpenAI SDK just works. Try it below, sign in when you are ready.",
  "Sign in to claim →": "Sign in to claim →",
  "Starter / individual": "Starter / individual",
  "Team / high-volume": "Team / high-volume",
  "The same {{model}},": "The same {{model}},",
  "Top up $1000 get $500": "Top up $1000 get $500",
  "Top up $200 get $100": "Top up $200 get $100",
  "Opus 4 output": "Opus 4 output",
  "Sonnet 4 output": "Sonnet 4 output",
  "Haiku output": "Haiku output",
  "GPT-5 output": "GPT-5 output",
  "GPT-5 mini output": "GPT-5 mini output",
  "GPT-5 input": "GPT-5 input",
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
  "Yes. Prepaid balance, usage analytics, and one invoice keep spend bounded.": "Yes. Prepaid balance, usage analytics, and one invoice keep spend bounded.",
  "50% off": "50% off",
};

const translations: Record<Locale, Record<ModelLandingKey, string>> = {
  en,
  zh: {
    "↓ Save 50% — double your token budget": "↓ 立省 50% — token 预算翻倍",
    "▶ Sign in to run": "▶ 登录即可运行",
    "(flatkey · official ≈ {{price}})": "(flatkey · 官方 ≈ {{price}})",
    "{{model}} · OpenAI-compatible · one key, all models": "{{model}} · 兼容 OpenAI · 一个密钥，全部模型",
    "{{official}} official": "{{official}} 官方",
    "* Illustrative pricing — see flatkey pricing page": "* 示例价格 — 详见 flatkey 定价页",
    "/ million output tokens": "/ 百万输出 token",
    "/ second": "/ 秒",
    "# Your existing OpenAI code:": "# 你现有的 OpenAI 代码：",
    "30–50% cheaper": "便宜 30–50%",
    "50% bonus": "赠送 50%",
    "Est. this run": "本次预估",
    "First top-up": "首次充值",
    "flatkey · same model, same quality": "flatkey · 同款模型，同等质量",
    "Google / GitHub one-click · no credit card to start": "Google / GitHub 一键登录 · 无需信用卡即可开始",
    "migrate.py — change one line": "migrate.py — 改一行即可",
    "Pay to unlock · credited instantly · not a free-signup giveaway": "付费解锁 · 即时到账 · 不是免费注册赠送",
    "Playground (edit before sign-up)": "Playground（注册前可编辑）",
    "Pricing vs official": "与官方价格对比",
    "Same {{official}} upstream, same quality — flatkey costs half. Change one line of base_url and your existing OpenAI SDK just works. Try it below, sign in when you are ready.":
      "同样的 {{official}} 上游，同等质量，flatkey 成本减半。只需修改一行 base_url，现有 OpenAI SDK 即可继续使用。可先在下方试用，准备好后再登录。",
    "Sign in to claim →": "登录领取 →",
    "Starter / individual": "入门 / 个人",
    "Team / high-volume": "团队 / 大用量",
    "The same {{model}},": "同样的 {{model}}，",
    "Top up $1000 get $500": "充 $1000 送 $500",
    "Top up $200 get $100": "充 $200 送 $100",
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
    "Yes. Prepaid balance, usage analytics, and one invoice keep spend bounded.": "可以。预付余额、用量分析和统一发票能把支出控制在边界内。",
    "50% off": "5 折",
  },
  es: {
    "↓ Save 50% — double your token budget": "↓ Ahorra 50% — duplica tu presupuesto de tokens",
    "▶ Sign in to run": "▶ Inicia sesión para ejecutar",
    "(flatkey · official ≈ {{price}})": "(flatkey · oficial ≈ {{price}})",
    "{{model}} · OpenAI-compatible · one key, all models": "{{model}} · compatible con OpenAI · una clave, todos los modelos",
    "{{official}} official": "{{official}} oficial",
    "* Illustrative pricing — see flatkey pricing page": "* Precios ilustrativos — consulta la página de precios de flatkey",
    "/ million output tokens": "/ millón de tokens de salida",
    "/ second": "/ segundo",
    "# Your existing OpenAI code:": "# Tu código OpenAI actual:",
    "30–50% cheaper": "30–50% más barato",
    "50% bonus": "50% de bonificación",
    "Est. this run": "Est. esta ejecución",
    "First top-up": "Primera recarga",
    "flatkey · same model, same quality": "flatkey · mismo modelo, misma calidad",
    "Google / GitHub one-click · no credit card to start": "Google / GitHub con un clic · sin tarjeta para empezar",
    "migrate.py — change one line": "migrate.py — cambia una línea",
    "Pay to unlock · credited instantly · not a free-signup giveaway": "Paga para desbloquear · crédito instantáneo · no es un regalo gratuito por registrarte",
    "Playground (edit before sign-up)": "Playground (edita antes de registrarte)",
    "Pricing vs official": "Precios vs oficial",
    "Same {{official}} upstream, same quality — flatkey costs half. Change one line of base_url and your existing OpenAI SDK just works. Try it below, sign in when you are ready.":
      "El mismo upstream de {{official}}, la misma calidad: flatkey cuesta la mitad. Cambia una línea de base_url y tu SDK de OpenAI actual funcionará. Pruébalo abajo e inicia sesión cuando estés listo.",
    "Sign in to claim →": "Inicia sesión para reclamar →",
    "Starter / individual": "Inicial / individual",
    "Team / high-volume": "Equipo / alto volumen",
    "The same {{model}},": "El mismo {{model}},",
    "Top up $1000 get $500": "Recarga $1000 y obtén $500",
    "Top up $200 get $100": "Recarga $200 y obtén $100",
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
    "Yes. Prepaid balance, usage analytics, and one invoice keep spend bounded.": "Sí. Saldo prepago, analítica de uso y una factura mantienen el gasto acotado.",
    "50% off": "50% de descuento",
  },
  fr: {
    "↓ Save 50% — double your token budget": "↓ Économisez 50% — doublez votre budget de tokens",
    "▶ Sign in to run": "▶ Connectez-vous pour exécuter",
    "(flatkey · official ≈ {{price}})": "(flatkey · officiel ≈ {{price}})",
    "{{model}} · OpenAI-compatible · one key, all models": "{{model}} · compatible OpenAI · une clé, tous les modèles",
    "{{official}} official": "{{official}} officiel",
    "* Illustrative pricing — see flatkey pricing page": "* Tarifs indicatifs — voir la page tarifs de flatkey",
    "/ million output tokens": "/ million de tokens de sortie",
    "/ second": "/ seconde",
    "# Your existing OpenAI code:": "# Votre code OpenAI actuel :",
    "30–50% cheaper": "30–50% moins cher",
    "50% bonus": "50% de bonus",
    "Est. this run": "Est. pour cette exécution",
    "First top-up": "Première recharge",
    "flatkey · same model, same quality": "flatkey · même modèle, même qualité",
    "Google / GitHub one-click · no credit card to start": "Google / GitHub en un clic · sans carte bancaire pour commencer",
    "migrate.py — change one line": "migrate.py — changez une ligne",
    "Pay to unlock · credited instantly · not a free-signup giveaway": "Payez pour débloquer · crédité instantanément · pas un cadeau gratuit à l'inscription",
    "Playground (edit before sign-up)": "Playground (modifiez avant l'inscription)",
    "Pricing vs official": "Tarifs vs officiel",
    "Same {{official}} upstream, same quality — flatkey costs half. Change one line of base_url and your existing OpenAI SDK just works. Try it below, sign in when you are ready.":
      "Même upstream {{official}}, même qualité : flatkey coûte moitié moins. Modifiez une ligne de base_url et votre SDK OpenAI actuel fonctionne. Essayez ci-dessous, puis connectez-vous quand vous êtes prêt.",
    "Sign in to claim →": "Connectez-vous pour réclamer →",
    "Starter / individual": "Débutant / individuel",
    "Team / high-volume": "Équipe / gros volume",
    "The same {{model}},": "Le même {{model}},",
    "Top up $1000 get $500": "Rechargez $1000, obtenez $500",
    "Top up $200 get $100": "Rechargez $200, obtenez $100",
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
    "Yes. Prepaid balance, usage analytics, and one invoice keep spend bounded.": "Oui. Solde prépayé, analyse d'usage et facture unique limitent la dépense.",
    "50% off": "50% de réduction",
  },
  pt: {
    "↓ Save 50% — double your token budget": "↓ Economize 50% — dobre seu orçamento de tokens",
    "▶ Sign in to run": "▶ Entrar para executar",
    "(flatkey · official ≈ {{price}})": "(flatkey · oficial ≈ {{price}})",
    "{{model}} · OpenAI-compatible · one key, all models": "{{model}} · compatível com OpenAI · uma chave, todos os modelos",
    "{{official}} official": "{{official}} oficial",
    "* Illustrative pricing — see flatkey pricing page": "* Preços ilustrativos — veja a página de preços do flatkey",
    "/ million output tokens": "/ milhão de tokens de saída",
    "/ second": "/ segundo",
    "# Your existing OpenAI code:": "# Seu código OpenAI atual:",
    "30–50% cheaper": "30–50% mais barato",
    "50% bonus": "50% de bônus",
    "Est. this run": "Est. desta execução",
    "First top-up": "Primeira recarga",
    "flatkey · same model, same quality": "flatkey · mesmo modelo, mesma qualidade",
    "Google / GitHub one-click · no credit card to start": "Google / GitHub com um clique · sem cartão de crédito para começar",
    "migrate.py — change one line": "migrate.py — mude uma linha",
    "Pay to unlock · credited instantly · not a free-signup giveaway": "Pague para desbloquear · crédito instantâneo · não é brinde gratuito de cadastro",
    "Playground (edit before sign-up)": "Playground (edite antes de cadastrar)",
    "Pricing vs official": "Preços vs oficial",
    "Same {{official}} upstream, same quality — flatkey costs half. Change one line of base_url and your existing OpenAI SDK just works. Try it below, sign in when you are ready.":
      "Mesmo upstream {{official}}, mesma qualidade — flatkey custa metade. Altere uma linha de base_url e seu SDK OpenAI atual funciona. Teste abaixo e entre quando estiver pronto.",
    "Sign in to claim →": "Entrar para resgatar →",
    "Starter / individual": "Inicial / individual",
    "Team / high-volume": "Equipe / alto volume",
    "The same {{model}},": "O mesmo {{model}},",
    "Top up $1000 get $500": "Recarregue $1000 ganhe $500",
    "Top up $200 get $100": "Recarregue $200 ganhe $100",
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
    "Yes. Prepaid balance, usage analytics, and one invoice keep spend bounded.": "Sim. Saldo pré-pago, análise de uso e uma fatura mantêm o gasto controlado.",
    "50% off": "50% de desconto",
  },
  ru: {
    "↓ Save 50% — double your token budget": "↓ Экономьте 50% — удвойте бюджет токенов",
    "▶ Sign in to run": "▶ Войдите, чтобы запустить",
    "(flatkey · official ≈ {{price}})": "(flatkey · официальный ≈ {{price}})",
    "{{model}} · OpenAI-compatible · one key, all models": "{{model}} · совместим с OpenAI · один ключ, все модели",
    "{{official}} official": "{{official}} официальный",
    "* Illustrative pricing — see flatkey pricing page": "* Ориентировочные цены — см. страницу тарифов flatkey",
    "/ million output tokens": "/ млн выходных токенов",
    "/ second": "/ секунду",
    "# Your existing OpenAI code:": "# Ваш текущий код OpenAI:",
    "30–50% cheaper": "на 30–50% дешевле",
    "50% bonus": "бонус 50%",
    "Est. this run": "Оценка за этот запуск",
    "First top-up": "Первое пополнение",
    "flatkey · same model, same quality": "flatkey · та же модель, то же качество",
    "Google / GitHub one-click · no credit card to start": "Google / GitHub в один клик · без карты для старта",
    "migrate.py — change one line": "migrate.py — измените одну строку",
    "Pay to unlock · credited instantly · not a free-signup giveaway": "Оплатите, чтобы разблокировать · зачисляется мгновенно · это не бесплатный бонус за регистрацию",
    "Playground (edit before sign-up)": "Playground (правьте до регистрации)",
    "Pricing vs official": "Цены против официальных",
    "Same {{official}} upstream, same quality — flatkey costs half. Change one line of base_url and your existing OpenAI SDK just works. Try it below, sign in when you are ready.":
      "Тот же upstream {{official}}, то же качество — flatkey стоит вдвое дешевле. Измените одну строку base_url, и ваш текущий OpenAI SDK продолжит работать. Попробуйте ниже и войдите, когда будете готовы.",
    "Sign in to claim →": "Войдите, чтобы получить →",
    "Starter / individual": "Начальный / индивидуальный",
    "Team / high-volume": "Команда / большой объём",
    "The same {{model}},": "Та же {{model}},",
    "Top up $1000 get $500": "Пополните $1000 получите $500",
    "Top up $200 get $100": "Пополните $200 получите $100",
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
    "Yes. Prepaid balance, usage analytics, and one invoice keep spend bounded.": "Да. Предоплаченный баланс, аналитика и единый счет держат расход под контролем.",
    "50% off": "скидка 50%",
  },
  ja: {
    "↓ Save 50% — double your token budget": "↓ 50% 節約 — トークン予算が倍に",
    "▶ Sign in to run": "▶ サインインして実行",
    "(flatkey · official ≈ {{price}})": "(flatkey · 公式 ≈ {{price}})",
    "{{model}} · OpenAI-compatible · one key, all models": "{{model}} · OpenAI 互換 · 1つのキーで全モデル",
    "{{official}} official": "{{official}} 公式",
    "* Illustrative pricing — see flatkey pricing page": "* 参考価格 — flatkey の料金ページをご覧ください",
    "/ million output tokens": "/ 出力トークン100万あたり",
    "/ second": "/ 秒",
    "# Your existing OpenAI code:": "# 既存の OpenAI コード:",
    "30–50% cheaper": "30〜50% 安い",
    "50% bonus": "50% ボーナス",
    "Est. this run": "今回の概算",
    "First top-up": "初回チャージ",
    "flatkey · same model, same quality": "flatkey · 同じモデル、同じ品質",
    "Google / GitHub one-click · no credit card to start": "Google / GitHub ワンクリック · クレジットカード不要で開始",
    "migrate.py — change one line": "migrate.py — 1行変更するだけ",
    "Pay to unlock · credited instantly · not a free-signup giveaway": "支払いで解放 · 即時反映 · 無料登録特典ではありません",
    "Playground (edit before sign-up)": "プレイグラウンド（登録前に編集可）",
    "Pricing vs official": "公式との価格比較",
    "Same {{official}} upstream, same quality — flatkey costs half. Change one line of base_url and your existing OpenAI SDK just works. Try it below, sign in when you are ready.":
      "同じ {{official}} upstream、同じ品質で、flatkey は半額です。base_url を1行変えるだけで既存の OpenAI SDK がそのまま動きます。下で試して、準備ができたらサインインしてください。",
    "Sign in to claim →": "サインインして受け取る →",
    "Starter / individual": "スターター / 個人",
    "Team / high-volume": "チーム / 大量利用",
    "The same {{model}},": "同じ {{model}}、",
    "Top up $1000 get $500": "$1000 チャージで $500 進呈",
    "Top up $200 get $100": "$200 チャージで $100 進呈",
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
    "Yes. Prepaid balance, usage analytics, and one invoice keep spend bounded.": "はい。プリペイド残高、利用分析、統一請求で支出を管理できます。",
    "50% off": "50% オフ",
  },
  vi: {
    "↓ Save 50% — double your token budget": "↓ Tiết kiệm 50% — nhân đôi ngân sách token",
    "▶ Sign in to run": "▶ Đăng nhập để chạy",
    "(flatkey · official ≈ {{price}})": "(flatkey · chính thức ≈ {{price}})",
    "{{model}} · OpenAI-compatible · one key, all models": "{{model}} · tương thích OpenAI · một khóa, mọi mô hình",
    "{{official}} official": "{{official}} chính thức",
    "* Illustrative pricing — see flatkey pricing page": "* Giá minh họa — xem trang giá của flatkey",
    "/ million output tokens": "/ triệu token đầu ra",
    "/ second": "/ giây",
    "# Your existing OpenAI code:": "# Mã OpenAI hiện có của bạn:",
    "30–50% cheaper": "rẻ hơn 30–50%",
    "50% bonus": "thưởng 50%",
    "Est. this run": "Ước tính lần chạy này",
    "First top-up": "Nạp lần đầu",
    "flatkey · same model, same quality": "flatkey · cùng mô hình, cùng chất lượng",
    "Google / GitHub one-click · no credit card to start": "Google / GitHub một chạm · không cần thẻ tín dụng để bắt đầu",
    "migrate.py — change one line": "migrate.py — đổi một dòng",
    "Pay to unlock · credited instantly · not a free-signup giveaway": "Thanh toán để mở khóa · ghi có tức thì · không phải quà tặng đăng ký miễn phí",
    "Playground (edit before sign-up)": "Playground (chỉnh sửa trước khi đăng ký)",
    "Pricing vs official": "Giá so với chính thức",
    "Same {{official}} upstream, same quality — flatkey costs half. Change one line of base_url and your existing OpenAI SDK just works. Try it below, sign in when you are ready.":
      "Cùng upstream {{official}}, cùng chất lượng — flatkey chỉ tốn một nửa. Đổi một dòng base_url và SDK OpenAI hiện có của bạn sẽ hoạt động. Thử bên dưới, rồi đăng nhập khi bạn sẵn sàng.",
    "Sign in to claim →": "Đăng nhập để nhận →",
    "Starter / individual": "Khởi đầu / cá nhân",
    "Team / high-volume": "Nhóm / khối lượng lớn",
    "The same {{model}},": "Cùng {{model}},",
    "Top up $1000 get $500": "Nạp $1000 nhận $500",
    "Top up $200 get $100": "Nạp $200 nhận $100",
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
    "Yes. Prepaid balance, usage analytics, and one invoice keep spend bounded.": "Có. Số dư trả trước, phân tích sử dụng và một hóa đơn giúp kiểm soát chi phí.",
    "50% off": "giảm 50%",
  },
  de: {
    "↓ Save 50% — double your token budget": "↓ 50% sparen — dein Token-Budget verdoppeln",
    "▶ Sign in to run": "▶ Zum Ausführen anmelden",
    "(flatkey · official ≈ {{price}})": "(flatkey · offiziell ≈ {{price}})",
    "{{model}} · OpenAI-compatible · one key, all models": "{{model}} · OpenAI-kompatibel · ein Schlüssel, alle Modelle",
    "{{official}} official": "{{official}} offiziell",
    "* Illustrative pricing — see flatkey pricing page": "* Beispielpreise — siehe flatkey-Preisseite",
    "/ million output tokens": "/ Million Output-Tokens",
    "/ second": "/ Sekunde",
    "# Your existing OpenAI code:": "# Dein vorhandener OpenAI-Code:",
    "30–50% cheaper": "30–50% günstiger",
    "50% bonus": "50% Bonus",
    "Est. this run": "Schätzung für diesen Lauf",
    "First top-up": "Erste Aufladung",
    "flatkey · same model, same quality": "flatkey · gleiches Modell, gleiche Qualität",
    "Google / GitHub one-click · no credit card to start": "Google / GitHub mit einem Klick · keine Kreditkarte nötig zum Start",
    "migrate.py — change one line": "migrate.py — eine Zeile ändern",
    "Pay to unlock · credited instantly · not a free-signup giveaway": "Zum Freischalten bezahlen · sofort gutgeschrieben · kein kostenloses Anmeldegeschenk",
    "Playground (edit before sign-up)": "Playground (vor der Anmeldung bearbeiten)",
    "Pricing vs official": "Preise im Vergleich zum offiziellen Anbieter",
    "Same {{official}} upstream, same quality — flatkey costs half. Change one line of base_url and your existing OpenAI SDK just works. Try it below, sign in when you are ready.":
      "Gleiches {{official}}-Upstream, gleiche Qualität — flatkey kostet die Hälfte. Ändere eine Zeile base_url und dein vorhandenes OpenAI-SDK läuft einfach weiter. Probiere es unten aus und melde dich an, wenn du bereit bist.",
    "Sign in to claim →": "Zum Einlösen anmelden →",
    "Starter / individual": "Starter / Einzelperson",
    "Team / high-volume": "Team / hohes Volumen",
    "The same {{model}},": "Das gleiche {{model}},",
    "Top up $1000 get $500": "$1000 aufladen, $500 erhalten",
    "Top up $200 get $100": "$200 aufladen, $100 erhalten",
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
    "Yes. Prepaid balance, usage analytics, and one invoice keep spend bounded.": "Ja. Prepaid-Guthaben, Nutzungsanalyse und eine Rechnung halten Kosten begrenzt.",
    "50% off": "50% Rabatt",
  },
};

export function modelLandingCopy(locale: Locale, key: ModelLandingKey, vars: Record<string, string> = {}) {
  let value = translations[locale][key] ?? translations.en[key] ?? key;
  for (const [name, replacement] of Object.entries(vars)) {
    value = value.replaceAll(`{{${name}}}`, replacement);
  }
  return value;
}
