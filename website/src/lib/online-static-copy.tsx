import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { ReactNode } from "react";
import type { Locale } from "@/lib/locales";
import { consoleUrl } from "@/lib/origins";

type PlanCopy = {
  audience: string;
  cta: string;
  media: string;
  mediaSub: string;
  text: string;
  window: string;
};

type PaymentMethodLabels = readonly [string, string, string, string, string];

const paymentMethodCopy = {
  en: { payWith: "Pay with", methods: ["Card · 3DS", "Pix · BRL", "UPI · INR", "Alipay", "USDC"] },
  zh: { payWith: "支付方式", methods: ["银行卡 · 3DS", "Pix · BRL", "UPI · INR", "支付宝", "USDC"] },
  es: { payWith: "Paga con", methods: ["Tarjeta · 3DS", "Pix · BRL", "UPI · INR", "Alipay", "USDC"] },
  fr: { payWith: "Payer avec", methods: ["Carte · 3DS", "Pix · BRL", "UPI · INR", "Alipay", "USDC"] },
  pt: { payWith: "Pague com", methods: ["Cartão · 3DS", "Pix · BRL", "UPI · INR", "Alipay", "USDC"] },
  ru: { payWith: "Оплата через", methods: ["Карта · 3DS", "Pix · BRL", "UPI · INR", "Alipay", "USDC"] },
  ja: { payWith: "お支払い方法", methods: ["カード · 3DS", "Pix · BRL", "UPI · INR", "Alipay", "USDC"] },
  vi: { payWith: "Thanh toán bằng", methods: ["Thẻ · 3DS", "Pix · BRL", "UPI · INR", "Alipay", "USDC"] },
  de: { payWith: "Bezahlen mit", methods: ["Karte · 3DS", "Pix · BRL", "UPI · INR", "Alipay", "USDC"] },
  id: { payWith: "Bayar dengan", methods: ["Kartu · 3DS", "Pix · BRL", "UPI · INR", "Alipay", "USDC"] },
} satisfies Record<Locale, { payWith: string; methods: PaymentMethodLabels }>;

type OnlineCopy = {
  contact: {
    discord: string;
    email: string;
    fine: ReactNode;
    formTitle: string;
    heading: ReactNode;
    linkedin: string;
    placeholders: {
      company: string;
      email: string;
      message: string;
      name: string;
      volume: string;
    };
    send: string;
    sub: string;
    why: Array<{ body: string; num: string; title: string }>;
  };
  footer: {
    about: string;
    apiStatus: string;
    blog: string;
    brand: string;
    careers: string;
    company: string;
    compute: string;
    console: string;
    contact: string;
    developers: string;
    docs: string;
    gdpr: string;
    legalPrefix: string;
    models: string;
    playground: string;
    privacy: string;
    privacyFull: string;
    product: string;
    rankings: string;
    refund: string;
    refundFull: string;
    serviceLevel: string;
    serviceLevelFull: string;
    social: string;
    terms: string;
    termsFull: string;
    trusted: string;
    useCases: string;
    vanta: string;
    zeroRetention: string;
  };
  home: {
    balance: string;
    ctaKey: string;
    ctaModels: string;
    eyebrow: string;
    heroTitle: ReactNode;
    invoice: string;
    pay: string;
    savings: [string, string, string];
    sub: string;
    terminal: {
      billed: string;
      contacts: string;
      competitors: string;
      persona: string;
      runtimeLabel: string;
      runtimeValue: string;
      scanned: string;
      successfulLabel: string;
      successfulValue: string;
      title: string;
      invoiceLabel: string;
      invoiceValue: string;
    };
    toolsCommand: string;
    toolsCopy: string;
    toolsKicker: string;
    toolsTitle: ReactNode;
    universeCopy: string;
    universeKicker: string;
    universeTitle: ReactNode;
  };
  nav: {
    contact: string;
    cli: string;
    compute: string;
    docs: string;
    models: string;
    playground: string;
    pricing: string;
    rankings: string;
    signin: string;
    start: string;
    status: string;
    tools: string;
    useCases: string;
  };
  pricing: {
    customPrice: string;
    enterpriseAudience: string;
    enterpriseBody: ReactNode;
    enterpriseCta: string;
    enterpriseLabel: string;
    imageVideoLabel: string;
    local: ReactNode;
    mostPopular: string;
    payAsYouGo: string;
    payCta: (price: string) => string;
    perMonth: string;
    payWith: string;
    paymentMethods: PaymentMethodLabels;
    plans: Record<"Go" | "Pro" | "Max", PlanCopy>;
    subscriptionNotRequired: string;
    sub: ReactNode;
    textModelsLabel: string;
    title: ReactNode;
    toolsLabel: string;
    toolsMain: string;
    toolsSub: string;
  };
};

