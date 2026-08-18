import { buildConsoleUrl } from "@/lib/origins";
import { LOCALES, type Locale } from "@/lib/locales";
import type { SeoInput } from "@/lib/seo";

// SKAG (single-keyword ad group) landing pages for Google Ads paid search.
// Each page maps 1:1 to one high-value search keyword and its H1 must echo
// that query exactly, so the ad → landing message match stays tight.
// Most routes are English-only. Localized variants are added only when there
// is dedicated acquisition copy for that market.

export const SKAG_LANDING_SLUGS = [
  "gpt-api",
  "gpt-api-alternative",
  "chinese-ai",
  "chinese-ai-models-api",
  "deepseek-api",
  "claude-api",
  "kimi-api",
  "qwen-api",
  "openai-compatible",
  "gateway",
] as const;

export type SkagLandingSlug = (typeof SKAG_LANDING_SLUGS)[number];

export type SkagLandingConfig = {
  slug: SkagLandingSlug;
  locale?: Locale;
  pathname?: string;
  /** The paid-search keyword this page belongs to (for reference/tests). */
  keyword: string;
  badge: string;
  /** H1 split so the accent part can be gradient-styled; lead + " " + accent must echo the ad keyword exactly. */
  h1Lead: string;
  h1Accent: string;
  description: string;
  ctaLabel: string;
  secondaryCtaLabel?: string;
  hideSecondaryCta?: boolean;
  compactHero?: boolean;
  hideCodeWindow?: boolean;
  trustLine?: string;
  /** Shown under the price table. */
  priceFootnote: string;
  pricingTitle: string;
  pricingColumns?: { platform: string; reference: string };
  priceRows: Array<{ label: string; flatkey: string; official: string }>;
  /** Model id used in the runnable curl / Python example. */
  exampleModel: string;
  codeTitle: string;
  features: Array<{ title: string; body: string; link?: { label: string; href: string } }>;
  faq: Array<{ question: string; answer: string }>;
  seo: {
    title: string;
    description: string;
  };
};

export const SKAG_COVERAGE_LINE = "GPT · Gemini · Claude · DeepSeek · Kimi · Seedance";
export const SKAG_TRUST_LINE = `${SKAG_COVERAGE_LINE} — one key, one invoice · no credit card to start`;

const SHARED_FAQ: SkagLandingConfig["faq"] = [
  {
    question: "Do I have to change my code?",
    answer:
      "No. flatkey.ai is OpenAI-compatible: keep your existing OpenAI SDK and switch base_url plus api_key. Model ids stay the same.",
  },
  {
    question: "How is billing handled across models?",
    answer:
      "One plan covers every model. Usage analytics and a single invoice keep spend bounded before you scale.",
  },
];

const GPT_API: SkagLandingConfig = {
  slug: "gpt-api",
  keyword: "gpt api",
  badge: "GPT-5.6 · GPT-5.5 · GPT-5.4 · GPT Image",
  h1Lead: "GPT",
  h1Accent: "API",
  description:
    "Call the latest GPT models through one OpenAI-compatible API key. Use GPT-5.6 Sol, Luna, and Terra, GPT-5.5, GPT-5.4, GPT-5 mini, GPT-4o, and GPT Image 2 from the same Flatkey account.",
  ctaLabel: "Get your GPT API key",
  hideSecondaryCta: true,
  compactHero: true,
  hideCodeWindow: true,
  pricingTitle: "GPT API access",
  priceRows: [
    { label: "GPT-5.5 output / 1M tokens", flatkey: "$10.00", official: "$15.00" },
    { label: "GPT-5.4 and GPT-5 mini", flatkey: "One key", official: "Separate setup" },
    { label: "GPT-4o and GPT Image 2", flatkey: "One key", official: "Separate setup" },
  ],
  priceFootnote: "* Representative coverage — see live pricing for current GPT model rates and availability.",
  exampleModel: "gpt-5.5",
  codeTitle: "Call GPT through /v1",
  features: [
    {
      title: "Latest GPT model coverage",
      body: "Use GPT-5.6 Sol, Luna, and Terra, GPT-5.5, GPT-5.4, GPT-5 mini, GPT-4o, GPT-4.1 mini, and GPT Image 2 from one catalog as they are available.",
    },
    {
      title: "OpenAI-compatible API",
      body: "Keep the OpenAI SDK already in your application. Change base_url, set a Flatkey API key, and choose the GPT model id you need.",
    },
    {
      title: "Text and image workloads",
      body: "Route chat, coding, automation, content, and image generation through one account with pricing visibility before you scale.",
    },
    {
      title: "One account for model comparison",
      body: "Compare GPT with Claude, Gemini, DeepSeek, Qwen, Kimi, and GLM without creating separate provider accounts or changing your API integration.",
    },
  ],
  faq: [
    {
      question: "Which GPT models can I use?",
      answer:
        "Current catalog coverage includes GPT-5.6 Sol, GPT-5.6 Luna, GPT-5.6 Terra, GPT-5.5, GPT-5.4, GPT-5.4 mini, GPT-5.4 nano, GPT-5 mini, GPT-4o, GPT-4o mini, GPT-4.1 mini, and GPT Image 2 when available.",
    },
    {
      question: "Can I use my existing OpenAI SDK?",
      answer:
        "Yes. Point the SDK at the Flatkey /v1 base URL, use a Flatkey API key, and choose the GPT model id you need, such as gpt-5.5.",
    },
    ...SHARED_FAQ,
  ],
  seo: {
    title: "GPT API — OpenAI-compatible access to GPT-5.6, GPT-5.5 and GPT Image",
    description:
      "Use GPT-5.6, GPT-5.5, GPT-5.4, GPT-4o and GPT Image models through one OpenAI-compatible API key. Keep your SDK and manage GPT with other frontier models.",
  },
};

