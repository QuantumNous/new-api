import { type Locale, withIdFallback } from "./locales";

export type StaticFeaturePageKey = "compute" | "docs" | "model" | "playground" | "status" | "topup" | "usecases";

type FeaturePageCopy = {
  eyebrow: string;
  title: string;
  description: string;
  primary: string;
  secondary: string;
  stats: { label: string; value: string }[];
  sections: {
    body: string;
    kicker: string;
    title: string;
  }[];
};

export type StaticFeaturePageContent = FeaturePageCopy & {
  metadataDescription: string;
  metadataTitle: string;
  pathname: string;
};

type StaticFeaturePageDefinition = {
  metadataDescription: string;
  metadataTitle: string;
  pathname: string;
  copy: Record<Locale, FeaturePageCopy>;
};

const defaultCopy = {
  compute: {
    eyebrow: "Flatkey Compute",
    title: "Dedicated inference GPUs, by the hour.",
    description:
      "Move from shared per-token routing to dedicated capacity when workloads need predictable throughput, enterprise review and unified billing.",
    primary: "Join the waitlist",
    secondary: "Talk to sales",
    stats: [
      { value: "$1.79/hr", label: "H100 market-floor target" },
      { value: "SLA", label: "Signed operating terms" },
      { value: "1 bill", label: "Models and compute together" },
    ],
    sections: [
      {
        kicker: "Capacity loop",
        title: "The compute market is crowded. The loop is not.",
        body: "Flatkey connects metered model access and dedicated inference capacity, so teams can move heavy traffic without creating another disconnected vendor workflow.",
      },
      {
        kicker: "Upgrade path",
        title: "From per-token to dedicated, in one step",
        body: "Start with the router, identify stable high-volume workloads, then reserve hourly GPU capacity under the same commercial relationship.",
      },
      {
        kicker: "Positioning",
        title: "Not another GPU cloud",
        body: "Compute is designed as a B2B extension to Flatkey usage, not a separate infrastructure marketplace with another account system.",
      },
    ],
  },
  docs: {
    eyebrow: "Documentation",
    title: "Ship on Flatkey with official API shapes.",
    description:
      "Quickstarts for the OpenAI-compatible router, Anthropic-native workflows, tool integrations, model catalog, governance and billing.",
    primary: "Open console",
    secondary: "View models",
    stats: [
      { value: "OpenAI", label: "Compatible base URL" },
      { value: "Anthropic", label: "Native request shape" },
      { value: "Tools", label: "Codex and Claude Code" },
    ],
    sections: [
      {
        kicker: "Start",
        title: "Use one key with existing SDKs",
        body: "Point your client at the Flatkey router endpoint, keep standard request formats, and manage model routing from the console.",
      },
      {
        kicker: "Integrations",
        title: "Built for coding agents and app builders",
        body: "Docs cover Codex, Claude Code, Cursor, Cline and browser playground workflows so teams can validate before changing production traffic.",
      },
      {
        kicker: "Operations",
        title: "Governance and billing stay visible",
        body: "Track keys, quotas, usage, recharge records and team policy from one product surface.",
      },
    ],
  },
  model: {
    eyebrow: "Model API",
    title: "One model API surface for frontier providers.",
    description:
      "Review model capabilities, compare request formats and route traffic through a single managed API key.",
    primary: "Get an API key",
    secondary: "Browse models",
    stats: [
      { value: "200+", label: "Models available" },
      { value: "1", label: "Unified key" },
      { value: "Live", label: "Health and pricing context" },
    ],
    sections: [
      {
        kicker: "Catalog",
        title: "Find the right model before you call it",
        body: "Flatkey keeps pricing, provider, availability and model notes close to the integration path.",
      },
      {
        kicker: "Compatibility",
        title: "Keep standard client code",
        body: "Use OpenAI-compatible requests where possible and native formats where they matter.",
      },
      {
        kicker: "Control",
        title: "Route access through one operational layer",
        body: "Centralize keys, quotas and billing instead of spreading them across provider dashboards.",
      },
    ],
  },
  playground: {
    eyebrow: "Playground",
    title: "Try frontier models before wiring production.",
    description:
      "Generate cURL, JavaScript, Python and tool snippets for Flatkey router calls, then move the same model selection into your app.",
    primary: "Open console",
    secondary: "Browse pricing",
    stats: [
      { value: "cURL", label: "Request examples" },
      { value: "JS/Python", label: "SDK snippets" },
      { value: "Live", label: "Model health context" },
    ],
    sections: [
      {
        kicker: "Prototype",
        title: "Validate prompts in the browser",
        body: "Use the playground workflow to compare model behavior before committing code or budget.",
      },
      {
        kicker: "Copy",
        title: "Move from preview to code",
        body: "Copy snippets for common environments and keep the same Flatkey base URL across tools.",
      },
      {
        kicker: "Operate",
        title: "Stay aware of cost and health",
        body: "Pair prompt tests with pricing and availability context so the chosen model is practical in production.",
      },
    ],
  },
  status: {
    eyebrow: "API Status",
    title: "Router health for production teams.",
    description:
      "Track component status, uptime and incident history for the Flatkey model router and related public services.",
    primary: "Open console",
    secondary: "Contact support",
    stats: [
      { value: "90 days", label: "Uptime window" },
      { value: "Live", label: "Component health" },
      { value: "24/7", label: "Operational visibility" },
    ],
    sections: [
      {
        kicker: "Router",
        title: "Watch the API path that serves model calls",
        body: "Status keeps model routing health separate from marketing pages and dashboard workflows.",
      },
      {
        kicker: "Incidents",
        title: "Review history before large rollouts",
        body: "Teams can check recent events before migration windows, launches or batch workloads.",
      },
      {
        kicker: "Support",
        title: "Escalate with context",
        body: "When a workload is affected, support can map symptoms to components and provider routing faster.",
      },
    ],
  },
  topup: {
    eyebrow: "Pricing",
    title: "Flexible pricing. Every model included.",
    description:
      "Prepaid balances and monthly plans cover Flatkey's model catalog, with enterprise terms available for high-volume teams.",
    primary: "Start free",
    secondary: "Contact sales",
    stats: [
      { value: "$10", label: "Go plan" },
      { value: "$30", label: "Pro plan" },
      { value: "$100", label: "Max plan" },
    ],
    sections: [
      {
        kicker: "Self serve",
        title: "Start with prepaid usage",
        body: "Use one balance across supported models and keep spending visible in the console.",
      },
      {
        kicker: "Plans",
        title: "Choose the monthly envelope that fits",
        body: "Plans bundle access, dashboard controls and account limits so teams can start without a sales cycle.",
      },
      {
        kicker: "Enterprise",
        title: "Move volume into custom terms",
        body: "For larger workloads, Flatkey can support negotiated rates, invoicing and SLA review.",
      },
    ],
  },
  usecases: {
    eyebrow: "Use cases",
    title: "Your coding agents, cheaper than list.",
    description:
      "Ship Codex, Claude Code and Image Buddy workflows through one subscription, one router and one operational dashboard.",
    primary: "Get a key",
    secondary: "See tools",
    stats: [
      { value: "33-60%", label: "Target savings vs list" },
      { value: "1 line", label: "Tool setup path" },
      { value: "Every model", label: "One subscription" },
    ],
    sections: [
      {
        kicker: "Codex",
        title: "Keep the OpenAI-compatible workflow",
        body: "Route Codex CLI usage through Flatkey for lower metered spend, a single prepaid balance and clearer usage review.",
      },
      {
        kicker: "Claude Code",
        title: "Same workflow, lower bill",
        body: "Flatkey supports Anthropic-shaped traffic so agent sessions can route through your existing Flatkey account.",
      },
      {
        kicker: "Image Buddy",
        title: "Bring image workflows under the same controls",
        body: "Keep creative and coding automation spend visible from the same billing and key management surface.",
      },
    ],
  },
} satisfies Record<StaticFeaturePageKey, FeaturePageCopy>;

