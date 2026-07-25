import type { SeoInput } from "@/lib/seo";
import type { Locale } from "./locales";
import { buildConsoleUrl, APP_CONSOLE_ORIGIN } from "./origins";

// Market-specific acquisition landing pages (Brazil/India/Indonesia).
// Unlike the multi-locale homepage, each page speaks ONE market's language and
// leads with that market's local-payment wedge (direction-1 slogan) and the
// verbatim community pain points from docs/community-voice-brazil-india-2026-07.md.
// These pages are single-locale by design (投放页, not i18n home).

export type MarketPain = {
  quote: string; // the user's own words (verbatim, local language)
  solution: string; // flatkey's answer
};

export type MarketFaq = {
  question: string;
  answer: string;
};

export type MarketLandingCopy = {
  seo: { title: string; description: string };
  badge: string;
  hero: {
    eyebrow: string;
    title: string;
    highlight: string;
    subtitle: string;
    primaryCta: string;
    secondaryCta: string;
    trustLine: string;
  };
  painsTitle: string;
  painsSubtitle: string;
  colYouSaid: string;
  colWeSolve: string;
  pains: MarketPain[];
  trust: { title: string; subtitle: string; points: string[] };
  premium: { title: string; body: string };
  models: { title: string; subtitle: string; items: { name: string; note: string }[] };
  faqTitle: string;
  faqs: MarketFaq[];
  finalCta: { title: string; subtitle: string; button: string };
};

export type MarketConfig = {
  slug: string; // route path, e.g. "/br"
  locale: Locale; // which site locale renders this page (SiteShell chrome only — metadata stays unlocalized)
  copy: MarketLandingCopy;
};

// ---------------------------------------------------------------------------
// 🇧🇷 Brazil — Pix (第一优先, docs §3)
// ---------------------------------------------------------------------------
const BRAZIL: MarketLandingCopy = {
  seo: {
    title: "flatkey — Claude, GPT, Gemini e DeepSeek com Pix, em reais",
    description:
      "Pague APIs de IA com Pix, em reais. Sem cartão internacional, sem IOF de 6,38%, sem cadastro rejeitado pela Anthropic. Claude, GPT, Gemini, DeepSeek e Qwen numa única chave.",
  },
  badge: "Pagamento com Pix · Modelos de verdade",
  hero: {
    eyebrow: "Para desenvolvedores no Brasil",
    title: "Claude, GPT, Gemini e DeepSeek —",
    highlight: "pague com Pix, em reais.",
    subtitle:
      "Sem cartão internacional. Sem IOF de 6,38%. Sem cadastro rejeitado pela Anthropic. Uma única chave para os modelos que você não conseguia pagar.",
    primaryCta: "Começar com Pix",
    secondaryCta: "Ver preços e modelos",
    trustLine: "Saldo pré-pago · Modelos oficiais · Sem surpresa no fim do mês",
  },
  painsTitle: "A dor é sua. A solução é nossa.",
  painsSubtitle: "O que a comunidade brasileira diz — e como a flatkey resolve.",
  colYouSaid: "O que você disse",
  colWeSolve: "Como resolvemos",
  pains: [
    {
      quote: "“Anthropic não aceita cadastro brasileiro.”",
      solution: "Sem cadastro na Anthropic. Você usa Claude pela nossa chave, direto.",
    },
    {
      quote: "“Cartão internacional cobra IOF de 6,38%.”",
      solution: "Pague em reais via Pix — zero IOF, zero cartão internacional.",
    },
    {
      quote: "“Cobrança por token estoura o orçamento no fim do mês.”",
      solution: "Saldo pré-pago. Você põe R$X, gasta R$X. Nunca estoura.",
    },
    {
      quote: "“Não posso pagar um plano decente do Claude Code.”",
      solution: "Modelos premium (Opus, GPT-5, Sora) a até 50% do preço oficial.",
    },
  ],
  trust: {
    title: "Modelos de verdade. Sem “downgrade”, sem sumir.",
    subtitle: "O medo dos revendedores cinza é real. Aqui não.",
    points: [
      "Modelos oficiais roteados direto — nunca versões quantizadas ou “burras”.",
      "Uptime monitorado ao vivo, por modelo, em painel público.",
      "Preço transparente: markup fixo, sem surpresa no fim do mês.",
    ],
  },
  premium: {
    title: "Os modelos “dos sonhos”, agora ao seu alcance.",
    body: "Os modelos gratuitos você já roda no OpenCode com DeepSeek. O que trava você são Opus, GPT-5 e Sora. Aqui você paga esses com Pix, a até metade do preço oficial.",
  },
  models: {
    title: "300+ modelos, uma chave",
    subtitle: "Do gratuito ao topo de linha — escolha por tarefa, pague por uso.",
    items: [
      { name: "Claude Opus / Sonnet", note: "os “dos sonhos”, agora com Pix" },
      { name: "GPT-5 · Sora", note: "premium a até 50% off" },
      { name: "Gemini 3 Pro", note: "multimodal e contexto longo" },
      { name: "DeepSeek V3.2", note: "queridinho da comunidade, baratíssimo" },
      { name: "Qwen 3 / GLM", note: "chineses fortes e econômicos" },
    ],
  },
  faqTitle: "Perguntas frequentes",
  faqs: [
    {
      question: "Preciso de cartão internacional?",
      answer: "Não. Você recarrega com Pix, em reais. Sem cartão, sem IOF, sem 3D Secure.",
    },
    {
      question: "É modelo oficial mesmo ou versão “capada”?",
      answer:
        "Modelos oficiais, roteados direto para os provedores. Publicamos um painel de saúde ao vivo para você conferir uptime e latência reais antes de pagar.",
    },
    {
      question: "Como é a cobrança?",
      answer:
        "Saldo pré-pago. Você adiciona um valor em reais e consome conforme usa. Sem assinatura, sem estourar orçamento no fim do mês.",
    },
  ],
  finalCta: {
    title: "Comece agora — pague com Pix.",
    subtitle: "Sem cartão. Sem IOF. Modelos de verdade.",
    button: "Criar conta e recarregar com Pix",
  },
};