const PT_GPT_API: SkagLandingConfig = {
  slug: "gpt-api",
  locale: "pt",
  pathname: "/gpt-api",
  keyword: "gpt api",
  badge: "GPT-5.6 · GPT-5.5 · GPT-5.4 · GPT Image",
  h1Lead: "API GPT",
  h1Accent: "para texto e imagem",
  description:
    "Use os modelos GPT mais recentes com uma única chave de API compatível com OpenAI. Acesse GPT-5.6 Sol, Luna e Terra, GPT-5.5, GPT-5.4, GPT-5 mini, GPT-4o e GPT Image 2 na mesma conta Flatkey.",
  ctaLabel: "Obter chave da API GPT",
  hideSecondaryCta: true,
  compactHero: true,
  hideCodeWindow: true,
  trustLine: "GPT · Claude · Gemini · DeepSeek · Qwen · Kimi — uma chave, uma fatura · sem cartão de crédito para começar",
  pricingTitle: "Acesso à API GPT",
  priceRows: [
    { label: "GPT-5.5 saída / 1M tokens", flatkey: "$10.00", official: "$15.00" },
    { label: "GPT-5.4 e GPT-5 mini", flatkey: "Uma chave", official: "Configuração separada" },
    { label: "GPT-4o e GPT Image 2", flatkey: "Uma chave", official: "Configuração separada" },
  ],
  priceFootnote: "* Cobertura representativa — consulte os preços ao vivo para taxas e disponibilidade atuais dos modelos GPT.",
  exampleModel: "gpt-5.5",
  codeTitle: "Chame GPT via /v1",
  features: [
    {
      title: "Modelos GPT mais recentes",
      body: "Use GPT-5.6 Sol, Luna e Terra, GPT-5.5, GPT-5.4, GPT-5 mini, GPT-4o, GPT-4.1 mini e GPT Image 2 em um único catálogo conforme disponibilidade.",
    },
    {
      title: "API compatível com OpenAI",
      body: "Mantenha o SDK da OpenAI que sua equipe já usa. Altere base_url, use uma chave Flatkey e escolha o ID do modelo GPT necessário.",
    },
    {
      title: "Texto e imagem em uma conta",
      body: "Encaminhe chat, código, automação, conteúdo e geração de imagem pela mesma conta, com preços visíveis antes de escalar.",
    },
    {
      title: "Compare modelos sem novas contas",
      body: "Compare GPT com Claude, Gemini, DeepSeek, Qwen, Kimi e GLM sem abrir contas separadas de fornecedor nem mudar sua integração de API.",
    },
  ],
  faq: [
    {
      question: "Quais modelos GPT posso usar?",
      answer:
        "A cobertura atual do catálogo inclui GPT-5.6 Sol, GPT-5.6 Luna, GPT-5.6 Terra, GPT-5.5, GPT-5.4, GPT-5.4 mini, GPT-5.4 nano, GPT-5 mini, GPT-4o, GPT-4o mini, GPT-4.1 mini e GPT Image 2 quando disponíveis.",
    },
    {
      question: "Posso usar meu SDK atual da OpenAI?",
      answer:
        "Sim. Aponte o SDK para a base URL /v1 da Flatkey, use uma chave de API Flatkey e escolha o ID do modelo GPT necessário, como gpt-5.5.",
    },
    {
      question: "Preciso alterar meu código?",
      answer:
        "Não. A Flatkey é compatível com OpenAI: mantenha seu SDK e troque base_url e api_key. Os IDs dos modelos permanecem iguais.",
    },
    {
      question: "Como funciona a cobrança entre modelos?",
      answer:
        "Uma conta cobre os modelos compatíveis. Os preços ao vivo e o uso por modelo ajudam a manter o gasto visível antes de escalar.",
    },
  ],
  seo: {
    title: "API GPT no Brasil — GPT-5.6, GPT-5.5 e GPT Image via OpenAI SDK",
    description:
      "Use GPT-5.6, GPT-5.5, GPT-5.4, GPT-4o e GPT Image com uma chave de API compatível com OpenAI. Mantenha seu SDK e gerencie GPT em uma só conta.",
  },
};

const GPT_API_ALTERNATIVE: SkagLandingConfig = {
  slug: "gpt-api-alternative",
  keyword: "chat gpt api alternative",
  badge: "OpenAI-compatible drop-in",
  h1Lead: "ChatGPT API",
  h1Accent: "Alternative",
  description:
    "Same GPT models, lower per-token price. flatkey.ai is OpenAI-compatible — switch base_url in one line and keep your SDK, plus get Gemini, Claude, and DeepSeek on the same key with unified billing.",
  ctaLabel: "Get your API key",
  pricingTitle: "Pricing vs official",
  priceRows: [
    { label: "GPT-5 output / 1M tokens", flatkey: "$6.67", official: "$10.00" },
    { label: "GPT-5 mini output / 1M tokens", flatkey: "$1.33", official: "$2.00" },
    { label: "GPT-5 input / 1M tokens", flatkey: "$0.83", official: "$1.25" },
  ],
  priceFootnote: "* Illustrative pricing — see the flatkey pricing page for live rates.",
  exampleModel: "gpt-5",
  codeTitle: "Switch base_url in one line",
  features: [
    {
      title: "Same models, cheaper tokens",
      body: "GPT models priced at roughly two-thirds of official — included in every flatkey plan from $10/month.",
    },
    {
      title: "One-line migration",
      body: "Point your existing OpenAI SDK at a new base_url with a flatkey key. No new SDK, no request rewrites, no vendor lock-in.",
    },
    {
      title: "Every major model on one key",
      body: "GPT, Gemini, Claude, DeepSeek, and Seedance behind the same endpoint — swap the model id instead of managing five accounts.",
    },
    {
      title: "Unified billing",
      body: "One subscription, usage analytics, and a single invoice across all providers instead of five separate bills.",
    },
  ],
  faq: SHARED_FAQ,
  seo: {
    title: "ChatGPT API Alternative — same GPT models, cheaper, one key",
    description:
      "OpenAI-compatible ChatGPT API alternative: switch base_url in one line, pay less per token, and call GPT, Gemini, Claude, and DeepSeek with one key and unified billing.",
  },
};

const CHINESE_AI: SkagLandingConfig = {
  slug: "chinese-ai",
  keyword: "chinese ai",
  badge: "GLM · Qwen · DeepSeek · Kimi",
  h1Lead: "Chinese AI Models,",
  h1Accent: "One API",
  description:
    "Call GLM, Qwen, DeepSeek, and Kimi through one OpenAI-compatible key — no Chinese phone number, no mainland account, no separate vendor consoles. Pay in USD or your local payment method.",
  ctaLabel: "Get your API key",
  pricingTitle: "Output price vs official",
  priceRows: [
    { label: "Kimi K2.5 / 1M tokens", flatkey: "$1.20", official: "$3.00" },
    { label: "DeepSeek V4 Flash / 1M tokens", flatkey: "$0.07", official: "$0.14" },
    { label: "Qwen 3.7 Plus / 1M tokens", flatkey: "$0.24", official: "$0.40" },
    { label: "GLM 5.2 / 1M tokens", flatkey: "$0.56", official: "$1.40" },
  ],
  priceFootnote: "* Illustrative pricing — see the flatkey pricing page for live rates.",
  exampleModel: "deepseek-v4-flash",
  codeTitle: "One key for every Chinese frontier model",
  features: [
    {
      title: "No mainland account needed",
      body: "Skip Chinese phone verification, local ID, and mainland billing accounts. Sign up with Google or GitHub and start calling models.",
    },
    {
      title: "GLM, Qwen, DeepSeek, Kimi",
      body: "The Chinese frontier models behind one endpoint — compare them against GPT, Gemini, and Claude by swapping a model id.",
    },
    {
      title: "Pay in USD or local methods",
      body: "Top up in USD with international cards or local payment methods. No RMB accounts or cross-border transfers.",
    },
    {
      title: "OpenAI-compatible",
      body: "Your existing OpenAI SDK works as-is: change base_url and api_key, keep everything else.",
    },
  ],
  faq: [
    {
      question: "Do I need a Chinese phone number or company?",
      answer:
        "No. flatkey.ai fronts the upstream providers for you — sign up with Google or GitHub and call GLM, Qwen, DeepSeek, and Kimi immediately.",
    },
    ...SHARED_FAQ,
  ],
  seo: {
    title: "Chinese AI Models API — GLM, Qwen, DeepSeek, Kimi with one key",
    description:
      "Use Chinese AI models — GLM, Qwen, DeepSeek, Kimi — through one OpenAI-compatible API key. No Chinese phone number or mainland account; pay in USD or local methods.",
  },
};