const en: OnlineCopy = {
  contact: {
    discord: "Join our Discord",
    email: "Email support@flatkey.ai",
    fine: (
      <>
        Prefer async? Email works too.
        <br />
        Already building? <a href={consoleUrl("/sign-up")} style={{ color: "var(--violet-deep)", fontWeight: 650 }}>Start free with $1 credit →</a>
      </>
    ),
    formTitle: "Talk to sales",
    heading: (
      <>
        Scale on official models,
        <br />
        with a human on call<span style={{ color: "var(--violet-deep)" }}>.</span>
      </>
    ),
    linkedin: "Follow on LinkedIn",
    placeholders: {
      company: "Company",
      email: "Work email",
      message: "What are you running? (agents, RAG, coding tools...)",
      name: "Full name",
      volume: "Monthly token volume (est.)",
    },
    send: "Send — we reply within 1 business day →",
    sub: "20 minutes, your stack, a concrete quote. English / 中文 both fine.",
    why: [
      { num: "01", title: "Corporate payment · invoices in 48h", body: "Bank transfer, Alipay corporate, or card. VAT fapiao within 48 hours, every month, automatically." },
      { num: "02", title: "Volume pricing for teams", body: "Committed-use discounts, custom routing, and a quote against your current invoice." },
      { num: "03", title: "Token governance for teams", body: "Tree-structured sub-keys with budgets, model allowlists, and a spend API — so finance and platform teams both sleep." },
      { num: "04", title: "SLA 99.5% · SOC 2 · ISO 27001", body: "Public availability target, GDPR-compliant infrastructure, zero retention of request content — plus the model-authenticity probes you see on the board." },
    ],
  },
  footer: {
    about: "About",
    apiStatus: "API status",
    blog: "Blog ↗",
    brand: "One key. More models. More tools. Lower cost.",
    careers: "Careers",
    company: "Company",
    compute: "Compute",
    console: "Console ↗",
    contact: "Contact us",
    developers: "Developers",
    docs: "Docs",
    gdpr: "GDPR compliant",
    legalPrefix: "© 2026 flatkey.ai · VOC AI INC, San Jose, CA. All rights reserved.",
    models: "Models",
    playground: "Playground",
    privacy: "Privacy",
    privacyFull: "Privacy Policy",
    product: "Product",
    rankings: "Rankings",
    refund: "Refunds",
    refundFull: "Refund Policy",
    serviceLevel: "SLA",
    serviceLevelFull: "Service Level Agreement",
    social: "Socials",
    terms: "Terms",
    termsFull: "Terms of Service",
    trusted: "TRUSTED & VERIFIED BY",
    useCases: "Use cases",
    vanta: "Vanta monitored",
    zeroRetention: "Zero retention of request content",
  },
  home: {
    balance: "FLATKEY BALANCE",
    ctaKey: "Get Up to $40 in Free Credits",
    ctaModels: "Model List",
    eyebrow: "DEEPSEEK KIMI GLM CODEX CLAUDE CODE",
    heroTitle: (
      <>
        One key
        <br />
        <span className="price">
          More models
          <span className="toolLine"> More tools</span>
          <span className="costLine">Lower cost</span>
        </span>
      </>
    ),
    invoice: "Every model Every tool One invoice",
    pay: "Pay per successful call",
    savings: ["Model subscriptions", "Data tool subscriptions", "Automation subscriptions"],
    sub: "One balance covers over 100 official models and over 1000 pay per call tools No idle seats duplicate subscriptions or API keys scattered across providers",
    terminal: {
      billed: "✓ $0.83 billed · failed calls $0.00",
      contacts: "✓ 489 contacts waterfall enriched across 5 providers",
      competitors: "→ 14 competitors found via live web search",
      invoiceLabel: "One invoice",
      invoiceValue: "$0.83",
      persona: "✓ 5 persona briefs generated with citations",
      runtimeLabel: "Total runtime",
      runtimeValue: "18.4 sec",
      scanned: "→ 4,857 public signals scanned across 349 sources",
      successfulLabel: "Successful tools",
      successfulValue: "23 / 23",
      title: "Flatkey Tools · agent run",
    },
    toolsCommand: "Set up Flatkey from https://flatkey.ai/SKILL.md",
    toolsCopy: "Build with Claude Code, Codex, OpenClaw, or any app. Flatkey runs search, browsers, enrichment, media generation, and actions through one balance—then bills only successful calls.",
    toolsKicker: "SDK · CLI · API · 1,000+ TOOLS",
    toolsTitle: (
      <>
        One key, one bill,
        <br />
        1,000+ tools.
      </>
    ),
    universeCopy: "Use one Flatkey interface for leading AI models, social platforms, web data, crawlers, GTM intelligence, and more.",
    universeKicker: "100+ MODELS · 1,000+ TOOLS",
    universeTitle: (
      <>
        Every model. Every tool.
        <br />
        One key.
      </>
    ),
  },
  nav: {
    contact: "Contact sales",
    cli: "CLI",
    compute: "Compute",
    docs: "Docs",
    models: "Models",
    playground: "Playground",
    pricing: "Pricing",
    rankings: "Rankings",
    signin: "Sign in",
    start: "Start free →",
    status: "Status",
    tools: "Tools",
    useCases: "Use cases",
  },
  pricing: {
    customPrice: "Custom",
    enterpriseAudience: "Committed volume & procurement",
    enterpriseBody: <>Custom pricing with committed-volume discounts, custom routing, invoicing and procurement.</>,
    enterpriseCta: "Contact sales",
    enterpriseLabel: "Enterprise",
    imageVideoLabel: "Image · video models",
    local: <>Stripe Checkout · Adaptive Pricing (BRL/INR/CNY/EUR) · bank transfer & invoicing via <u>Enterprise billing</u> · cancel anytime — new users start with $1 free credit</>,
    mostPopular: "MOST POPULAR",
    payAsYouGo: "Starter top-up",
    payCta: (price) => `Subscribe Pro ${price}/mo sign in`,
    perMonth: "/mo",
    payWith: paymentMethodCopy.en.payWith,
    paymentMethods: paymentMethodCopy.en.methods,
    plans: {
      Go: {
        audience: "For individuals & light daily use",
        cta: "Subscribe",
        media: "300 media credits / mo",
        mediaSub: "≈ 100 images, or 75s of video",
        text: "Up to $45 model usage / mo",
        window: "Short-term caps: $10 / 5h · $22 / 7d",
      },
      Pro: {
        audience: "For daily development & high-frequency requests",
        cta: "Subscribe",
        media: "1,200 media credits / mo",
        mediaSub: "≈ 400 images, or 5 min of video",
        text: "Up to $90 model usage / mo",
        window: "Short-term caps: $18 / 5h · $45 / 7d",
      },
      Max: {
        audience: "For teams & heavy workloads",
        cta: "Subscribe",
        media: "5,000 media credits / mo",
        mediaSub: "≈ 1,600 images, or 20 min of video",
        text: "Up to $300 model usage / mo",
        window: "Short-term caps: $60 / 5h · $150 / 7d",
      },
    },
    subscriptionNotRequired: "Credit package",
    sub: (
      <>
        Subscribe to Go, Pro or Max for more model usage. All 100+ models are included — GPT, Claude,
        Gemini, DeepSeek, Kimi, GLM, plus Seedance image & video. <b>Enterprise contracts add committed-volume discounts</b>.
      </>
    ),
    textModelsLabel: "Text models",
    title: (
      <>
        Flexible pricing.
        <br />
        Every model included.
      </>
    ),
    toolsLabel: "Tools Credits",
    toolsMain: "Pay per run",
    toolsSub: "1,000+ data APIs & MCP tools · uses Flatkey Credits",
  },
};

