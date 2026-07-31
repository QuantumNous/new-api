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
    enterpriseAudience: string;
    enterpriseBody: ReactNode;
    enterpriseCta: string;
    enterpriseLabel: string;
    imageVideoLabel: string;
    local: ReactNode;
    mostPopular: string;
    payAsYouGo: string;
    payCta: string;
    payWith: string;
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
      { num: "02", title: "Volume pricing below self-serve", body: "Committed-use discounts price below the self-serve tier. We quote against your current invoice." },
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
    ctaKey: "Get API Key",
    ctaModels: "Explore Models",
    eyebrow: "300+ OFFICIAL MODELS · 1,000+ AI TOOLS",
    heroTitle: (
      <>
        One key.
        <br />
        <span className="price">
          More models.
          <span className="toolLine"> More tools.</span>
          <span className="costLine">Lower costs.</span>
        </span>
      </>
    ),
    invoice: "Every model. Every tool. One invoice.",
    pay: "Pay per successful call.",
    savings: ["Model subscriptions", "Data tool subscriptions", "Automation subscriptions"],
    sub: "One balance across 300+ official models and 1,000+ pay-per-call tools. No idle seats, duplicate contracts, or scattered provider keys.",
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
    universeKicker: "300+ MODELS · 1,000+ TOOLS",
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
    enterpriseAudience: "Committed volume & procurement",
    enterpriseBody: <>Custom pricing <b>below the self-serve tiers</b> — committed-volume discounts, custom routing, invoicing and procurement.</>,
    enterpriseCta: "Contact sales →",
    enterpriseLabel: "Enterprise",
    imageVideoLabel: "Image · video models",
    local: <>Stripe Checkout · Adaptive Pricing (BRL/INR/CNY/EUR) · bank transfer & invoicing via <u>Enterprise billing</u> · cancel anytime — new users start with $1 free credit</>,
    mostPopular: "MOST POPULAR",
    payAsYouGo: "Pay as you go",
    payCta: "Subscribe Go $10/mo → sign in",
    payWith: "Pay with",
    plans: {
      Go: {
        audience: "For individuals & light daily use",
        cta: "Subscribe →",
        media: "300 media credits / mo",
        mediaSub: "≈ 100 images, or 75s of video",
        text: "Up to $45 model usage / mo",
        window: "Short-term caps: $10 / 5h · $22 / 7d",
      },
      Pro: {
        audience: "For daily development & high-frequency requests",
        cta: "Subscribe →",
        media: "1,200 media credits / mo",
        mediaSub: "≈ 400 images, or 5 min of video",
        text: "Up to $90 model usage / mo",
        window: "Short-term caps: $18 / 5h · $45 / 7d",
      },
      Max: {
        audience: "For teams & heavy workloads",
        cta: "Subscribe →",
        media: "5,000 media credits / mo",
        mediaSub: "≈ 1,600 images, or 20 min of video",
        text: "Up to $300 model usage / mo",
        window: "Short-term caps: $60 / 5h · $150 / 7d",
      },
    },
    subscriptionNotRequired: "No subscription required",
    sub: (
      <>
        Pay as you go with no monthly commitment, or subscribe to Go, Pro or Max for more model usage. All 328+ models are included — GPT, Claude,
        Gemini, DeepSeek, Kimi, GLM, plus Seedance image & video. <b>Enterprise interfaces price below self-serve</b>.
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
        习惯异步？邮件也行。
        <br />
        已经在开发？<a href={consoleUrl("/sign-up")} style={{ color: "var(--violet-deep)", fontWeight: 650 }}>免费开始，送 $1 额度 →</a>
      </>
    ),
    formTitle: "联系销售",
    heading: (
      <>
        在官方模型上扩张，
        <br />
        背后有真人兜底<span style={{ color: "var(--violet-deep)" }}>。</span>
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
      { num: "02", title: "企业价低于自助档", body: "承诺用量折扣定价低于自助档，我们按你现在的账单出报价。" },
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
    legalPrefix: "© 2026 flatkey.ai · VOC AI INC (San Jose, CA). 保留所有权利。",
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
    ctaKey: "获取 API Key",
    ctaModels: "探索模型",
    eyebrow: "300+ 官方模型 · 1,000+ AI 工具",
    heroTitle: (
      <>
        一个 key。
        <br />
        <span className="price">
          更多模型。
          <span className="toolLine">更多工具。</span>
          <span className="costLine">更低成本。</span>
        </span>
      </>
    ),
    invoice: "每个模型、每个工具，只需一张账单。",
    pay: "仅成功调用才付费。",
    savings: ["模型订阅", "数据工具订阅", "自动化工具订阅"],
    sub: "一个余额覆盖 300+ 个官方模型和 1,000+ 个按调用付费工具。无需闲置席位、重复订阅，也无需管理散落在各供应商的 API Key。",
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
        1,000+ 工具。
      </>
    ),
    universeCopy: "通过一个 Flatkey 接口调用领先 AI 模型、社交平台、网页数据、爬虫、GTM 情报以及更多能力。",
    universeKicker: "300+ 模型 · 1,000+ 工具",
    universeTitle: (
      <>
        每个模型，每个工具。
        <br />
        一个 key。
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
    enterpriseAudience: "承诺用量与企业采购",
    enterpriseBody: <>价格 <b>低于自助档</b>，承诺用量折扣、定制路由、发票与采购支持。</>,
    enterpriseCta: "联系销售 →",
    enterpriseLabel: "企业版",
    imageVideoLabel: "图像 · 视频模型",
    local: <>Stripe Checkout · 自适应定价 (BRL/INR/CNY/EUR) · 企业账单支持银行转账与发票 · 随时取消，新用户送 $1 免费额度</>,
    mostPopular: "最受欢迎",
    payAsYouGo: "按量付费",
    payCta: "订阅 Go $10/月 → 登录",
    payWith: "支付方式",
    plans: {
      Go: {
        audience: "适合个人与轻量日常使用",
        cta: "立即订阅 →",
        media: "每月 300 media credits",
        mediaSub: "约可生成 100 张图，或 75 秒视频",
        text: "每月最多 $45 模型用量",
        window: "短期上限：每 5 小时 $10 · 每 7 天 $22",
      },
      Pro: {
        audience: "适合日常开发与高频请求",
        cta: "立即订阅 →",
        media: "每月 1,200 media credits",
        mediaSub: "约可生成 400 张图，或 5 分钟视频",
        text: "每月最多 $90 模型用量",
        window: "短期上限：每 5 小时 $18 · 每 7 天 $45",
      },
      Max: {
        audience: "适合团队与高强度任务",
        cta: "立即订阅 →",
        media: "每月 5,000 media credits",
        mediaSub: "约可生成 1,600 张图，或 20 分钟视频",
        text: "每月最多 $300 模型用量",
        window: "短期上限：每 5 小时 $60 · 每 7 天 $150",
      },
    },
    subscriptionNotRequired: "无需订阅",
    sub: (
      <>
        可选择无月费承诺的按量付费，也可订阅 Go、Pro 或 Max 获得更多模型用量。全部 328+ 模型均可使用，GPT、Claude、Gemini、DeepSeek、Kimi、GLM，以及 Seedance 生图和生视频。<b>企业级接口价格低于自助档</b>。
      </>
    ),
    textModelsLabel: "文本模型",
    title: (
      <>
        灵活定价。
        <br />
        所有模型全包含。
      </>
    ),
    toolsLabel: "Tools Credits",
    toolsMain: "按次运行付费",
    toolsSub: "1,000+ 数据 API 与 MCP 工具，使用 Flatkey Credits",
  },
};

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

export function getOnlineHomeToolText(locale: Locale, keyPath: string, fallback: string) {
  if (locale === "en") return fallback;
  const root = getHomeToolDicts()[locale] as Record<string, unknown> | undefined;
  const value = keyPath.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, root);
  return typeof value === "string" ? value : fallback;
}

export function getOnlineStaticCopy(locale: Locale): OnlineCopy {
  if (locale === "zh") return zh;
  if (locale === "en") return en;

  const legal = getOnlineStaticText(locale, "ft.legal", en.footer.legalPrefix);
  const legalShort = legalShortLabels(legal);

  return {
    ...en,
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
  };
}