const CHINESE_AI_MODELS_API: SkagLandingConfig = {
  slug: "chinese-ai-models-api",
  keyword: "chinese ai models api",
  badge: "DeepSeek · Qwen · GLM · Kimi · Seedance",
  h1Lead: "Chinese AI Models",
  h1Accent: "API",
  description:
    "Run DeepSeek, Qwen, GLM, Kimi, and Seedance from one OpenAI-compatible API. One flatkey key replaces mainland vendor accounts, separate top-ups, and provider-specific SDK work.",
  ctaLabel: "Get your Chinese model API key",
  pricingTitle: "Live-ready model coverage",
  priceRows: [
    { label: "DeepSeek V4 Flash / 1M tokens", flatkey: "$0.056", official: "$0.14" },
    { label: "GLM 5.2 / 1M tokens", flatkey: "$0.56", official: "$1.40" },
    { label: "Seedance 2.5 video", flatkey: "Usage-based", official: "Vendor-only" },
    { label: "Qwen, Kimi, Hunyuan, Wan", flatkey: "One key", official: "Separate accounts" },
  ],
  priceFootnote: "* Representative catalog coverage — see live pricing for the current per-model rates and access status.",
  exampleModel: "deepseek-v4-flash",
  codeTitle: "Call Chinese AI models through /v1",
  features: [
    {
      title: "China model coverage",
      body: "DeepSeek, Qwen, GLM, Kimi, Seedance, Kling, Wan, Hailuo, Vidu, MiniMax, Tencent Hunyuan, Baidu ERNIE, and more behind one catalog.",
    },
    {
      title: "OpenAI-compatible API",
      body: "Use the OpenAI SDK you already have. Change base_url, set a flatkey API key, and swap model ids like deepseek-v4-flash or glm-5.2.",
    },
    {
      title: "No mainland vendor setup",
      body: "Avoid Chinese phone verification, RMB top-ups, local billing profiles, and separate provider consoles when testing or shipping Chinese AI models.",
    },
    {
      title: "Text, reasoning, and video",
      body: "Route chat, coding, reasoning, and video generation through the same account, with unified spend controls and one invoice.",
    },
  ],
  faq: [
    {
      question: "Which Chinese AI model families can I test?",
      answer:
        "Start with DeepSeek, Qwen, GLM, Kimi, and Seedance, then compare other China model families such as Kling, Wan, Hailuo, Vidu, MiniMax, Hunyuan, and ERNIE as they appear in the catalog.",
    },
    {
      question: "Is this API compatible with OpenAI SDKs?",
      answer:
        "Yes. Keep your OpenAI SDK and point it at the flatkey /v1 base URL. The request shape stays familiar; only the base_url, api_key, and model id change.",
    },
    {
      question: "Do I need a Chinese phone number, RMB account, or local company?",
      answer:
        "No. flatkey.ai gives international teams one account, one key, and one billing flow for Chinese AI models without managing each mainland vendor account directly.",
    },
    ...SHARED_FAQ,
  ],
  seo: {
    title: "Chinese AI Models API — DeepSeek, Qwen, GLM, Kimi, Seedance",
    description:
      "Use a Chinese AI models API for DeepSeek, Qwen, GLM, Kimi, Seedance, and more through one OpenAI-compatible key. No mainland vendor accounts or SDK rewrites.",
  },
};

const PT_CHINESE_AI_MODELS_API: SkagLandingConfig = {
  slug: "chinese-ai-models-api",
  locale: "pt",
  pathname: "/chinese-ai-models-api",
  keyword: "api de modelos chineses de ia",
  badge: "Acesso internacional · API compatível com OpenAI",
  h1Lead: "Modelos chineses de IA",
  h1Accent: "via API",
  description:
    "Compare os principais modelos chineses — texto, código, raciocínio e vídeo — em uma única conta, sem criar contas em vários provedores.",
  ctaLabel: "Crie sua chave de API grátis",
  hideSecondaryCta: true,
  compactHero: true,
  hideCodeWindow: true,
  trustLine: "Uma conta · uma chave · uma cobrança · sem cartão de crédito para começar",
  pricingTitle: "Preços de referência · US$ por 1 milhão de tokens",
  pricingColumns: { platform: "Flatkey", reference: "Referência" },
  priceRows: [
    { label: "DeepSeek V4 Flash", flatkey: "$0.056", official: "$0.14" },
    { label: "GLM 5.2", flatkey: "$0.56", official: "$1.40" },
    { label: "Vídeo Seedance 2.5", flatkey: "Por uso", official: "Apenas fornecedor" },
    { label: "Qwen, Kimi, Hunyuan, Wan", flatkey: "Uma chave", official: "Contas separadas" },
  ],
  priceFootnote: "* Valores ilustrativos em USD por 1M de tokens. Consulte os preços ao vivo para a taxa atual, unidade de cobrança e disponibilidade de cada modelo.",
  exampleModel: "deepseek-v4-flash",
  codeTitle: "Chame modelos chineses de IA via /v1",
  features: [
    {
      title: "Uma chave em vez de vários cadastros",
      body: "Na Flatkey, use uma API key e uma cobrança para comparar DeepSeek, Qwen, GLM e Kimi, sem abrir contas em vários provedores.",
    },
    {
      title: "Seu SDK continua funcionando",
      body: "Mantenha o SDK da OpenAI que sua equipe já usa. Altere base_url, api_key e model id — sem reescrever a integração para cada fornecedor.",
    },
    {
      title: "Acesso fácil aos modelos chineses de IA",
      body: "Use DeepSeek, Qwen, GLM e Kimi por uma única API compatível com OpenAI, sem precisar gerenciar várias integrações.",
    },
    {
      title: "Modelos de classe mundial para texto, código, raciocínio e vídeo",
      body: "Acesse modelos de classe mundial em um único catálogo para criar, programar, raciocinar e gerar vídeos, escolhendo o modelo certo para cada tarefa.",
    },
  ],
  faq: [
    {
      question: "Por que usar modelos chineses em vez de apenas GPT ou Claude?",
      answer:
        "Você pode comparar diferentes modelos para código, raciocínio, atendimento, conteúdo e vídeo em uma única conta. O catálogo e os preços ao vivo ajudam a escolher por tarefa, capacidade e custo.",
    },
    {
      question: "Quais modelos chineses de IA posso testar?",
      answer:
        "Comece com DeepSeek, Qwen, GLM e Kimi. Modelos de vídeo, como Seedance, Kling, Wan e Hailuo, aparecem no catálogo conforme disponibilidade e usam seus próprios formatos e regras de cobrança.",
    },
    {
      question: "Posso usar meu SDK atual da OpenAI?",
      answer:
        "Sim. Aponte o SDK para a base URL /v1 da flatkey, use uma chave de API flatkey e escolha o ID do modelo. O formato da requisição permanece compatível com OpenAI.",
    },
    {
      question: "Consigo usar a Flatkey a partir do Brasil?",
      answer:
        "Sim. A Flatkey reúne os modelos em uma conta para equipes internacionais, com preços em USD e opções de pagamento exibidas no fluxo de compra. Consulte as condições aplicáveis antes de escalar o uso.",
    },
    {
      question: "Como os preços são calculados?",
      answer:
        "Os valores variam por modelo e unidade de cobrança. Veja a tabela como referência e confirme o preço ao vivo no catálogo antes de integrar ou aumentar o volume.",
    },
  ],
  seo: {
    title: "Modelos chineses de IA via API no Brasil — DeepSeek, Qwen e GLM",
    description:
      "Compare DeepSeek, Qwen, GLM e Kimi com uma única API compatível com OpenAI. Acesse do Brasil sem gerenciar várias contas de fornecedores e consulte preços ao vivo.",
  },
};