const zh: OnlineCopy = {
  ...en,
  contact: {
    discord: "加入 Discord 社区",
    email: "邮件 support@flatkey.ai",
    fine: (
      <>
        习惯异步？邮件也行
        <br />
        已经在开发？<a href={consoleUrl("/sign-up")} style={{ color: "var(--violet-deep)", fontWeight: 650 }}>免费开始，送 $1 额度 →</a>
      </>
    ),
    formTitle: "联系销售",
    heading: (
      <>
        在官方模型上扩张，
        <br />
        背后有真人兜底
      </>
    ),
    linkedin: "关注 LinkedIn",
    placeholders: {
      company: "公司",
      email: "工作邮箱",
      message: "你们在跑什么？(agent、RAG、编程工具...)",
      name: "姓名",
      volume: "月 token 用量(预估)",
    },
    send: "发送 — 1 个工作日内回复 →",
    sub: "20 分钟，聊你的技术栈，给出具体报价。中文 / English 均可。",
    why: [
      { num: "01", title: "对公付款 · 发票 48 小时", body: "对公转账、企业支付宝或银行卡。增值税专用发票每月 48 小时内自动开出。" },
      { num: "02", title: "企业团队折扣", body: "承诺用量折扣、定制路由，并按你现在的账单出报价。" },
      { num: "03", title: "团队 Token 治理", body: "树状子 key 带预算与模型白名单，外加费用 API，财务和平台团队都能睡好。" },
      { num: "04", title: "SLA 99.5% · SOC 2 · ISO 27001", body: "公开可用性目标、GDPR 合规基础设施、请求内容零留存，外加首页那套公开的模型真实性探针。" },
    ],
  },
  footer: {
    ...en.footer,
    about: "关于我们",
    apiStatus: "API status",
    blog: "Blog ↗",
    brand: en.footer.brand,
    careers: "加入我们",
    company: "公司",
    compute: "Compute",
    console: "控制台 ↗",
    contact: "联系我们",
    developers: "开发者",
    docs: "Docs",
    gdpr: "GDPR 合规",
    legalPrefix: "© 2026 flatkey.ai · VOC AI INC (San Jose, CA). 保留所有权利",
    models: "Models",
    playground: "Playground",
    privacy: "隐私",
    privacyFull: "隐私政策",
    product: "产品",
    rankings: "Rankings",
    refund: "退款",
    refundFull: "退款政策",
    serviceLevel: "SLA",
    serviceLevelFull: "服务等级协议",
    social: "社交",
    terms: "条款",
    termsFull: "服务条款",
    trusted: "认证与背书",
    useCases: "Use cases",
    vanta: "Vanta monitored",
    zeroRetention: "请求内容零留存",
  },
  home: {
    ...en.home,
    balance: "FLATKEY 统一余额",
    ctaKey: "最高领取 $40 免费额度",
    ctaModels: "模型列表",
    eyebrow: "DEEPSEEK KIMI GLM CODEX CLAUDE CODE",
    heroTitle: (
      <>
        一个key
        <br />
        <span className="price">
          更多模型
          <span className="toolLine">更多工具</span>
          <span className="costLine">更低成本</span>
        </span>
      </>
    ),
    invoice: "每个模型 每个工具 只需一张账单",
    pay: "仅成功调用才付费",
    savings: ["模型订阅", "数据工具订阅", "自动化工具订阅"],
    sub: "一个余额覆盖 100 个以上官方模型和 1000 个以上按调用付费工具 无需闲置席位 重复订阅 也无需管理散落在各供应商的 API Key",
    terminal: {
      billed: "✓ 计费 $0.83 · 失败调用 $0.00",
      contacts: "✓ 通过 5 个供应商瀑布式补全 489 位联系人",
      competitors: "→ 通过实时网页搜索找到 14 个竞品",
      invoiceLabel: "一张账单",
      invoiceValue: "$0.83",
      persona: "✓ 生成 5 份带引用的 Persona 简报",
      runtimeLabel: "总运行时间",
      runtimeValue: "18.4 sec",
      scanned: "→ 扫描 349 个来源中的 4,857 条公开信号",
      successfulLabel: "成功工具调用",
      successfulValue: "23 / 23",
      title: "Flatkey Tools · Agent 运行",
    },
    toolsCommand: "Set up Flatkey from https://flatkey.ai/SKILL.md",
    toolsCopy: "无论使用 Claude Code、Codex、OpenClaw 还是自己的应用，Flatkey 都能用同一份余额完成搜索、浏览器操作、数据补全、媒体生成与自动化，并且只对成功调用计费。",
    toolsKicker: "SDK · CLI · API · 1,000+ 工具",
    toolsTitle: (
      <>
        一个 key，一张账单，
        <br />
        1,000+ 工具
      </>
    ),
    universeCopy: "通过一个 Flatkey 接口调用领先 AI 模型、社交平台、网页数据、爬虫、GTM 情报以及更多能力。",
    universeKicker: "100+ 模型 · 1,000+ 工具",
    universeTitle: (
      <>
        每个模型，每个工具
        <br />
        一个 key
      </>
    ),
  },
  nav: {
    contact: "联系销售",
    cli: "CLI",
    compute: "算力",
    docs: "文档",
    models: "模型",
    playground: "Playground",
    pricing: "价格",
    rankings: "排行榜",
    signin: "登录",
    start: "免费开始 →",
    status: "服务状态",
    tools: "工具",
    useCases: "使用场景",
  },
  pricing: {
    ...en.pricing,
    customPrice: "定制",
    enterpriseAudience: "承诺用量与企业采购",
    enterpriseBody: <>承诺用量折扣、定制路由、发票与采购支持</>,
    enterpriseCta: "联系销售",
    enterpriseLabel: "企业版",
    imageVideoLabel: "图像 · 视频模型",
    local: <>Stripe Checkout · 自适应定价 (BRL/INR/CNY/EUR) · 企业账单支持银行转账与发票 · 随时取消，新用户送 $1 免费额度</>,
    mostPopular: "最受欢迎",
    payAsYouGo: "起始充值",
    payCta: (price) => `订阅 Pro ${price}/月并登录`,
    perMonth: "/月",
    payWith: paymentMethodCopy.zh.payWith,
    paymentMethods: paymentMethodCopy.zh.methods,
    plans: {
      Go: {
        audience: "适合个人与轻量日常使用",
        cta: "立即订阅",
        media: "每月 300 媒体额度",
        mediaSub: "约可生成 100 张图，或 75 秒视频",
        text: "每月最多 $45 模型用量",
        window: "短期上限：每 5 小时 $10 · 每 7 天 $22",
      },
      Pro: {
        audience: "适合日常开发与高频请求",
        cta: "立即订阅",
        media: "每月 1,200 媒体额度",
        mediaSub: "约可生成 400 张图，或 5 分钟视频",
        text: "每月最多 $90 模型用量",
        window: "短期上限：每 5 小时 $18 · 每 7 天 $45",
      },
      Max: {
        audience: "适合团队与高强度任务",
        cta: "立即订阅",
        media: "每月 5,000 媒体额度",
        mediaSub: "约可生成 1,600 张图，或 20 分钟视频",
        text: "每月最多 $300 模型用量",
        window: "短期上限：每 5 小时 $60 · 每 7 天 $150",
      },
    },
    subscriptionNotRequired: "额度包",
    sub: (
      <>
        订阅 Go、Pro 或 Max 获得更多模型用量。全部 100+ 模型均可使用，GPT、Claude、Gemini、DeepSeek、Kimi、GLM，以及 Seedance 生图和生视频。<b>企业级合同提供承诺用量折扣</b>。
      </>
    ),
    textModelsLabel: "文本模型",
    title: (
      <>
        灵活定价
        <br />
        所有模型全包含
      </>
    ),
    toolsLabel: "工具额度",
    toolsMain: "按次运行付费",
    toolsSub: "1,000+ 数据 API 与 MCP 工具，使用 Flatkey 额度",
  },
};