const zhCopy = {
  compute: {
    eyebrow: "Flatkey Compute",
    title: "按小时使用专属推理 GPU。",
    description: "当工作负载需要稳定吞吐、企业评审和统一账单时，从共享的按 token 路由平滑切到专属算力。",
    primary: "加入候补名单",
    secondary: "联系销售",
    stats: [
      { value: "$1.79/hr", label: "H100 目标底价" },
      { value: "SLA", label: "签署运营条款" },
      { value: "1 bill", label: "模型和算力同一张账单" },
    ],
    sections: [
      { kicker: "容量闭环", title: "算力市场很拥挤，但闭环不拥挤。", body: "Flatkey 把按量模型访问和专属推理容量连在一起，让团队迁移重流量时不用再创建另一个割裂的供应商流程。" },
      { kicker: "升级路径", title: "从按 token 到专属容量，一步完成", body: "先用路由器识别稳定高量工作负载，再在同一商业关系下预留按小时计费的 GPU 容量。" },
      { kicker: "定位", title: "不是另一个 GPU 云", body: "Compute 是 Flatkey 用量的 B2B 延伸，不是带着另一套账号体系的独立基础设施市场。" },
    ],
  },
  docs: {
    eyebrow: "文档",
    title: "用官方 API 形态在 Flatkey 上上线。",
    description: "覆盖 OpenAI 兼容路由、Anthropic 原生工作流、工具集成、模型目录、治理和账单的快速开始。",
    primary: "打开控制台",
    secondary: "查看模型",
    stats: [
      { value: "OpenAI", label: "兼容 base URL" },
      { value: "Anthropic", label: "原生请求形态" },
      { value: "Tools", label: "Codex 与 Claude Code" },
    ],
    sections: [
      { kicker: "开始", title: "用现有 SDK 接一把 key", body: "把客户端指向 Flatkey router endpoint，保留标准请求格式，并在控制台管理模型路由。" },
      { kicker: "集成", title: "为 coding agents 和应用开发者设计", body: "文档覆盖 Codex、Claude Code、Cursor、Cline 和浏览器 Playground 工作流，便于团队在切生产流量前验证。" },
      { kicker: "运营", title: "治理和账单保持可见", body: "在一个产品界面里跟踪 key、额度、用量、充值记录和团队策略。" },
    ],
  },
  model: {
    eyebrow: "模型 API",
    title: "一个模型 API 面向所有前沿供应商。",
    description: "查看模型能力、比较请求格式，并通过一把托管 API key 路由流量。",
    primary: "获取 API key",
    secondary: "浏览模型",
    stats: [
      { value: "200+", label: "可用模型" },
      { value: "1", label: "统一 key" },
      { value: "Live", label: "健康度和价格上下文" },
    ],
    sections: [
      { kicker: "目录", title: "调用前先找到合适模型", body: "Flatkey 把价格、供应商、可用性和模型说明放在接入路径旁边。" },
      { kicker: "兼容", title: "保留标准客户端代码", body: "能用 OpenAI 兼容请求的地方就保持兼容，需要原生格式的地方也保留原生形态。" },
      { kicker: "控制", title: "用一个运营层路由访问", body: "集中管理 key、额度和账单，而不是分散在不同供应商 dashboard 里。" },
    ],
  },
  playground: {
    eyebrow: "Playground",
    title: "接生产前先试前沿模型。",
    description: "生成 Flatkey router 调用的 cURL、JavaScript、Python 和工具代码片段，再把同样的模型选择迁到应用里。",
    primary: "打开控制台",
    secondary: "浏览价格",
    stats: [
      { value: "cURL", label: "请求示例" },
      { value: "JS/Python", label: "SDK 代码片段" },
      { value: "Live", label: "模型健康度上下文" },
    ],
    sections: [
      { kicker: "原型", title: "在浏览器里验证 prompt", body: "用 Playground 工作流比较模型行为，再投入代码或预算。" },
      { kicker: "复制", title: "从预览迁到代码", body: "复制常见环境的代码片段，并在工具间保持同一个 Flatkey base URL。" },
      { kicker: "运营", title: "随时关注成本和健康度", body: "把 prompt 测试和价格、可用性上下文放在一起，确保选出的模型适合生产。" },
    ],
  },
  status: {
    eyebrow: "API 状态",
    title: "给生产团队看的 Router 健康度。",
    description: "跟踪 Flatkey 模型路由器及相关公开服务的组件状态、可用性和事故历史。",
    primary: "打开控制台",
    secondary: "联系支持",
    stats: [
      { value: "90 days", label: "可用性窗口" },
      { value: "Live", label: "组件健康度" },
      { value: "24/7", label: "运营可见性" },
    ],
    sections: [
      { kicker: "Router", title: "关注承载模型调用的 API 路径", body: "状态页把模型路由健康度与营销页、dashboard 工作流分开展示。" },
      { kicker: "事故", title: "大规模上线前查看历史", body: "团队可以在迁移窗口、发布或批处理任务前查看近期事件。" },
      { kicker: "支持", title: "带着上下文升级问题", body: "当工作负载受影响时，支持团队能更快把症状映射到组件和供应商路由。" },
    ],
  },
  topup: {
    eyebrow: "价格",
    title: "灵活定价。所有模型全包含。",
    description: "预付余额和月度套餐覆盖 Flatkey 模型目录，高量团队可使用企业条款。",
    primary: "免费开始",
    secondary: "联系销售",
    stats: [
      { value: "$10", label: "Go 套餐" },
      { value: "$30", label: "Pro 套餐" },
      { value: "$100", label: "Max 套餐" },
    ],
    sections: [
      { kicker: "自助", title: "从预付用量开始", body: "用一份余额覆盖支持的模型，并在控制台保持花销可见。" },
      { kicker: "套餐", title: "选择合适的月度额度", body: "套餐打包访问能力、dashboard 控制和账号限制，让团队无需销售流程即可开始。" },
      { kicker: "企业", title: "把高量用量迁到定制条款", body: "更大工作负载可使用协商价格、发票和 SLA 评审。" },
    ],
  },
  usecases: {
    eyebrow: "使用场景",
    title: "你的 coding agents，比标价更便宜。",
    description: "通过一个订阅、一个路由器和一个运营 dashboard 运行 Codex、Claude Code 和 Image Buddy 工作流。",
    primary: "获取 key",
    secondary: "查看工具",
    stats: [
      { value: "33-60%", label: "相对标价的目标节省" },
      { value: "1 line", label: "工具接入路径" },
      { value: "Every model", label: "一个订阅覆盖" },
    ],
    sections: [
      { kicker: "Codex", title: "保留 OpenAI 兼容工作流", body: "把 Codex CLI 用量通过 Flatkey 路由，获得更低计量成本、单一预付余额和更清晰的用量复盘。" },
      { kicker: "Claude Code", title: "工作流不变，账单更低", body: "Flatkey 支持 Anthropic 形态流量，让 agent 会话通过现有 Flatkey 账号路由。" },
      { kicker: "Image Buddy", title: "把图像工作流纳入同一套控制", body: "创意和 coding 自动化花销都从同一个账单和 key 管理界面可见。" },
    ],
  },
} satisfies Record<StaticFeaturePageKey, FeaturePageCopy>;