const DEEPSEEK_API: SkagLandingConfig = {
  slug: "deepseek-api",
  keyword: "deepseek api",
  badge: "Stable API · coding · token pricing",
  h1Lead: "Stable",
  h1Accent: "DeepSeek API",
  description:
    "Use DeepSeek for code and automation through one OpenAI-compatible API key. Keep your SDK, switch base_url and api_key, and get stable access with live per-token pricing in one account.",
  ctaLabel: "Get your DeepSeek API key",
  hideSecondaryCta: true,
  compactHero: true,
  hideCodeWindow: true,
  pricingTitle: "Stable DeepSeek API access",
  priceRows: [
    { label: "deepseek-v3 / 1M tokens", flatkey: "$0.34", official: "$0.4" },
    { label: "deepseek-v4-flash / 1M tokens", flatkey: "$0.374", official: "$0.44" },
    { label: "deepseek-v4-pro / 1M tokens", flatkey: "$1.122", official: "$1.32" },
  ],
  priceFootnote: "* Representative coverage — see live pricing for current model rates and availability.",
  exampleModel: "deepseek-v4-flash",
  codeTitle: "Call DeepSeek through /v1",
  features: [
    {
      title: "Stable access for production",
      body: "Route DeepSeek requests through one managed API with over 98% availability instead of depending on a single provider console when availability matters to your application.",
    },
    {
      title: "OpenAI-compatible API",
      body: "Keep the OpenAI SDK already in your application. Change base_url, set a flatkey API key, and select a DeepSeek model id without major code changes, ready to use immediately.",
    },
    {
      title: "Transparent DeepSeek pricing",
      body: "Check prices per 1M tokens, official price comparison, latency, and health score for DeepSeek models before you scale code and automation.",
      link: { label: "See live DeepSeek pricing", href: "/models?vendor=DeepSeek" },
    },
    {
      title: "One account for model comparison",
      body: "Compare DeepSeek with GPT, Claude, Gemini, Qwen, and GLM in the same model directory without creating separate provider accounts or changing your API integration.",
      link: { label: "See all models", href: "/models" },
    },
  ],
  faq: [
    {
      question: "Can I use DeepSeek for code and automation?",
      answer:
        "Yes. Use the OpenAI-compatible API for coding and automation workflows, then check live pricing for the current DeepSeek model list and access status.",
    },
    {
      question: "Can I use my existing OpenAI SDK?",
      answer:
        "Yes. Point the SDK at the flatkey /v1 base URL, use a flatkey API key, and choose the DeepSeek model id you need.",
    },
    ...SHARED_FAQ,
  ],
  seo: {
    title: "Stable DeepSeek API — OpenAI-compatible access for code and automation",
    description:
      "Use a stable, OpenAI-compatible DeepSeek API for code and automation. Keep your SDK, check live per-token pricing, and manage DeepSeek in one account.",
  },
};

const PT_DEEPSEEK_API: SkagLandingConfig = {
  slug: "deepseek-api",
  locale: "pt",
  pathname: "/deepseek-api",
  keyword: "deepseek api",
  badge: "API estável · código · preço por token",
  h1Lead: "API DeepSeek",
  h1Accent: "estável para código",
  description:
    "Use DeepSeek para código e automação com uma única chave de API compatível com OpenAI. Mantenha o SDK que sua equipe já usa, altere base_url e api_key e acompanhe preços por token em uma só conta.",
  ctaLabel: "Obter chave da API DeepSeek",
  hideSecondaryCta: true,
  compactHero: true,
  hideCodeWindow: true,
  trustLine: "DeepSeek · GPT · Claude · Gemini · Qwen · GLM — uma chave, uma fatura · sem cartão de crédito para começar",
  pricingTitle: "Acesso estável à API DeepSeek",
  priceRows: [
    { label: "deepseek-v3 / 1M tokens", flatkey: "$0.34", official: "$0.4" },
    { label: "deepseek-v4-flash / 1M tokens", flatkey: "$0.374", official: "$0.44" },
    { label: "deepseek-v4-pro / 1M tokens", flatkey: "$1.122", official: "$1.32" },
  ],
  priceFootnote: "* Cobertura representativa — veja os preços ao vivo para taxas e disponibilidade atuais.",
  exampleModel: "deepseek-v4-flash",
  codeTitle: "Chame DeepSeek via /v1",
  features: [
    {
      title: "Acesso estável para produção",
      body: "Encaminhe chamadas DeepSeek por uma API gerenciada com disponibilidade acima de 98%, em vez de depender de um único console de fornecedor quando a disponibilidade importa para seu aplicativo.",
    },
    {
      title: "API compatível com OpenAI",
      body: "Mantenha o SDK da OpenAI que já existe no seu aplicativo. Altere base_url, use uma chave flatkey e escolha o ID do modelo DeepSeek, sem grandes mudanças no código e pronto para usar imediatamente.",
    },
    {
      title: "Preços DeepSeek transparentes",
      body: "Confira preços por 1M tokens, comparação com preço oficial, latência e pontuação de saúde dos modelos DeepSeek antes de escalar código e automação.",
      link: { label: "Veja a lista ao vivo", href: "/pt/models?vendor=DeepSeek" },
    },
    {
      title: "Compare modelos sem novas contas",
      body: "Compare DeepSeek com GPT, Claude, Gemini, Qwen e GLM no mesmo diretório de modelos, sem abrir contas separadas de fornecedor nem mudar sua integração de API.",
      link: { label: "Veja todos os modelos", href: "/pt/models" },
    },
  ],
  faq: [
    {
      question: "Posso usar DeepSeek para código e automação?",
      answer:
        "Sim. Use a API compatível com OpenAI para fluxos de código e automação e consulte os preços ao vivo para a lista atual de modelos DeepSeek e o status de acesso.",
    },
    {
      question: "Posso usar meu SDK atual da OpenAI?",
      answer:
        "Sim. Aponte o SDK para a base URL /v1 da flatkey, use uma chave de API flatkey e escolha o ID do modelo DeepSeek necessário.",
    },
    {
      question: "Preciso alterar meu código?",
      answer:
        "Não. A flatkey.ai é compatível com OpenAI: mantenha seu SDK e troque base_url e api_key. Os IDs dos modelos permanecem iguais.",
    },
    {
      question: "Como funciona a cobrança entre modelos?",
      answer:
        "Uma conta cobre os modelos compatíveis. Os preços ao vivo e o uso por modelo ajudam a manter o gasto visível antes de escalar.",
    },
  ],
  seo: {
    title: "API DeepSeek estável no Brasil — para código e automação",
    description:
      "Use uma API DeepSeek estável e compatível com OpenAI para código e automação. Mantenha seu SDK, consulte preços por token e gerencie DeepSeek em uma só conta.",
  },
};

