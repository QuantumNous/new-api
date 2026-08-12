import { buildConsoleUrl } from "@/lib/origins";
import { LOCALES, type Locale } from "@/lib/locales";
import type { SeoInput } from "@/lib/seo";

// SKAG (single-keyword ad group) landing pages for Google Ads paid search.
// Each page maps 1:1 to one high-value search keyword and its H1 must echo
// that query exactly, so the ad → landing message match stays tight.
// Most routes are English-only. Localized variants are added only when there
// is dedicated acquisition copy for that market.

export const SKAG_LANDING_SLUGS = [
  "gpt-api-alternative",
  "chinese-ai",
  "chinese-ai-models-api",
  "deepseek-api",
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
  priceRows: Array<{ label: string; flatkey: string; official: string }>;
  /** Model id used in the runnable curl / Python example. */
  exampleModel: string;
  codeTitle: string;
  features: Array<{ title: string; body: string }>;
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
  badge: "DeepSeek · Qwen · GLM · Kimi · Seedance",
  h1Lead: "Modelos Chineses de IA",
  h1Accent: "via API",
  description:
    "Execute DeepSeek, Qwen, GLM, Kimi e Seedance a partir de uma API compatível com OpenAI. Uma única chave flatkey substitui contas em fornecedores da China continental, recargas separadas e trabalho específico por SDK de cada provedor.",
  ctaLabel: "Obter sua chave de API para modelos chineses",
  secondaryCtaLabel: "Ver preços ao vivo",
  trustLine: "GPT · Gemini · Claude · DeepSeek · Kimi · Seedance — uma chave, uma fatura · sem cartão de crédito para começar",
  pricingTitle: "Cobertura de modelos pronta para produção",
  priceRows: [
    { label: "DeepSeek V4 Flash / 1M tokens", flatkey: "$0.056", official: "$0.14" },
    { label: "GLM 5.2 / 1M tokens", flatkey: "$0.56", official: "$1.40" },
    { label: "Vídeo Seedance 2.5", flatkey: "Por uso", official: "Apenas fornecedor" },
    { label: "Qwen, Kimi, Hunyuan, Wan", flatkey: "Uma chave", official: "Contas separadas" },
  ],
  priceFootnote: "* Cobertura representativa do catálogo — veja os preços ao vivo para taxas atuais por modelo e status de acesso.",
  exampleModel: "deepseek-v4-flash",
  codeTitle: "Chame modelos chineses de IA via /v1",
  features: [
    {
      title: "Cobertura de modelos da China",
      body: "DeepSeek, Qwen, GLM, Kimi, Seedance, Kling, Wan, Hailuo, Vidu, MiniMax, Tencent Hunyuan, Baidu ERNIE e mais em um único catálogo.",
    },
    {
      title: "API compatível com OpenAI",
      body: "Use o SDK da OpenAI que você já tem. Altere base_url, defina uma chave de API flatkey e troque IDs de modelo como deepseek-v4-flash ou glm-5.2.",
    },
    {
      title: "Sem configuração com fornecedor continental",
      body: "Evite verificação por telefone chinês, recargas em RMB, perfis de cobrança locais e consoles separados por fornecedor ao testar ou lançar modelos chineses de IA.",
    },
    {
      title: "Texto, raciocínio e vídeo",
      body: "Encaminhe chat, código, raciocínio e geração de vídeo pela mesma conta, com controles de gasto unificados e uma única fatura.",
    },
  ],
  faq: [
    {
      question: "Quais famílias de modelos chineses de IA posso testar?",
      answer:
        "Comece com DeepSeek, Qwen, GLM, Kimi e Seedance, depois compare outras famílias de modelos da China, como Kling, Wan, Hailuo, Vidu, MiniMax, Hunyuan e ERNIE conforme aparecerem no catálogo.",
    },
    {
      question: "Esta API é compatível com SDKs da OpenAI?",
      answer:
        "Sim. Mantenha seu SDK da OpenAI e aponte-o para a base URL /v1 da flatkey. O formato da requisição continua familiar; apenas base_url, api_key e o ID do modelo mudam.",
    },
    {
      question: "Preciso de telefone chinês, conta em RMB ou empresa local?",
      answer:
        "Não. A flatkey.ai oferece a equipes internacionais uma conta, uma chave e um fluxo de cobrança para modelos chineses de IA sem gerenciar diretamente cada conta de fornecedor continental.",
    },
    {
      question: "Preciso alterar meu código?",
      answer:
        "Não. A flatkey.ai é compatível com OpenAI: mantenha seu SDK da OpenAI e troque base_url e api_key. Os IDs dos modelos permanecem iguais.",
    },
    {
      question: "Como a cobrança funciona entre modelos?",
      answer:
        "Um plano cobre todos os modelos. Analytics de uso e uma única fatura mantêm o gasto visível antes de escalar.",
    },
  ],
  seo: {
    title: "API de Modelos Chineses de IA — DeepSeek, Qwen, GLM, Kimi, Seedance",
    description:
      "Use uma API de modelos chineses de IA para DeepSeek, Qwen, GLM, Kimi, Seedance e mais com uma chave compatível com OpenAI. Sem contas em fornecedores continentais ou reescrita de SDK.",
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
    { label: "DeepSeek V4 Flash / 1M tokens", flatkey: "$0.056", official: "$0.14" },
    { label: "DeepSeek V3, V3.2, V4 Pro", flatkey: "One key", official: "Separate setup" },
    { label: "OpenAI SDK migration", flatkey: "base_url + key", official: "Provider SDK work" },
  ],
  priceFootnote: "* Representative coverage — see live pricing for current model rates and availability.",
  exampleModel: "deepseek-v4-flash",
  codeTitle: "Call DeepSeek through /v1",
  features: [
    {
      title: "Stable access for production",
      body: "Route DeepSeek requests through one managed API instead of depending on a single provider console when availability matters to your application.",
    },
    {
      title: "OpenAI-compatible API",
      body: "Keep the OpenAI SDK already in your application. Change base_url, set a flatkey API key, and select a DeepSeek model id.",
    },
    {
      title: "Per-token cost visibility",
      body: "Check current per-token pricing and availability in one account before you scale code, automation, and other API workloads.",
    },
    {
      title: "One account for model comparison",
      body: "Compare DeepSeek with GPT, Claude, Gemini, Qwen, and GLM without creating separate provider accounts or changing your API integration.",
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
    { label: "DeepSeek V4 Flash / 1M tokens", flatkey: "$0.056", official: "$0.14" },
    { label: "DeepSeek V3, V3.2, V4 Pro", flatkey: "Uma chave", official: "Configurações separadas" },
    { label: "Migração do SDK OpenAI", flatkey: "base_url + key", official: "Trabalho por fornecedor" },
  ],
  priceFootnote: "* Cobertura representativa — veja os preços ao vivo para taxas e disponibilidade atuais.",
  exampleModel: "deepseek-v4-flash",
  codeTitle: "Chame DeepSeek via /v1",
  features: [
    {
      title: "Acesso estável para produção",
      body: "Encaminhe chamadas DeepSeek por uma API gerenciada em vez de depender de um único console de fornecedor quando a disponibilidade importa para seu aplicativo.",
    },
    {
      title: "API compatível com OpenAI",
      body: "Mantenha o SDK da OpenAI que já existe no seu aplicativo. Altere base_url, use uma chave flatkey e escolha o ID do modelo DeepSeek.",
    },
    {
      title: "Visibilidade de custo por token",
      body: "Confira preço por token e disponibilidade atuais em uma conta antes de escalar código, automação e outras cargas de API.",
    },
    {
      title: "Compare modelos sem novas contas",
      body: "Compare DeepSeek com GPT, Claude, Gemini, Qwen e GLM sem abrir contas separadas de fornecedor nem mudar sua integração de API.",
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
  "gpt-api-alternative": { en: GPT_API_ALTERNATIVE },
  "chinese-ai": { en: CHINESE_AI },
  "chinese-ai-models-api": CHINESE_AI_MODELS_API_COPY,
  "deepseek-api": { en: DEEPSEEK_API, pt: PT_DEEPSEEK_API },
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