const localizedPricingCopy = {
  es: {
    customPrice: "Personalizado",
    enterpriseAudience: "Volumen comprometido y compras",
    enterpriseBody: <>Precios personalizados con descuentos por volumen comprometido, enrutamiento a medida, facturación y compras.</>,
    enterpriseCta: "Contactar ventas",
    enterpriseLabel: "Empresa",
    imageVideoLabel: "Modelos de imagen y vídeo",
    local: <>Stripe Checkout · Precios adaptativos (BRL/INR/CNY/EUR) · transferencia bancaria y facturación mediante <u>facturación empresarial</u> · cancela cuando quieras; los nuevos usuarios empiezan con $1 de crédito gratis</>,
    mostPopular: "MÁS POPULAR",
    payAsYouGo: "Recarga inicial",
    payCta: (price) => `Suscríbete a Pro por ${price}/mes e inicia sesión`,
    perMonth: "/mes",
    payWith: paymentMethodCopy.es.payWith,
    paymentMethods: paymentMethodCopy.es.methods,
    plans: {
      Go: {
        audience: "Para uso individual y diario ligero",
        cta: "Suscribirse",
        media: "300 créditos multimedia / mes",
        mediaSub: "≈ 100 imágenes o 75 s de vídeo",
        text: "Hasta $45 de uso de modelos / mes",
        window: "Límites a corto plazo: $10 / 5 h · $22 / 7 d",
      },
      Pro: {
        audience: "Para desarrollo diario y solicitudes frecuentes",
        cta: "Suscribirse",
        media: "1,200 créditos multimedia / mes",
        mediaSub: "≈ 400 imágenes o 5 min de vídeo",
        text: "Hasta $90 de uso de modelos / mes",
        window: "Límites a corto plazo: $18 / 5 h · $45 / 7 d",
      },
      Max: {
        audience: "Para equipos y cargas intensivas",
        cta: "Suscribirse",
        media: "5,000 créditos multimedia / mes",
        mediaSub: "≈ 1,600 imágenes o 20 min de vídeo",
        text: "Hasta $300 de uso de modelos / mes",
        window: "Límites a corto plazo: $60 / 5 h · $150 / 7 d",
      },
    },
    subscriptionNotRequired: "Paquete de créditos",
    sub: <>Suscríbete a Go, Pro o Max para obtener más uso de modelos. Incluye todos los más de 100 modelos: GPT, Claude, Gemini, DeepSeek, Kimi, GLM, además de imagen y vídeo Seedance. <b>Los contratos empresariales añaden descuentos por volumen comprometido</b>.</>,
    textModelsLabel: "Modelos de texto",
    title: <>Precios flexibles.<br />Todos los modelos incluidos.</>,
    toolsLabel: "Créditos de herramientas",
    toolsMain: "Pago por ejecución",
    toolsSub: "Más de 1,000 API de datos y herramientas MCP · usa créditos Flatkey",
  },
  fr: {
    customPrice: "Sur mesure",
    enterpriseAudience: "Volume engagé et achats",
    enterpriseBody: <>Tarifs sur mesure avec remises sur volume engagé, routage personnalisé, facturation et achats.</>,
    enterpriseCta: "Contacter l'équipe commerciale",
    enterpriseLabel: "Entreprise",
    imageVideoLabel: "Modèles image et vidéo",
    local: <>Stripe Checkout · Tarification adaptative (BRL/INR/CNY/EUR) · virement bancaire et facturation via <u>facturation entreprise</u> · annulation à tout moment; les nouveaux utilisateurs commencent avec $1 de crédit gratuit</>,
    mostPopular: "LE PLUS POPULAIRE",
    payAsYouGo: "Recharge de départ",
    payCta: (price) => `S'abonner à Pro pour ${price}/mois et se connecter`,
    perMonth: "/mois",
    payWith: paymentMethodCopy.fr.payWith,
    paymentMethods: paymentMethodCopy.fr.methods,
    plans: {
      Go: {
        audience: "Pour les particuliers et un usage quotidien léger",
        cta: "S'abonner",
        media: "300 crédits média / mois",
        mediaSub: "≈ 100 images ou 75 s de vidéo",
        text: "Jusqu'à $45 d'utilisation de modèles / mois",
        window: "Limites court terme : $10 / 5 h · $22 / 7 j",
      },
      Pro: {
        audience: "Pour le développement quotidien et les requêtes fréquentes",
        cta: "S'abonner",
        media: "1,200 crédits média / mois",
        mediaSub: "≈ 400 images ou 5 min de vidéo",
        text: "Jusqu'à $90 d'utilisation de modèles / mois",
        window: "Limites court terme : $18 / 5 h · $45 / 7 j",
      },
      Max: {
        audience: "Pour les équipes et les charges intensives",
        cta: "S'abonner",
        media: "5,000 crédits média / mois",
        mediaSub: "≈ 1,600 images ou 20 min de vidéo",
        text: "Jusqu'à $300 d'utilisation de modèles / mois",
        window: "Limites court terme : $60 / 5 h · $150 / 7 j",
      },
    },
    subscriptionNotRequired: "Pack de crédits",
    sub: <>Abonnez-vous à Go, Pro ou Max pour obtenir plus d&apos;utilisation de modèles. Les 100+ modèles sont inclus : GPT, Claude, Gemini, DeepSeek, Kimi, GLM, ainsi que l&apos;image et la vidéo Seedance. <b>Les contrats entreprise ajoutent des remises sur volume engagé</b>.</>,
    textModelsLabel: "Modèles de texte",
    title: <>Tarifs flexibles.<br />Tous les modèles inclus.</>,
    toolsLabel: "Crédits d'outils",
    toolsMain: "Paiement par exécution",
    toolsSub: "Plus de 1,000 API de données et outils MCP · utilise les crédits Flatkey",
  },
  pt: {
    customPrice: "Personalizado",
    enterpriseAudience: "Volume contratado e compras",
    enterpriseBody: <>Preços personalizados com descontos por volume contratado, roteamento personalizado, faturamento e compras.</>,
    enterpriseCta: "Falar com vendas",
    enterpriseLabel: "Empresarial",
    imageVideoLabel: "Modelos de imagem e vídeo",
    local: <>Stripe Checkout · Preços adaptativos (BRL/INR/CNY/EUR) · transferência bancária e faturamento via <u>cobrança empresarial</u> · cancele quando quiser; novos usuários começam com $1 de crédito grátis</>,
    mostPopular: "MAIS POPULAR",
    payAsYouGo: "Recarga inicial",
    payCta: (price) => `Assine Pro por ${price}/mês e entre`,
    perMonth: "/mês",
    payWith: paymentMethodCopy.pt.payWith,
    paymentMethods: paymentMethodCopy.pt.methods,
    plans: {
      Go: {
        audience: "Para uso individual e diário leve",
        cta: "Assinar",
        media: "300 créditos de mídia / mês",
        mediaSub: "≈ 100 imagens ou 75 s de vídeo",
        text: "Até $45 de uso de modelos / mês",
        window: "Limites de curto prazo: $10 / 5 h · $22 / 7 d",
      },
      Pro: {
        audience: "Para desenvolvimento diário e solicitações frequentes",
        cta: "Assinar",
        media: "1,200 créditos de mídia / mês",
        mediaSub: "≈ 400 imagens ou 5 min de vídeo",
        text: "Até $90 de uso de modelos / mês",
        window: "Limites de curto prazo: $18 / 5 h · $45 / 7 d",
      },
      Max: {
        audience: "Para equipes e cargas intensas",
        cta: "Assinar",
        media: "5,000 créditos de mídia / mês",
        mediaSub: "≈ 1,600 imagens ou 20 min de vídeo",
        text: "Até $300 de uso de modelos / mês",
        window: "Limites de curto prazo: $60 / 5 h · $150 / 7 d",
      },
    },
    subscriptionNotRequired: "Pacote de créditos",
    sub: <>Assine Go, Pro ou Max para ter mais uso de modelos. Todos os 100+ modelos estão incluídos: GPT, Claude, Gemini, DeepSeek, Kimi, GLM, além de imagem e vídeo Seedance. <b>Contratos empresariais adicionam descontos por volume contratado</b>.</>,
    textModelsLabel: "Modelos de texto",
    title: <>Preços flexíveis.<br />Todos os modelos incluídos.</>,
    toolsLabel: "Créditos de ferramentas",
    toolsMain: "Pague por execução",
    toolsSub: "Mais de 1,000 APIs de dados e ferramentas MCP · usa créditos Flatkey",
  },
  ru: {
    customPrice: "Индивидуально",
    enterpriseAudience: "Договорной объём и закупки",
    enterpriseBody: <>Индивидуальные тарифы со скидками за договорной объём, кастомной маршрутизацией, счетами и поддержкой закупок.</>,
    enterpriseCta: "Связаться с продажами",
    enterpriseLabel: "Корпоративный",
    imageVideoLabel: "Модели изображений и видео",
    local: <>Stripe Checkout · адаптивные цены (BRL/INR/CNY/EUR) · банковский перевод и счета через <u>корпоративный биллинг</u> · отмена в любое время; новые пользователи начинают с бесплатного кредита $1</>,
    mostPopular: "ПОПУЛЯРНО",
    payAsYouGo: "Стартовое пополнение",
    payCta: (price) => `Оформить Pro за ${price}/мес. и войти`,
    perMonth: "/мес.",
    payWith: paymentMethodCopy.ru.payWith,
    paymentMethods: paymentMethodCopy.ru.methods,
    plans: {
      Go: {
        audience: "Для индивидуального и лёгкого ежедневного использования",
        cta: "Оформить",
        media: "300 медиакредитов / мес.",
        mediaSub: "≈ 100 изображений или 75 с видео",
        text: "До $45 использования моделей / мес.",
        window: "Краткосрочные лимиты: $10 / 5 ч · $22 / 7 дн.",
      },
      Pro: {
        audience: "Для ежедневной разработки и частых запросов",
        cta: "Оформить",
        media: "1,200 медиакредитов / мес.",
        mediaSub: "≈ 400 изображений или 5 мин видео",
        text: "До $90 использования моделей / мес.",
        window: "Краткосрочные лимиты: $18 / 5 ч · $45 / 7 дн.",
      },
      Max: {
        audience: "Для команд и тяжёлых нагрузок",
        cta: "Оформить",
        media: "5,000 медиакредитов / мес.",
        mediaSub: "≈ 1,600 изображений или 20 мин видео",
        text: "До $300 использования моделей / мес.",
        window: "Краткосрочные лимиты: $60 / 5 ч · $150 / 7 дн.",
      },
    },
    subscriptionNotRequired: "Пакет кредитов",
    sub: <>Подпишитесь на Go, Pro или Max, чтобы получить больший объём использования моделей. Доступны все 100+ моделей: GPT, Claude, Gemini, DeepSeek, Kimi, GLM, а также изображения и видео Seedance. <b>Корпоративные контракты дают скидки за договорной объём</b>.</>,
    textModelsLabel: "Текстовые модели",
    title: <>Гибкие тарифы.<br />Все модели включены.</>,
    toolsLabel: "Кредиты инструментов",
    toolsMain: "Оплата за запуск",
    toolsSub: "1,000+ API данных и MCP-инструментов · используют кредиты Flatkey",
  },
  ja: {
    customPrice: "カスタム",
    enterpriseAudience: "コミット量と調達",
    enterpriseBody: <>コミット量割引、カスタムルーティング、請求書、調達対応を含むカスタム料金です。</>,
    enterpriseCta: "営業に問い合わせる",
    enterpriseLabel: "エンタープライズ",
    imageVideoLabel: "画像・動画モデル",
    local: <>Stripe Checkout · 適応型価格 (BRL/INR/CNY/EUR) · <u>エンタープライズ請求</u>で銀行振込と請求書に対応 · いつでも解約可能。新規ユーザーは $1 の無料クレジットから開始</>,
    mostPopular: "一番人気",
    payAsYouGo: "初回チャージ",
    payCta: (price) => `Pro を ${price}/月で登録してログイン`,
    perMonth: "/月",
    payWith: paymentMethodCopy.ja.payWith,
    paymentMethods: paymentMethodCopy.ja.methods,
    plans: {
      Go: {
        audience: "個人利用と軽い日常利用向け",
        cta: "登録する",
        media: "月 300 メディアクレジット",
        mediaSub: "約 100 枚の画像、または 75 秒の動画",
        text: "月あたり最大 $45 のモデル利用",
        window: "短期上限: $10 / 5時間 · $22 / 7日",
      },
      Pro: {
        audience: "日常的な開発と高頻度リクエスト向け",
        cta: "登録する",
        media: "月 1,200 メディアクレジット",
        mediaSub: "約 400 枚の画像、または 5 分の動画",
        text: "月あたり最大 $90 のモデル利用",
        window: "短期上限: $18 / 5時間 · $45 / 7日",
      },
      Max: {
        audience: "チームと高負荷ワークロード向け",
        cta: "登録する",
        media: "月 5,000 メディアクレジット",
        mediaSub: "約 1,600 枚の画像、または 20 分の動画",
        text: "月あたり最大 $300 のモデル利用",
        window: "短期上限: $60 / 5時間 · $150 / 7日",
      },
    },
    subscriptionNotRequired: "クレジットパック",
    sub: <>Go、Pro、Max を登録すると、より多くのモデル利用枠を使えます。GPT、Claude、Gemini、DeepSeek、Kimi、GLM、Seedance の画像・動画を含む 100+ モデルすべてが対象です。<b>エンタープライズ契約ではコミット量割引が追加されます</b>。</>,
    textModelsLabel: "テキストモデル",
    title: <>柔軟な料金。<br />すべてのモデル込み。</>,
    toolsLabel: "ツールクレジット",
    toolsMain: "実行ごとに課金",
    toolsSub: "1,000+ のデータ API と MCP ツール · Flatkey クレジットを使用",
  },
  vi: {
    customPrice: "Tùy chỉnh",
    enterpriseAudience: "Sản lượng cam kết và mua sắm",
    enterpriseBody: <>Giá tùy chỉnh với chiết khấu sản lượng cam kết, định tuyến tùy chỉnh, hóa đơn và hỗ trợ mua sắm.</>,
    enterpriseCta: "Liên hệ kinh doanh",
    enterpriseLabel: "Doanh nghiệp",
    imageVideoLabel: "Model hình ảnh và video",
    local: <>Stripe Checkout · giá thích ứng (BRL/INR/CNY/EUR) · chuyển khoản ngân hàng và hóa đơn qua <u>thanh toán doanh nghiệp</u> · hủy bất cứ lúc nào; người dùng mới bắt đầu với $1 credit miễn phí</>,
    mostPopular: "PHỔ BIẾN NHẤT",
    payAsYouGo: "Nạp khởi đầu",
    payCta: (price) => `Đăng ký Pro ${price}/tháng và đăng nhập`,
    perMonth: "/tháng",
    payWith: paymentMethodCopy.vi.payWith,
    paymentMethods: paymentMethodCopy.vi.methods,
    plans: {
      Go: {
        audience: "Cho cá nhân và nhu cầu hằng ngày nhẹ",
        cta: "Đăng ký",
        media: "300 credit media / tháng",
        mediaSub: "≈ 100 ảnh hoặc 75 giây video",
        text: "Tối đa $45 mức sử dụng model / tháng",
        window: "Giới hạn ngắn hạn: $10 / 5 giờ · $22 / 7 ngày",
      },
      Pro: {
        audience: "Cho phát triển hằng ngày và yêu cầu tần suất cao",
        cta: "Đăng ký",
        media: "1,200 credit media / tháng",
        mediaSub: "≈ 400 ảnh hoặc 5 phút video",
        text: "Tối đa $90 mức sử dụng model / tháng",
        window: "Giới hạn ngắn hạn: $18 / 5 giờ · $45 / 7 ngày",
      },
      Max: {
        audience: "Cho đội nhóm và tải công việc nặng",
        cta: "Đăng ký",
        media: "5,000 credit media / tháng",
        mediaSub: "≈ 1,600 ảnh hoặc 20 phút video",
        text: "Tối đa $300 mức sử dụng model / tháng",
        window: "Giới hạn ngắn hạn: $60 / 5 giờ · $150 / 7 ngày",
      },
    },
    subscriptionNotRequired: "Gói credit",
    sub: <>Đăng ký Go, Pro hoặc Max để có thêm mức sử dụng model. Tất cả hơn 100 model đều được bao gồm: GPT, Claude, Gemini, DeepSeek, Kimi, GLM, cùng hình ảnh và video Seedance. <b>Hợp đồng doanh nghiệp có thêm chiết khấu sản lượng cam kết</b>.</>,
    textModelsLabel: "Model văn bản",
    title: <>Giá linh hoạt.<br />Bao trọn mọi model.</>,
    toolsLabel: "Credit công cụ",
    toolsMain: "Trả theo mỗi lần chạy",
    toolsSub: "1,000+ API dữ liệu và công cụ MCP · dùng credit Flatkey",
  },
  de: {
    customPrice: "Individuell",
    enterpriseAudience: "Commit-Volumen und Beschaffung",
    enterpriseBody: <>Individuelle Preise mit Commit-Volumen-Rabatten, Custom Routing, Rechnungsstellung und Beschaffung.</>,
    enterpriseCta: "Vertrieb kontaktieren",
    enterpriseLabel: "Unternehmen",
    imageVideoLabel: "Bild- und Videomodelle",
    local: <>Stripe Checkout · adaptive Preise (BRL/INR/CNY/EUR) · Banküberweisung und Rechnungen über <u>Enterprise-Abrechnung</u> · jederzeit kündbar; neue Nutzer starten mit $1 Gratisguthaben</>,
    mostPopular: "BELIEBT",
    payAsYouGo: "Startguthaben",
    payCta: (price) => `Pro für ${price}/Monat abonnieren und anmelden`,
    perMonth: "/Monat",
    payWith: paymentMethodCopy.de.payWith,
    paymentMethods: paymentMethodCopy.de.methods,
    plans: {
      Go: {
        audience: "Für Einzelpersonen und leichte tägliche Nutzung",
        cta: "Abonnieren",
        media: "300 Medienguthaben / Monat",
        mediaSub: "≈ 100 Bilder oder 75 s Video",
        text: "Bis zu $45 Modellnutzung / Monat",
        window: "Kurzfristige Limits: $10 / 5 Std. · $22 / 7 Tage",
      },
      Pro: {
        audience: "Für tägliche Entwicklung und häufige Anfragen",
        cta: "Abonnieren",
        media: "1,200 Medienguthaben / Monat",
        mediaSub: "≈ 400 Bilder oder 5 Min. Video",
        text: "Bis zu $90 Modellnutzung / Monat",
        window: "Kurzfristige Limits: $18 / 5 Std. · $45 / 7 Tage",
      },
      Max: {
        audience: "Für Teams und hohe Workloads",
        cta: "Abonnieren",
        media: "5,000 Medienguthaben / Monat",
        mediaSub: "≈ 1,600 Bilder oder 20 Min. Video",
        text: "Bis zu $300 Modellnutzung / Monat",
        window: "Kurzfristige Limits: $60 / 5 Std. · $150 / 7 Tage",
      },
    },
    subscriptionNotRequired: "Guthabenpaket",
    sub: <>Abonnieren Sie Go, Pro oder Max für mehr Modellnutzung. Alle 100+ Modelle sind enthalten: GPT, Claude, Gemini, DeepSeek, Kimi, GLM sowie Seedance Bild und Video. <b>Enterprise-Verträge bieten zusätzlich Commit-Volumen-Rabatte</b>.</>,
    textModelsLabel: "Textmodelle",
    title: <>Flexible Preise.<br />Alle Modelle inklusive.</>,
    toolsLabel: "Tool-Guthaben",
    toolsMain: "Pro Lauf zahlen",
    toolsSub: "1,000+ Daten-APIs und MCP-Tools · nutzt Flatkey-Guthaben",
  },
  id: {
    customPrice: "Kustom",
    enterpriseAudience: "Volume komitmen dan pengadaan",
    enterpriseBody: <>Harga khusus dengan diskon volume komitmen, routing khusus, faktur, dan dukungan pengadaan.</>,
    enterpriseCta: "Hubungi sales",
    enterpriseLabel: "Perusahaan",
    imageVideoLabel: "Model gambar dan video",
    local: <>Stripe Checkout · harga adaptif (BRL/INR/CNY/EUR) · transfer bank dan faktur melalui <u>penagihan perusahaan</u> · batalkan kapan saja; pengguna baru mulai dengan kredit gratis $1</>,
    mostPopular: "PALING POPULER",
    payAsYouGo: "Top-up awal",
    payCta: (price) => `Berlangganan Pro ${price}/bulan dan masuk`,
    perMonth: "/bulan",
    payWith: paymentMethodCopy.id.payWith,
    paymentMethods: paymentMethodCopy.id.methods,
    plans: {
      Go: {
        audience: "Untuk individu dan penggunaan harian ringan",
        cta: "Berlangganan",
        media: "300 kredit media / bulan",
        mediaSub: "≈ 100 gambar atau 75 dtk video",
        text: "Hingga $45 penggunaan model / bulan",
        window: "Batas jangka pendek: $10 / 5 jam · $22 / 7 hari",
      },
      Pro: {
        audience: "Untuk pengembangan harian dan permintaan frekuensi tinggi",
        cta: "Berlangganan",
        media: "1,200 kredit media / bulan",
        mediaSub: "≈ 400 gambar atau 5 menit video",
        text: "Hingga $90 penggunaan model / bulan",
        window: "Batas jangka pendek: $18 / 5 jam · $45 / 7 hari",
      },
      Max: {
        audience: "Untuk tim dan beban kerja berat",
        cta: "Berlangganan",
        media: "5,000 kredit media / bulan",
        mediaSub: "≈ 1,600 gambar atau 20 menit video",
        text: "Hingga $300 penggunaan model / bulan",
        window: "Batas jangka pendek: $60 / 5 jam · $150 / 7 hari",
      },
    },
    subscriptionNotRequired: "Paket kredit",
    sub: <>Berlangganan Go, Pro, atau Max untuk penggunaan model yang lebih besar. Semua 100+ model tersedia: GPT, Claude, Gemini, DeepSeek, Kimi, GLM, plus gambar dan video Seedance. <b>Kontrak perusahaan menambahkan diskon volume komitmen</b>.</>,
    textModelsLabel: "Model teks",
    title: <>Harga fleksibel.<br />Semua model termasuk.</>,
    toolsLabel: "Kredit tool",
    toolsMain: "Bayar per eksekusi",
    toolsSub: "1,000+ API data dan tool MCP · memakai kredit Flatkey",
  },
} satisfies Record<Exclude<Locale, "en" | "zh">, OnlineCopy["pricing"]>;