const CLAUDE_API: SkagLandingConfig = {
  slug: "claude-api",
  keyword: "claude api",
  badge: "Claude Opus · Sonnet · Haiku",
  h1Lead: "Claude",
  h1Accent: "API",
  description:
    "Call the latest Claude models through one OpenAI-compatible API key. Use Claude Opus 5, Sonnet 5, Opus 4.8, Sonnet 4.6, and Haiku 4.5 without a separate Anthropic setup.",
  ctaLabel: "Get your Claude API key",
  hideSecondaryCta: true,
  compactHero: true,
  hideCodeWindow: true,
  pricingTitle: "Claude API access",
  priceRows: [
    { label: "Claude Sonnet 5 output / 1M tokens", flatkey: "$9.00", official: "$10.00" },
    { label: "Claude Opus 5 and Opus 4.8", flatkey: "One key", official: "Separate setup" },
    { label: "Claude Sonnet 4.6 and Haiku 4.5", flatkey: "One key", official: "Separate setup" },
  ],
  priceFootnote: "* Representative coverage — see live pricing for current Claude model rates and availability.",
  exampleModel: "claude-sonnet-5",
  codeTitle: "Call Claude through /v1",
  features: [
    {
      title: "Latest Claude model coverage",
      body: "Use Claude Opus 5, Sonnet 5, Opus 4.8, Sonnet 4.6, Sonnet 4.5, and Haiku 4.5 from the same Flatkey account as they are available in the catalog.",
    },
    {
      title: "OpenAI-compatible API",
      body: "Keep the OpenAI SDK already in your application. Change base_url, set a Flatkey API key, and choose the Claude model id you need.",
    },
    {
      title: "Built for code, agents, and long documents",
      body: "Claude is a strong fit for coding agents, support automation, analysis workflows, and long-context reasoning where output quality matters.",
    },
    {
      title: "One account for model comparison",
      body: "Compare Claude with GPT, Gemini, DeepSeek, Qwen, Kimi, and GLM without creating separate provider accounts or changing your API integration.",
    },
  ],
  faq: [
    {
      question: "Which Claude models can I use?",
      answer:
        "Current catalog coverage includes Claude Opus 5, Claude Sonnet 5, Claude Opus 4.8, Claude Opus 4.7, Claude Opus 4.6, Claude Opus 4.5, Claude Sonnet 4.6, Claude Sonnet 4.5, and Claude Haiku 4.5 when available.",
    },
    {
      question: "Can I use my existing OpenAI SDK?",
      answer:
        "Yes. Point the SDK at the Flatkey /v1 base URL, use a Flatkey API key, and choose the Claude model id you need, such as claude-sonnet-5.",
    },
    ...SHARED_FAQ,
  ],
  seo: {
    title: "Claude API — OpenAI-compatible access to Opus, Sonnet and Haiku",
    description:
      "Use Claude Opus, Sonnet and Haiku models through one OpenAI-compatible API key. Keep your SDK, check live pricing, and manage Claude with other frontier models in one account.",
  },
};

const PT_CLAUDE_API: SkagLandingConfig = {
  slug: "claude-api",
  locale: "pt",
  pathname: "/claude-api",
  keyword: "claude api",
  badge: "Claude Opus · Sonnet · Haiku",
  h1Lead: "API Claude",
  h1Accent: "para código e agentes",
  description:
    "Use os modelos Claude mais recentes com uma única chave de API compatível com OpenAI. Acesse Claude Opus 5, Sonnet 5, Opus 4.8, Sonnet 4.6 e Haiku 4.5 sem configurar uma conta Anthropic separada.",
  ctaLabel: "Obter chave da API Claude",
  hideSecondaryCta: true,
  compactHero: true,
  hideCodeWindow: true,
  trustLine: "Claude · GPT · Gemini · DeepSeek · Qwen · Kimi — uma chave, uma fatura · sem cartão de crédito para começar",
  pricingTitle: "Acesso à API Claude",
  priceRows: [
    { label: "Claude Sonnet 5 saída / 1M tokens", flatkey: "$9.00", official: "$10.00" },
    { label: "Claude Opus 5 e Opus 4.8", flatkey: "Uma chave", official: "Configuração separada" },
    { label: "Claude Sonnet 4.6 e Haiku 4.5", flatkey: "Uma chave", official: "Configuração separada" },
  ],
  priceFootnote: "* Cobertura representativa — consulte os preços ao vivo para taxas e disponibilidade atuais dos modelos Claude.",
  exampleModel: "claude-sonnet-5",
  codeTitle: "Chame Claude via /v1",
  features: [
    {
      title: "Modelos Claude mais recentes",
      body: "Use Claude Opus 5, Sonnet 5, Opus 4.8, Sonnet 4.6, Sonnet 4.5 e Haiku 4.5 na mesma conta Flatkey conforme disponibilidade no catálogo.",
    },
    {
      title: "API compatível com OpenAI",
      body: "Mantenha o SDK da OpenAI que sua equipe já usa. Altere base_url, use uma chave Flatkey e escolha o ID do modelo Claude necessário.",
    },
    {
      title: "Para código, agentes e documentos longos",
      body: "Claude funciona bem para agentes de código, automação de suporte, análise de documentos e raciocínio com contexto longo quando qualidade de saída importa.",
    },
    {
      title: "Compare modelos sem novas contas",
      body: "Compare Claude com GPT, Gemini, DeepSeek, Qwen, Kimi e GLM sem abrir contas separadas de fornecedor nem mudar sua integração de API.",
    },
  ],
  faq: [
    {
      question: "Quais modelos Claude posso usar?",
      answer:
        "A cobertura atual do catálogo inclui Claude Opus 5, Claude Sonnet 5, Claude Opus 4.8, Claude Opus 4.7, Claude Opus 4.6, Claude Opus 4.5, Claude Sonnet 4.6, Claude Sonnet 4.5 e Claude Haiku 4.5 quando disponíveis.",
    },
    {
      question: "Posso usar meu SDK atual da OpenAI?",
      answer:
        "Sim. Aponte o SDK para a base URL /v1 da Flatkey, use uma chave de API Flatkey e escolha o ID do modelo Claude necessário, como claude-sonnet-5.",
    },
    {
      question: "Preciso alterar meu código?",
      answer:
        "Não. A Flatkey é compatível com OpenAI: mantenha seu SDK e troque base_url e api_key. Os IDs dos modelos permanecem iguais.",
    },
    {
      question: "Como funciona a cobrança entre modelos?",
      answer:
        "Uma conta cobre os modelos compatíveis. Os preços ao vivo e o uso por modelo ajudam a manter o gasto visível antes de escalar.",
    },
  ],
  seo: {
    title: "API Claude no Brasil — Opus, Sonnet e Haiku via OpenAI SDK",
    description:
      "Use Claude Opus, Sonnet e Haiku com uma chave de API compatível com OpenAI. Mantenha seu SDK, consulte preços ao vivo e gerencie Claude em uma só conta.",
  },
};