const localizedCopies = withIdFallback({
  en: defaultCopy,
  zh: zhCopy,
  es: defaultCopy,
  fr: defaultCopy,
  pt: defaultCopy,
  ru: defaultCopy,
  ja: defaultCopy,
  vi: defaultCopy,
  de: defaultCopy,
});

export const staticFeaturePages: Record<StaticFeaturePageKey, StaticFeaturePageDefinition> = {
  compute: {
    pathname: "/compute",
    metadataTitle: "flatkey Compute - Dedicated inference GPUs by the hour",
    metadataDescription:
      "flatkey Compute offers dedicated inference GPUs by the hour with unified billing and enterprise review.",
    copy: Object.fromEntries(Object.entries(localizedCopies).map(([locale, copies]) => [locale, copies.compute])) as Record<Locale, FeaturePageCopy>,
  },
  docs: {
    pathname: "/docs",
    metadataTitle: "flatkey - Documentation",
    metadataDescription:
      "flatkey documentation for the OpenAI-compatible router, Anthropic-native workflows, tool integrations, model catalog, governance and billing.",
    copy: Object.fromEntries(Object.entries(localizedCopies).map(([locale, copies]) => [locale, copies.docs])) as Record<Locale, FeaturePageCopy>,
  },
  model: {
    pathname: "/model",
    metadataTitle: "Flatkey Model API",
    metadataDescription: "Flatkey model overview and API examples for unified model routing.",
    copy: Object.fromEntries(Object.entries(localizedCopies).map(([locale, copies]) => [locale, copies.model])) as Record<Locale, FeaturePageCopy>,
  },
  playground: {
    pathname: "/playground",
    metadataTitle: "flatkey - Playground",
    metadataDescription:
      "Try frontier models in the browser and generate snippets for the official flatkey router endpoint.",
    copy: Object.fromEntries(Object.entries(localizedCopies).map(([locale, copies]) => [locale, copies.playground])) as Record<Locale, FeaturePageCopy>,
  },
  status: {
    pathname: "/status",
    metadataTitle: "flatkey - API Status",
    metadataDescription: "Live status for the flatkey router, component health and incident history.",
    copy: Object.fromEntries(Object.entries(localizedCopies).map(([locale, copies]) => [locale, copies.status])) as Record<Locale, FeaturePageCopy>,
  },
  topup: {
    pathname: "/topup",
    metadataTitle: "flatkey - Pricing",
    metadataDescription:
      "flatkey pricing with prepaid balances, monthly plans and enterprise rates for supported models.",
    copy: Object.fromEntries(Object.entries(localizedCopies).map(([locale, copies]) => [locale, copies.topup])) as Record<Locale, FeaturePageCopy>,
  },
  usecases: {
    pathname: "/usecases",
    metadataTitle: "flatkey - Use cases",
    metadataDescription:
      "Ship Codex, Claude Code and Image Buddy on flatkey with one subscription, every model and visible spend.",
    copy: Object.fromEntries(Object.entries(localizedCopies).map(([locale, copies]) => [locale, copies.usecases])) as Record<Locale, FeaturePageCopy>,
  },
};

export function getStaticFeaturePage(key: StaticFeaturePageKey, locale: Locale): StaticFeaturePageContent {
  const page = staticFeaturePages[key];
  return {
    ...page.copy[locale],
    metadataDescription: page.metadataDescription,
    metadataTitle: page.metadataTitle,
    pathname: page.pathname,
  };
}