type StaticDict = Record<string, string>;
type HomeToolDict = {
  tools?: {
    hero?: Record<string, string>;
    intro?: Record<string, string>;
    terminal?: Record<string, string>;
    universe?: Record<string, string>;
    value?: Record<string, string>;
  };
};

let staticDictCache: Record<string, StaticDict> | undefined;
let homeToolDictCache: Record<string, HomeToolDict> | undefined;

function extractAssignedObject(source: string, marker: string) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) return undefined;
  const start = source.indexOf("{", markerIndex);
  if (start < 0) return undefined;

  let depth = 0;
  let quote: string | undefined;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = undefined;
      }
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  return undefined;
}

function readPublicAsset(relativePath: string) {
  const filePath = path.join(process.cwd(), "public", "assets", relativePath);
  return fs.readFileSync(filePath, "utf8");
}

function textBeforeFirstLink(value: string) {
  return value.split(/<a\b/i)[0].trim();
}

function legalShortLabels(value: string) {
  const labels = [...value.matchAll(/<a\b[^>]*>(.*?)<\/a>/g)].map((match) => match[1]);
  return {
    terms: labels[0],
    privacy: labels[1],
    serviceLevel: labels[2],
    refund: labels[3],
  };
}

function evaluateObject<T>(source: string): T {
  return Function(`"use strict"; return (${source});`)() as T;
}