const KIMI_API: SkagLandingConfig = {
  slug: "kimi-api",
  keyword: "kimi k2.5 api",
  badge: "Kimi K2.5 · long context · agents",
  h1Lead: "Kimi K2.5",
  h1Accent: "API",
  description:
    "Call Kimi K2.5 through one OpenAI-compatible API key. Keep your existing SDK, switch base_url and api_key, and use one account for Kimi alongside DeepSeek, Qwen, and other supported models.",
  ctaLabel: "Get your Kimi K2.5 API key",
  hideSecondaryCta: true,
  compactHero: true,
  hideCodeWindow: true,
  pricingTitle: "Kimi K2.5 API access",
  priceRows: [
    { label: "Kimi K2.5 / 1M tokens", flatkey: "$1.20", official: "$3.00" },
    { label: "OpenAI SDK migration", flatkey: "base_url + key", official: "Provider SDK work" },
    { label: "Kimi and other models", flatkey: "One key", official: "Separate accounts" },
  ],
  priceFootnote: "* Representative coverage — see live pricing for current model rates and availability.",
  exampleModel: "kimi-k2.5",
  codeTitle: "Call Kimi through /v1",
  features: [
    {
      title: "Kimi K2.5 from one catalog",
      body: "Use Kimi K2.5 without a separate integration, then compare it with DeepSeek, Qwen, GPT, Claude, and Gemini from the same account.",
    },
    {
      title: "OpenAI-compatible API",
      body: "Keep the OpenAI SDK already in your application. Change base_url, set a flatkey API key, and select a supported Kimi model id.",
    },
    {
      title: "Live pricing before you scale",
      body: "Check Kimi K2.5 pricing and availability in one account, then manage its spend alongside the rest of your model usage.",
    },
    {
      title: "A low-commitment way to evaluate",
      body: "Use one OpenAI-compatible integration to evaluate Kimi without committing to another subscription or rewriting your API client.",
    },
  ],
  faq: [
    {
      question: "Can I call Kimi K2.5 through this API?",
      answer: "Yes. Use the kimi-k2.5 model ID with a flatkey API key and the OpenAI-compatible /v1 base URL.",
    },
    {
      question: "Can I use my existing OpenAI SDK?",
      answer: "Yes. Point the SDK at the flatkey /v1 base URL, use a flatkey API key, and choose the Kimi model id you need.",
    },
    ...SHARED_FAQ,
  ],
  seo: {
    title: "Kimi K2.5 API — OpenAI-compatible access with one API key",
    description:
      "Call Kimi K2.5 through one OpenAI-compatible API key. Keep your SDK, check live pricing, and compare Kimi with other frontier models in one account.",
  },
};

const PT_KIMI_API: SkagLandingConfig = {
  slug: "kimi-api",
  locale: "pt",
  pathname: "/kimi-api",
  keyword: "api kimi k2.5",
  badge: "Kimi K2.5 · contexto longo · agentes",
  h1Lead: "API Kimi K2.5",
  h1Accent: "para começar",
  description:
    "Use Kimi K2.5 com uma única chave de API compatível com OpenAI. Mantenha o SDK que sua equipe já usa, altere base_url e api_key e gerencie Kimi, DeepSeek, Qwen e outros modelos compatíveis em uma só conta.",
  ctaLabel: "Obter chave da API Kimi K2.5",
  hideSecondaryCta: true,
  compactHero: true,
  hideCodeWindow: true,
  trustLine: "Kimi · DeepSeek · Qwen · GPT · Claude · Gemini — uma chave, uma fatura · sem cartão de crédito para começar",
  pricingTitle: "Acesso à API Kimi K2.5",
  priceRows: [
    { label: "Kimi K2.5 / 1M tokens", flatkey: "$1.20", official: "$3.00" },
    { label: "Migração do SDK OpenAI", flatkey: "base_url + key", official: "Trabalho por fornecedor" },
    { label: "Kimi e outros modelos", flatkey: "Uma chave", official: "Contas separadas" },
  ],
  priceFootnote: "* Cobertura representativa — veja os preços ao vivo para taxas e disponibilidade atuais.",
  exampleModel: "kimi-k2.5",
  codeTitle: "Chame Kimi via /v1",
  features: [
    {
      title: "Kimi K2.5 em um único catálogo",
      body: "Use Kimi K2.5 sem uma integração separada e compare-o com DeepSeek, Qwen, GPT, Claude e Gemini na mesma conta.",
    },
    {
      title: "API compatível com OpenAI",
      body: "Mantenha o SDK da OpenAI que já existe no seu aplicativo. Altere base_url, use uma chave flatkey e escolha um ID de modelo Kimi compatível.",
    },
    {
      title: "Preço visível antes de escalar",
      body: "Confira preço e disponibilidade do Kimi K2.5 em uma conta e acompanhe o gasto junto com o uso dos demais modelos.",
    },
    {
      title: "Avalie sem outra assinatura",
      body: "Use uma integração compatível com OpenAI para avaliar Kimi sem assumir outra assinatura nem reescrever seu cliente de API.",
    },
  ],
  faq: [
    {
      question: "Posso chamar o Kimi K2.5 por esta API?",
      answer: "Sim. Use o ID de modelo kimi-k2.5 com uma chave de API flatkey e a base URL /v1 compatível com OpenAI.",
    },
    {
      question: "Posso usar meu SDK atual da OpenAI?",
      answer: "Sim. Aponte o SDK para a base URL /v1 da flatkey, use uma chave de API flatkey e escolha o ID do modelo Kimi necessário.",
    },
    {
      question: "Preciso alterar meu código?",
      answer: "Não. A flatkey.ai é compatível com OpenAI: mantenha seu SDK e troque base_url e api_key. Os IDs dos modelos permanecem iguais.",
    },
    {
      question: "Como funciona a cobrança entre modelos?",
      answer: "Uma conta cobre os modelos compatíveis. Os preços ao vivo e o uso por modelo ajudam a manter o gasto visível antes de escalar.",
    },
  ],
  seo: {
    title: "API Kimi K2.5 no Brasil — acesso compatível com OpenAI",
    description:
      "Use Kimi K2.5 com uma chave de API compatível com OpenAI. Mantenha seu SDK, consulte preços ao vivo e compare Kimi com outros modelos em uma só conta.",
  },
};