// ---------------------------------------------------------------------------
// 🇮🇳 India — UPI (docs §2, 对标 AICredits)
// ---------------------------------------------------------------------------
const INDIA: MarketLandingCopy = {
  seo: {
    title: "flatkey — Pay for Claude, GPT, Gemini & DeepSeek with UPI, in ₹",
    description:
      "One wallet, one key. Pay with UPI in rupees — no card rejections, no high-risk blocks, no Anthropic sign-up wall. Claude, GPT, Gemini, DeepSeek and Qwen behind a single key.",
  },
  badge: "Pay with UPI · Real models",
  hero: {
    eyebrow: "For developers in India",
    title: "One wallet. Pay with UPI in ₹.",
    highlight: "Claude, GPT, Gemini & DeepSeek.",
    subtitle:
      "No card rejections. No high-risk blocks. No Anthropic sign-up wall. One key for the models you couldn't get billed for — topped up in rupees.",
    primaryCta: "Start with UPI",
    secondaryCta: "See prices & models",
    trustLine: "Prepaid balance · Official models · UPI, cards & netbanking",
  },
  painsTitle: "Your pain, in your words.",
  painsSubtitle: "What Indian developers keep saying — and how flatkey fixes it.",
  colYouSaid: "What you said",
  colWeSolve: "How we fix it",
  pains: [
    {
      quote: "“Anthropic keeps rejecting… we had to switch to OpenRouter.”",
      solution: "No Anthropic sign-up needed. Use Claude, GPT and Gemini through one flatkey key.",
    },
    {
      quote: "“I'm not able to pay via UPI, the common method in India.”",
      solution: "Pay with UPI in ₹ — the way you actually pay for everything else.",
    },
    {
      quote: "“I have 2 Visa Premium cards. None of them work.”",
      solution: "No international card. No high-risk decline. UPI, RuPay, netbanking all work.",
    },
    {
      quote: "“Merchant non-compliant on e-mandate.”",
      solution: "Prepaid balance in rupees — no e-mandate, no recurring-card wall.",
    },
  ],
  trust: {
    title: "Real models. No downgrades, no disappearing acts.",
    subtitle: "Grey resellers cut corners. We don't.",
    points: [
      "Official models routed straight through — never quantized or dumbed-down.",
      "Live per-model health dashboard, public — check uptime before you pay.",
      "Transparent markup — you always know what you're paying and why.",
    ],
  },
  premium: {
    title: "The models you couldn't afford, now on UPI.",
    body: "You already run the cheap models. What blocks you is Claude Opus, GPT-5 and Sora. Pay for those with UPI, at up to 50% off official — no card, no rejection.",
  },
  models: {
    title: "300+ models, one key",
    subtitle: "From free-tier cheap to frontier — pick per task, pay per use.",
    items: [
      { name: "Claude Opus / Sonnet", note: "top-tier coding, now on UPI" },
      { name: "GPT-5 · Sora", note: "premium at up to 50% off" },
      { name: "Gemini 3 Pro", note: "multimodal, long context" },
      { name: "DeepSeek V3.2", note: "community favourite, dirt cheap" },
      { name: "Qwen 3 / GLM", note: "strong, low-cost Chinese models" },
    ],
  },
  faqTitle: "Frequently asked",
  faqs: [
    {
      question: "Do I need an international card?",
      answer: "No. Top up with UPI, RuPay or netbanking in rupees. No Visa/Mastercard international needed.",
    },
    {
      question: "Are these the real models or a downgraded version?",
      answer:
        "Official models, routed straight to the providers. We publish a live health dashboard so you can verify real uptime and latency before paying.",
    },
    {
      question: "How does billing work?",
      answer: "Prepaid balance in rupees. Add funds, spend as you go. No subscription, no month-end bill shock.",
    },
  ],
  finalCta: {
    title: "Start now — pay with UPI.",
    subtitle: "No card rejections. No sign-up wall. Real models.",
    button: "Create account & top up with UPI",
  },
};