function getStaticDicts() {
  if (!staticDictCache) {
    const source = readPublicAsset("i18n.js");
    const objectSource = extractAssignedObject(source, "var DICTS =");
    staticDictCache = objectSource ? evaluateObject<Record<string, StaticDict>>(objectSource) : {};
  }
  return staticDictCache;
}

function getHomeToolDicts() {
  if (!homeToolDictCache) {
    const source = readPublicAsset("home-tools-i18n.js");
    const objectSource = extractAssignedObject(source, "window.FLATKEY_HOME_TOOLS_COPY =");
    homeToolDictCache = objectSource ? evaluateObject<Record<string, HomeToolDict>>(objectSource) : {};
  }
  return homeToolDictCache;
}

export function getOnlineStaticText(locale: Locale, key: string, fallback: string) {
  if (locale === "en") return fallback;
  return getStaticDicts()[locale]?.[key] ?? fallback;
}

function normalizeInlineHtml(value: string) {
  const signupHref = consoleUrl("/sign-up");
  return value.replace(
    /\bhref=(["'])(?:https?:\/\/flatkey\.ai\/)?\/?(?:login|signup)(?:\.html)?\1/gi,
    `href="${signupHref}"`
  );
}

function getOnlineStaticInlineHtml(locale: Locale, key: string, fallback: ReactNode) {
  const html = getOnlineStaticText(locale, key, "");
  if (!html) return fallback;
  return <span dangerouslySetInnerHTML={{ __html: normalizeInlineHtml(html) }} />;
}

export function getOnlineHomeToolText(locale: Locale, keyPath: string, fallback: string) {
  if (locale === "en") return fallback;
  const root = getHomeToolDicts()[locale] as Record<string, unknown> | undefined;
  const value = keyPath.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, root);
  return typeof value === "string" ? value : fallback;
}

function getOnlineContactCopy(locale: Locale): OnlineCopy["contact"] {
  return {
    ...en.contact,
    discord: getOnlineStaticText(locale, "ct.dc", en.contact.discord),
    email: getOnlineStaticText(locale, "ct.mail", en.contact.email),
    fine: getOnlineStaticInlineHtml(locale, "ct.fine", en.contact.fine),
    formTitle: getOnlineStaticText(locale, "ct.h2", en.contact.formTitle),
    heading: getOnlineStaticInlineHtml(locale, "ct.head", en.contact.heading),
    linkedin: getOnlineStaticText(locale, "ct.li", en.contact.linkedin),
    placeholders: {
      company: getOnlineStaticText(locale, "ct.ph3", en.contact.placeholders.company),
      email: getOnlineStaticText(locale, "ct.ph2", en.contact.placeholders.email),
      message: getOnlineStaticText(locale, "ct.ph5", en.contact.placeholders.message),
      name: getOnlineStaticText(locale, "ct.ph1", en.contact.placeholders.name),
      volume: getOnlineStaticText(locale, "ct.ph4", en.contact.placeholders.volume),
    },
    send: getOnlineStaticText(locale, "ct.send", en.contact.send),
    sub: getOnlineStaticText(locale, "ct.sub", en.contact.sub),
    why: [
      { num: "01", title: getOnlineStaticText(locale, "ct.w1t", en.contact.why[0].title), body: getOnlineStaticText(locale, "ct.w1p", en.contact.why[0].body) },
      { num: "02", title: getOnlineStaticText(locale, "ct.w2t", en.contact.why[1].title), body: getOnlineStaticText(locale, "ct.w2p", en.contact.why[1].body) },
      { num: "03", title: getOnlineStaticText(locale, "ct.w3t", en.contact.why[2].title), body: getOnlineStaticText(locale, "ct.w3p", en.contact.why[2].body) },
      { num: "04", title: getOnlineStaticText(locale, "ct.w4t", en.contact.why[3].title), body: getOnlineStaticText(locale, "ct.w4p", en.contact.why[3].body) },
    ],
  };
}

export function getOnlineStaticCopy(locale: Locale): OnlineCopy {
  if (locale === "zh") return zh;
  if (locale === "en") return en;

  const legal = getOnlineStaticText(locale, "ft.legal", en.footer.legalPrefix);
  const legalShort = legalShortLabels(legal);

  return {
    ...en,
    contact: getOnlineContactCopy(locale),
    footer: {
      ...en.footer,
      about: getOnlineStaticText(locale, "ft.about", en.footer.about),
      apiStatus: getOnlineStaticText(locale, "ft.api", en.footer.apiStatus),
      blog: getOnlineStaticText(locale, "ft.blog", en.footer.blog),
      careers: getOnlineStaticText(locale, "ft.careers", en.footer.careers),
      company: getOnlineStaticText(locale, "ft.company", en.footer.company),
      console: getOnlineStaticText(locale, "ft.console", en.footer.console),
      contact: getOnlineStaticText(locale, "ft.contact", en.footer.contact),
      developers: getOnlineStaticText(locale, "ft.dev", en.footer.developers),
      gdpr: getOnlineStaticText(locale, "ft.gdpr", en.footer.gdpr),
      legalPrefix: textBeforeFirstLink(legal),
      privacy: legalShort.privacy ?? en.footer.privacy,
      privacyFull: getOnlineStaticText(locale, "ft.privacy", en.footer.privacyFull),
      product: getOnlineStaticText(locale, "ft.product", en.footer.product),
      refund: legalShort.refund ?? en.footer.refund,
      refundFull: getOnlineStaticText(locale, "ft.refund", en.footer.refundFull),
      serviceLevel: legalShort.serviceLevel ?? en.footer.serviceLevel,
      serviceLevelFull: getOnlineStaticText(locale, "ft.sla", en.footer.serviceLevelFull),
      social: getOnlineStaticText(locale, "ft.social", en.footer.social),
      terms: legalShort.terms ?? en.footer.terms,
      termsFull: getOnlineStaticText(locale, "ft.terms", en.footer.termsFull),
      trusted: getOnlineStaticText(locale, "ft.trusted", en.footer.trusted),
      zeroRetention: getOnlineStaticText(locale, "ft.zeroret", en.footer.zeroRetention),
    },
    home: {
      ...en.home,
      balance: getOnlineStaticText(locale, "hero.balance", en.home.balance),
      ctaKey: getOnlineStaticText(locale, "hero.cta1", en.home.ctaKey),
      ctaModels: getOnlineStaticText(locale, "hero.cta2", en.home.ctaModels),
      eyebrow: getOnlineStaticText(locale, "hero.eyebrow", en.home.eyebrow),
      invoice: getOnlineStaticText(locale, "hero.invoice", en.home.invoice),
      pay: getOnlineStaticText(locale, "hero.pay", en.home.pay),
      savings: [
        getOnlineStaticText(locale, "hero.save1", en.home.savings[0]),
        getOnlineStaticText(locale, "hero.save2", en.home.savings[1]),
        getOnlineStaticText(locale, "hero.save3", en.home.savings[2]),
      ],
      sub: getOnlineStaticText(locale, "hero.sub", en.home.sub),
      terminal: {
        ...en.home.terminal,
        billed: getOnlineHomeToolText(locale, "tools.terminal.line5", en.home.terminal.billed),
        contacts: getOnlineHomeToolText(locale, "tools.terminal.line3", en.home.terminal.contacts),
        competitors: getOnlineHomeToolText(locale, "tools.terminal.line1", en.home.terminal.competitors),
        invoiceLabel: getOnlineHomeToolText(locale, "tools.terminal.invoice", en.home.terminal.invoiceLabel),
        persona: getOnlineHomeToolText(locale, "tools.terminal.line4", en.home.terminal.persona),
        runtimeLabel: getOnlineHomeToolText(locale, "tools.terminal.runtime", en.home.terminal.runtimeLabel),
        scanned: getOnlineHomeToolText(locale, "tools.terminal.line2", en.home.terminal.scanned),
        successfulLabel: getOnlineHomeToolText(locale, "tools.terminal.success", en.home.terminal.successfulLabel),
        title: getOnlineHomeToolText(locale, "tools.terminal.header", en.home.terminal.title),
      },
      toolsCommand: en.home.toolsCommand,
      toolsCopy: getOnlineHomeToolText(locale, "tools.intro.copy", en.home.toolsCopy),
      toolsKicker: getOnlineHomeToolText(locale, "tools.intro.kicker", en.home.toolsKicker),
      universeCopy: getOnlineHomeToolText(locale, "tools.universe.copy", en.home.universeCopy),
      universeKicker: getOnlineHomeToolText(locale, "tools.universe.kicker", en.home.universeKicker),
    },
    nav: {
      ...en.nav,
      cli: getOnlineStaticText(locale, "nav.cli", en.nav.cli),
      compute: getOnlineStaticText(locale, "nav.compute", en.nav.compute),
      contact: getOnlineStaticText(locale, "nav.contact", en.nav.contact),
      docs: getOnlineStaticText(locale, "nav.docs", en.nav.docs),
      models: getOnlineStaticText(locale, "nav.models", en.nav.models),
      playground: getOnlineStaticText(locale, "nav.playground", en.nav.playground),
      pricing: getOnlineStaticText(locale, "nav.pricing", en.nav.pricing),
      rankings: getOnlineStaticText(locale, "nav.rankings", en.nav.rankings),
      signin: getOnlineStaticText(locale, "nav.signin", en.nav.signin),
      start: getOnlineStaticText(locale, "nav.start", en.nav.start),
      status: getOnlineStaticText(locale, "nav.status", en.nav.status),
      tools: getOnlineHomeToolText(locale, "tools.nav", en.nav.tools),
      useCases: getOnlineStaticText(locale, "nav.usecases", en.nav.useCases),
    },
    pricing: localizedPricingCopy[locale],
  };
}