const QWEN_API: SkagLandingConfig = {
  slug: "qwen-api",
  keyword: "qwen api",
  badge: "No GPU · no Ollama · no driver setup",
  h1Lead: "Use Qwen",
  h1Accent: "without GPU setup",
  description:
    "Access Qwen through an OpenAI-compatible API without installing Ollama, ROCm, or GPU drivers. Keep your SDK, switch base_url and api_key, and use live pricing in one account.",
  ctaLabel: "Get your Qwen API key",
  hideSecondaryCta: true,
  compactHero: true,
  hideCodeWindow: true,
  pricingTitle: "Qwen without local setup",
  priceRows: [
    { label: "Qwen 3.7 Plus / 1M tokens", flatkey: "$0.24", official: "$0.40" },
    { label: "Qwen 3.5, 3.6, 3.7, Max", flatkey: "One key", official: "Separate setup" },
    { label: "OpenAI SDK migration", flatkey: "base_url + key", official: "Provider SDK work" },
  ],
  priceFootnote: "* Representative coverage — see live pricing for current model rates and availability.",
  exampleModel: "qwen3.7-plus",
  codeTitle: "Call Qwen through /v1",
  features: [
    {
      title: "Use Qwen without local hardware",
      body: "Call supported Qwen models without buying a GPU, managing VRAM, or waiting for a local model to generate a response.",
    },
    {
      title: "No Ollama, ROCm, or drivers",
      body: "Skip local installation and environment setup. Keep the OpenAI SDK in your application, change base_url, and select a Qwen model id.",
    },
    {
      title: "API access or local deployment",
      body: "Local Qwen offers control when you have the hardware. API access is the direct option when you want to build without operating that stack.",
    },
    {
      title: "One account for model comparison",
      body: "Compare Qwen with GPT, Claude, Gemini, DeepSeek, Kimi, and GLM without creating separate provider accounts or changing your API integration.",
    },
  ],
  faq: [
    {
      question: "Do I need a GPU or Ollama to use Qwen?",
      answer:
        "No. Use the API with your existing OpenAI SDK instead of installing Ollama, ROCm, GPU drivers, or a local Qwen runtime. Check live pricing for the current model list.",
    },
    {
      question: "Can I use my existing OpenAI SDK?",
      answer: "Yes. Point the SDK at the flatkey /v1 base URL, use a flatkey API key, and choose the Qwen model id you need.",
    },
    ...SHARED_FAQ,
  ],
  seo: {
    title: "Qwen API without GPU setup — OpenAI-compatible access",
    description:
      "Use Qwen through an OpenAI-compatible API without installing Ollama, ROCm, or GPU drivers. Keep your SDK, check live pricing, and avoid local setup.",
  },
};

const PT_QWEN_API: SkagLandingConfig = {
  slug: "qwen-api",
  locale: "pt",
  pathname: "/qwen-api",
  keyword: "qwen api",
  badge: "Sem GPU · sem Ollama · sem drivers",
  h1Lead: "Use Qwen",
  h1Accent: "sem configurar GPU",
  description:
    "Acesse Qwen por uma API compatível com OpenAI sem instalar Ollama, ROCm ou drivers de GPU. Mantenha o SDK que sua equipe já usa, altere base_url e api_key e consulte preços ao vivo em uma só conta.",
  ctaLabel: "Obter chave da API Qwen",
  hideSecondaryCta: true,
  compactHero: true,
  hideCodeWindow: true,
  trustLine: "Qwen · DeepSeek · Kimi · GPT · Claude · Gemini — uma chave, uma fatura · sem cartão de crédito para começar",
  pricingTitle: "Qwen sem configuração local",
  priceRows: [
    { label: "Qwen 3.7 Plus / 1M tokens", flatkey: "$0.24", official: "$0.40" },
    { label: "Qwen 3.5, 3.6, 3.7 e Max", flatkey: "Uma chave", official: "Configurações separadas" },
    { label: "Migração do SDK OpenAI", flatkey: "base_url + key", official: "Trabalho por fornecedor" },
  ],
  priceFootnote: "* Cobertura representativa — veja os preços ao vivo para taxas e disponibilidade atuais.",
  exampleModel: "qwen3.7-plus",
  codeTitle: "Chame Qwen via /v1",
  features: [
    {
      title: "Use Qwen sem hardware local",
      body: "Chame modelos Qwen compatíveis sem comprar uma GPU, gerenciar VRAM ou esperar uma resposta ser gerada localmente.",
    },
    {
      title: "Sem Ollama, ROCm ou drivers",
      body: "Evite instalação local e configuração de ambiente. Mantenha o SDK da OpenAI no seu aplicativo, altere base_url e escolha o ID do modelo Qwen.",
    },
    {
      title: "API ou execução local",
      body: "Qwen local oferece controle quando você tem o hardware. O acesso por API é direto quando você quer desenvolver sem operar essa infraestrutura.",
    },
    {
      title: "Compare modelos sem novas contas",
      body: "Compare Qwen com GPT, Claude, Gemini, DeepSeek, Kimi e GLM sem abrir contas separadas de fornecedor nem mudar sua integração de API.",
    },
  ],
  faq: [
    {
      question: "Preciso de GPU ou Ollama para usar Qwen?",
      answer:
        "Não. Use a API com o SDK da OpenAI que você já tem, sem instalar Ollama, ROCm, drivers de GPU ou um runtime Qwen local. Consulte os preços ao vivo para a lista atual de modelos.",
    },
    {
      question: "Posso usar meu SDK atual da OpenAI?",
      answer: "Sim. Aponte o SDK para a base URL /v1 da flatkey, use uma chave de API flatkey e escolha o ID do modelo Qwen necessário.",
    },
    {
      question: "Preciso alterar meu código?",
      answer: "Não. A flatkey.ai é compatível com OpenAI: mantenha seu SDK e troque base_url e api_key. Os IDs dos modelos permanecem iguais.",
    },
    {
      question: "Como funciona a cobrança entre modelos?",
      answer: "Uma conta cobre os modelos compatíveis. Os preços ao vivo e o uso por modelo ajudam a manter o gasto visível antes de escalar.",
    },
  ],
  seo: {
    title: "API Qwen no Brasil sem configurar GPU — acesso compatível com OpenAI",
    description:
      "Use Qwen por uma API compatível com OpenAI sem instalar Ollama, ROCm ou drivers de GPU. Mantenha seu SDK, consulte preços ao vivo e evite configuração local.",
  },
};