// ---------------------------------------------------------------------------
// 🇮🇩 Indonesia — QRIS (docs §3.5, 差异化非价格战)
// ---------------------------------------------------------------------------
const INDONESIA: MarketLandingCopy = {
  seo: {
    title: "flatkey — Bayar Claude, GPT, Gemini & DeepSeek pakai QRIS",
    description:
      "Bayar API AI pakai QRIS dan e-wallet, dalam rupiah. Tanpa kartu internasional, tanpa 3D Secure yang ditolak. Claude, GPT, Gemini, DeepSeek, dan Qwen dalam satu key.",
  },
  badge: "Bayar QRIS · Model asli",
  hero: {
    eyebrow: "Untuk developer di Indonesia",
    title: "Claude, GPT, Gemini & DeepSeek —",
    highlight: "bayar pakai QRIS, rupiah.",
    subtitle:
      "Tanpa kartu internasional. Tanpa 3D Secure yang ditolak. Satu key untuk model-model yang tadinya susah kamu bayar — saldo prabayar, transparan.",
    primaryCta: "Mulai pakai QRIS",
    secondaryCta: "Lihat harga & model",
    trustLine: "Saldo prabayar · Model resmi · QRIS & e-wallet",
  },
  painsTitle: "Masalahmu, kata-katamu sendiri.",
  painsSubtitle: "Yang sering dikeluhkan developer Indonesia — dan solusi flatkey.",
  colYouSaid: "Yang kamu bilang",
  colWeSolve: "Solusi kami",
  pains: [
    {
      quote: "“Kartu debit tidak support 3D Secure internasional.”",
      solution: "Nggak perlu kartu. Bayar pakai QRIS dan e-wallet, langsung dari rupiah.",
    },
    {
      quote: "“Kartu Anda ditolak.”",
      solution: "Tanpa kartu internasional, tanpa penolakan. QRIS jalan mulus.",
    },
    {
      quote: "Kurs USD bikin biaya susah diprediksi.",
      solution: "Saldo prabayar dalam rupiah. Isi Rp sekian, pakai Rp sekian. Transparan.",
    },
    {
      quote: "Cuma butuh top-up kecil buat coba.",
      solution: "Top-up mulai kecil, tanpa komitmen langganan. Bayar sesuai pemakaian.",
    },
  ],
  trust: {
    title: "Model asli. Tanpa “downgrade”, tanpa kabur.",
    subtitle: "Reseller abu-abu suka main curang. Kami nggak.",
    points: [
      "Model resmi, dirutekan langsung — bukan versi kuantisasi atau “dibodohkan”.",
      "Dashboard kesehatan per-model, publik dan real-time — cek uptime sebelum bayar.",
      "Markup transparan — kamu selalu tahu bayar berapa dan untuk apa.",
    ],
  },
  premium: {
    title: "Model “impian”, sekarang terjangkau.",
    body: "Model gratis sudah bisa kamu pakai. Yang bikin mentok itu Claude Opus, GPT-5, dan Sora. Bayar itu semua pakai QRIS, sampai 50% lebih murah dari harga resmi.",
  },
  models: {
    title: "300+ model, satu key",
    subtitle: "Dari yang murah sampai frontier — pilih per tugas, bayar per pakai.",
    items: [
      { name: "Claude Opus / Sonnet", note: "coding kelas atas, kini via QRIS" },
      { name: "GPT-5 · Sora", note: "premium sampai 50% off" },
      { name: "Gemini 3 Pro", note: "multimodal, konteks panjang" },
      { name: "DeepSeek V3.2", note: "favorit komunitas, sangat murah" },
      { name: "Qwen 3 / GLM", note: "model Tiongkok kuat & hemat" },
    ],
  },
  faqTitle: "Pertanyaan umum",
  faqs: [
    {
      question: "Perlu kartu internasional?",
      answer: "Nggak. Top-up pakai QRIS dan e-wallet dalam rupiah. Tanpa Visa/Mastercard internasional.",
    },
    {
      question: "Ini model asli atau versi turunan?",
      answer:
        "Model resmi, dirutekan langsung ke provider. Kami publikasikan dashboard kesehatan real-time supaya kamu bisa cek uptime & latensi asli sebelum bayar.",
    },
    {
      question: "Gimana sistem tagihannya?",
      answer: "Saldo prabayar dalam rupiah. Isi saldo, pakai sesuai kebutuhan. Tanpa langganan, tanpa tagihan kaget.",
    },
  ],
  finalCta: {
    title: "Mulai sekarang — bayar pakai QRIS.",
    subtitle: "Tanpa kartu ditolak. Tanpa ribet. Model asli.",
    button: "Buat akun & top-up QRIS",
  },
};

export const MARKETS: MarketConfig[] = [
  { slug: "/br", locale: "pt", copy: BRAZIL },
  { slug: "/in", locale: "en", copy: INDIA },
  { slug: "/id-market", locale: "id", copy: INDONESIA },
];

export function getMarketConfig(slug: string): MarketConfig | undefined {
  return MARKETS.find((m) => m.slug === slug);
}

export function getMarketPathnames(): string[] {
  return MARKETS.map((m) => m.slug);
}

export function getMarketLandingCtaUrl(origin = APP_CONSOLE_ORIGIN): string {
  return buildConsoleUrl("/sign-up", origin, "redirect=/topup");
}

export function getMarketMetadataInput(slug: string): SeoInput | undefined {
  const cfg = getMarketConfig(slug);
  if (!cfg) return undefined;
  return {
    title: cfg.copy.seo.title,
    description: cfg.copy.seo.description,
    pathname: cfg.slug,
    // Market pages are physical single-locale routes (/br, /in, /id-market) with
    // no [locale] siblings — canonical must stay unprefixed and emit no hreflang.
    unlocalized: true,
  };
}