const OPENAI_COMPATIBLE: SkagLandingConfig = {
  slug: "openai-compatible",
  keyword: "openai compatible api",
  badge: "Drop-in /v1 endpoints",
  h1Lead: "OpenAI-Compatible",
  h1Accent: "API",
  description:
    "Drop-in /v1 endpoints for chat, completions, and images. Works with any OpenAI SDK in any language — zero code changes beyond base_url and api_key, with every major model behind one key.",
  ctaLabel: "Get your API key",
  pricingTitle: "Sample output pricing",
  priceRows: [
    { label: "GPT-5 / 1M tokens", flatkey: "$6.67", official: "$10.00" },
    { label: "Claude Opus 4 / 1M tokens", flatkey: "$10.00", official: "$15.00" },
    { label: "Gemini 2.5 Pro / 1M tokens", flatkey: "$6.67", official: "$10.00" },
  ],
  priceFootnote: "* Illustrative pricing — see the flatkey pricing page for live rates.",
  exampleModel: "gpt-5",
  codeTitle: "Zero code changes beyond base_url + key",
  features: [
    {
      title: "Standard /v1 surface",
      body: "chat/completions, embeddings, and images/generations behave exactly like the OpenAI API — same request and response shapes.",
    },
    {
      title: "Any OpenAI SDK",
      body: "Python, Node.js, Go, LangChain, LlamaIndex, Vercel AI SDK — anything that speaks the OpenAI protocol works unchanged.",
    },
    {
      title: "Every model, same protocol",
      body: "Call GPT, Gemini, Claude, DeepSeek, and Seedance through the identical OpenAI-compatible interface — only the model id changes.",
    },
    {
      title: "Production-grade routing",
      body: "Health-checked upstreams, automatic retries, and live pricing behind the same stable endpoint.",
    },
  ],
  faq: SHARED_FAQ,
  seo: {
    title: "OpenAI-Compatible API — drop-in /v1 endpoints for every model",
    description:
      "OpenAI-compatible API with drop-in /v1 endpoints: works with any OpenAI SDK, zero code changes beyond base_url and key, and GPT, Gemini, Claude, DeepSeek on one key.",
  },
};

const GATEWAY: SkagLandingConfig = {
  slug: "gateway",
  keyword: "llm api gateway",
  badge: "One key · every major model",
  h1Lead: "LLM API",
  h1Accent: "Gateway",
  description:
    "One API key routes to every major model — GPT, Gemini, Claude, DeepSeek, Seedance — with automatic failover, usage analytics, and a single invoice instead of five provider accounts.",
  ctaLabel: "Get your gateway key",
  pricingTitle: "Sample output pricing",
  priceRows: [
    { label: "GPT-5 / 1M tokens", flatkey: "$6.67", official: "$10.00" },
    { label: "Gemini 2.5 Pro / 1M tokens", flatkey: "$6.67", official: "$10.00" },
    { label: "DeepSeek V4 Flash / 1M tokens", flatkey: "$0.07", official: "$0.14" },
  ],
  priceFootnote: "* Illustrative pricing — see the flatkey pricing page for live rates.",
  exampleModel: "gpt-5",
  codeTitle: "Route every model through one endpoint",
  features: [
    {
      title: "One key, every major model",
      body: "GPT, Gemini, Claude, DeepSeek, and Seedance behind a single OpenAI-compatible endpoint — swap models by changing one string.",
    },
    {
      title: "Automatic failover",
      body: "Health-checked upstream channels with automatic retries and failover, so one provider outage does not take your product down.",
    },
    {
      title: "Usage analytics",
      body: "Per-key and per-model usage, live spend tracking, and plan limits keep costs visible and bounded.",
    },
    {
      title: "Single invoice",
      body: "Consolidate five provider bills into one balance and one invoice — simpler procurement, simpler accounting.",
    },
  ],
  faq: [
    {
      question: "How does failover work?",
      answer:
        "The gateway continuously health-checks upstream channels and retries or reroutes failed requests automatically — no client-side changes required.",
    },
    ...SHARED_FAQ,
  ],
  seo: {
    title: "LLM API Gateway — one key routes every major model",
    description:
      "LLM API gateway with one OpenAI-compatible key for GPT, Gemini, Claude, DeepSeek, and Seedance: automatic failover, usage analytics, and a single invoice.",
  },
};

const CHINESE_AI_MODELS_API_COPY: Partial<Record<Locale, SkagLandingConfig>> = {
  en: CHINESE_AI_MODELS_API,
  pt: PT_CHINESE_AI_MODELS_API,
};

const SKAG_CONFIGS: Record<SkagLandingSlug, Partial<Record<Locale, SkagLandingConfig>>> = {
  "gpt-api": { en: GPT_API, pt: PT_GPT_API },
  "gpt-api-alternative": { en: GPT_API_ALTERNATIVE },
  "chinese-ai": { en: CHINESE_AI },
  "chinese-ai-models-api": CHINESE_AI_MODELS_API_COPY,
  "deepseek-api": { en: DEEPSEEK_API, pt: PT_DEEPSEEK_API },
  "claude-api": { en: CLAUDE_API, pt: PT_CLAUDE_API },
  "kimi-api": { en: KIMI_API, pt: PT_KIMI_API },
  "qwen-api": { en: QWEN_API, pt: PT_QWEN_API },
  "openai-compatible": { en: OPENAI_COMPATIBLE },
  gateway: { en: GATEWAY },
};

export function getSkagLandingConfig(slug: SkagLandingSlug, locale: Locale = "en"): SkagLandingConfig {
  return SKAG_CONFIGS[slug][locale] ?? SKAG_CONFIGS[slug].en!;
}

export function getSkagLandingLocales(slug: SkagLandingSlug): readonly Locale[] {
  return LOCALES.filter((locale) => SKAG_CONFIGS[slug][locale]);
}

export function getSkagLandingConfigs(): SkagLandingConfig[] {
  return SKAG_LANDING_SLUGS.map((slug) => getSkagLandingConfig(slug));
}

export function skagLandingPath(slug: SkagLandingSlug): string {
  return `/${slug}`;
}

export function getSkagLandingPathnames(): string[] {
  return SKAG_LANDING_SLUGS.map((slug) => skagLandingPath(slug));
}

export function getSkagLandingCtaUrl(): string {
  return buildConsoleUrl("/register");
}

export function getSkagLandingMetadataInput(slug: SkagLandingSlug, locale: Locale = "en"): SeoInput {
  const config = getSkagLandingConfig(slug, locale);
  return {
    title: config.seo.title,
    description: config.seo.description,
    pathname: config.pathname ?? skagLandingPath(slug),
    locale,
    locales: getSkagLandingLocales(slug),
  };
}
