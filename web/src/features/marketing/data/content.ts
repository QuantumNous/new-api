import type { CodeExample, Locale, SiteContent } from '../types'

const en: SiteContent = {
  nav: [
    { label: 'Home', href: '/' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Models', href: '/models' },
    { label: 'Solutions', href: '/solutions' },
    { label: 'Quick Start', href: '/quick-start' },
    { label: 'Contact Sales', href: '/contact-sales' },
  ],
  hero: {
    badge: 'One API for Chinese & Global AI Models',
    title: 'Unified AI API Gateway for China & the World',
    subtitle:
      '元点流商 OriginFlow routes every major model — DeepSeek, Qwen, GPT, Claude, Gemini and more — through one key, one bill, and one dashboard.',
    primaryCta: 'Start Building',
    secondaryCta: 'View Pricing',
  },
  trustbar: {
    title: 'Trusted model providers',
    items: [
      'Alibaba',
      'Tencent',
      'Huawei',
      'DeepSeek',
      'ByteDance',
      'Moonshot',
      'Google',
      'OpenAI',
      'Anthropic',
    ],
  },
  gateway: {
    title: 'One gateway, every model',
    subtitle:
      'Normalize request/response across vendors. Swap providers without touching your code.',
    inboundLabel: 'Your App',
    outboundLabel: 'AI Providers',
  },
  flow: {
    title: 'Compute, flowing both ways',
    desc: 'Export Chinese model compute globally; import the world’s best models into China.',
    chinaLabel: 'China Compute → Global',
    globalLabel: 'Global Models → China',
  },
  useCases: {
    title: 'Built for real workloads',
    items: [
      {
        title: 'SaaS Products',
        desc: 'Ship AI features fast with a single integration and predictable billing.',
      },
      {
        title: 'Enterprises',
        desc: 'Regional routing, dedicated SLA and private deployment for compliance.',
      },
      {
        title: 'Agencies & MSPs',
        desc: 'Manage multiple clients, brands and quotas from one console.',
      },
      {
        title: 'Developers',
        desc: 'OpenAI-compatible API, SDKs and a playground to prototype in minutes.',
      },
    ],
  },
  pricing: {
    title: 'Simple, transparent pricing',
    subtitle: 'Start free, scale as you grow. No hidden fees.',
    note: 'All plans include the full model catalog and one API key.',
  },
  models: {
    title: 'The model catalog',
    subtitle: 'Every major model, one endpoint.',
  },
  solutions: {
    title: 'Solutions',
    subtitle: 'From startup to enterprise, OriginFlow adapts to your scale.',
    items: [
      {
        title: 'China Compute Export',
        desc: 'Bring Chinese open & commercial models to global users with compliant delivery.',
      },
      {
        title: 'Global Model Import',
        desc: 'Access GPT, Claude, Gemini and more for users inside China via one gateway.',
      },
      {
        title: 'Enterprise Platform',
        desc: 'Team spaces, regional routing, SLA monitoring and distributor management.',
      },
    ],
  },
  faq: {
    title: 'Frequently asked questions',
    items: [
      {
        q: 'Is the API OpenAI-compatible?',
        a: 'Yes. Most endpoints follow the OpenAI schema, so existing SDKs work with a base URL change.',
      },
      {
        q: 'How is billing calculated?',
        a: 'Pay-as-you-go by token, or fixed monthly plans with better unit pricing. One invoice.',
      },
      {
        q: 'Can I use Chinese and global models together?',
        a: 'Absolutely. Route by model name; we normalize vendor differences for you.',
      },
      {
        q: 'Do you offer enterprise SLA?',
        a: 'Yes — dedicated SLA, regional routing and private deployment are available on Enterprise.',
      },
    ],
  },
  contact: {
    title: 'Talk to our team',
    subtitle: 'Tell us about your use case and we’ll get back within one business day.',
    submit: 'Submit',
    submitting: 'Submitting…',
    success: 'Thanks! Our team will reach out shortly.',
    error: 'Submission failed. Please try again.',
    name: 'Name',
    email: 'Work email',
    company: 'Company',
    region: 'Region',
    useCase: 'Use case',
    volume: 'Estimated monthly volume',
    message: 'Message (optional)',
  },
  footerCta: {
    title: 'Ready to build with every model?',
    subtitle: 'Create an account or talk to sales — get started in minutes.',
    cta: 'Get Started',
  },
  quickStart: {
    title: 'Quick Start',
    subtitle:
      'Make your first API call in minutes — one base URL, one key, every model.',
    baseUrlLabel: 'API Base URL',
    baseUrl: 'https://api.91flow.com/v1',
    baseUrlNote:
      'Point your OpenAI-compatible SDK at this base URL. Replace it with your regional gateway if one was provided.',
    authTitle: 'Authenticate with your API key',
    authDesc:
      'Pass your secret key in the Authorization header of every request. Keep it server-side — never expose it in client code.',
    stepsTitle: 'Four steps to your first response',
    steps: [
      {
        title: 'Create an account',
        desc: 'Sign up at OriginFlow and open the API Keys page in your console.',
      },
      {
        title: 'Generate an API key',
        desc: 'Create a key, copy it once, and store it in a secure environment variable.',
      },
      {
        title: 'Set the base URL',
        desc: 'Configure your SDK base URL to https://api.91flow.com/v1 — no other changes needed.',
      },
      {
        title: 'Call any model',
        desc: 'Request any supported model by name; we normalize the vendor response for you.',
      },
    ],
    examplesTitle: 'Code examples',
    examplesNote:
      'The API follows the OpenAI schema. Swap the model name to route across providers.',
    note: 'Model availability and rate limits follow your plan and the upstream provider. See the Models and Pricing pages for details.',
  },
}

const zh: SiteContent = {
  nav: [
    { label: '首页', href: '/' },
    { label: '定价', href: '/pricing' },
    { label: '模型', href: '/models' },
    { label: '方案', href: '/solutions' },
    { label: '快速开始', href: '/quick-start' },
    { label: '联系销售', href: '/contact-sales' },
  ],
  hero: {
    badge: '中国大模型与全球大模型的统一入口',
    title: '大模型统一API网关',
    subtitle:
      '元点流商 OriginFlow 用一把密钥、一张账单、一个控制台，统一接入 DeepSeek、通义千问、GPT、Claude、Gemini 等全部主流模型。',
    primaryCta: '立即开始',
    secondaryCta: '查看定价',
  },
  trustbar: {
    title: '值得信赖的模型供应商',
    items: [
      '阿里',
      '腾讯',
      '华为',
      'DeepSeek',
      '字节',
      '月之暗面',
      'Google',
      'OpenAI',
      'Anthropic',
    ],
  },
  gateway: {
    title: '一个网关，所有模型',
    subtitle: '跨供应商统一请求/响应规范，切换模型无需改动业务代码。',
    inboundLabel: '你的应用',
    outboundLabel: 'AI 供应商',
  },
  flow: {
    title: '算力双向流动',
    desc: '将中国模型算力出口到全球，把全球最优秀的模型引入中国。',
    chinaLabel: '中国算力 → 全球',
    globalLabel: '全球模型 → 中国',
  },
  useCases: {
    title: '为真实业务场景而生',
    items: [
      {
        title: 'SaaS 产品',
        desc: '一次接入、账单可预期，快速上线 AI 能力。',
      },
      {
        title: '企业客户',
        desc: '区域路由、专属 SLA 与私有部署，满足合规要求。',
      },
      {
        title: '代理商 / MSP',
        desc: '在一个控制台管理多客户、多品牌与多额度。',
      },
      {
        title: '开发者',
        desc: '兼容 OpenAI 的 API、SDK 与调试场，几分钟完成原型。',
      },
    ],
  },
  pricing: {
    title: '简单透明的定价',
    subtitle: '免费开始，按需扩展，没有隐藏费用。',
    note: '所有套餐均包含完整模型目录与一把 API 密钥。',
  },
  models: {
    title: '模型目录',
    subtitle: '主流模型，一个端点。',
  },
  solutions: {
    title: '解决方案',
    subtitle: '从初创到企业，OriginFlow 随业务规模自适应。',
    items: [
      {
        title: '中国算力出口',
        desc: '以合规方式将中国开源与商业模型交付给全球用户。',
      },
      {
        title: '全球模型进口',
        desc: '通过统一网关，让中国用户也能访问 GPT、Claude、Gemini 等。',
      },
      {
        title: '企业平台',
        desc: '团队空间、区域路由、SLA 监控与分销商管理。',
      },
    ],
  },
  faq: {
    title: '常见问题',
    items: [
      {
        q: 'API 兼容 OpenAI 吗？',
        a: '兼容。大多数接口遵循 OpenAI 规范，更改 base URL 即可复用现有 SDK。',
      },
      {
        q: '如何计费？',
        a: '按 token 用量计费，或采用固定月费套餐享受更优单价，统一开票。',
      },
      {
        q: '可以中国模型与全球模型混用吗？',
        a: '可以。按模型名路由，差异由我们来抹平。',
      },
      {
        q: '是否提供企业级 SLA？',
        a: '提供。企业版支持专属 SLA、区域路由与私有部署。',
      },
    ],
  },
  contact: {
    title: '联系我们的团队',
    subtitle: '告诉我们您的场景，我们将在一个工作日内回复。',
    submit: '提交',
    submitting: '提交中…',
    success: '已收到！我们的团队会尽快与您联系。',
    error: '提交失败，请稍后重试。',
    name: '姓名',
    email: '工作邮箱',
    company: '公司',
    region: '所在区域',
    useCase: '使用场景',
    volume: '预计月调用量',
    message: '留言（选填）',
  },
  footerCta: {
    title: '准备好用上所有模型了吗？',
    subtitle: '注册账号或联系销售，几分钟即可开始。',
    cta: '立即开始',
  },
  quickStart: {
    title: '快速开始',
    subtitle: '几分钟内发出第一次 API 调用——一个 Base URL、一把密钥、接入全部模型。',
    baseUrlLabel: 'API Base URL',
    baseUrl: 'https://api.91flow.com/v1',
    baseUrlNote:
      '将兼容 OpenAI 的 SDK 指向该 Base URL。若分配了区域网关地址，请替换为对应地址。',
    authTitle: '使用 API 密钥鉴权',
    authDesc:
      '在每次请求的 Authorization 头中携带你的密钥。请仅在服务端使用，切勿暴露在前端代码中。',
    stepsTitle: '四步获得首次响应',
    steps: [
      {
        title: '注册账号',
        desc: '在 OriginFlow 注册并进入控制台中的 API Keys 页面。',
      },
      {
        title: '生成 API 密钥',
        desc: '创建一个密钥并立即复制保存，建议放入安全的环境变量中。',
      },
      {
        title: '设置 Base URL',
        desc: '将 SDK 的 base URL 配置为 https://api.91flow.com/v1，无需其他改动。',
      },
      {
        title: '调用任意模型',
        desc: '按模型名发起请求，差异由 OriginFlow 自动抹平。',
      },
    ],
    examplesTitle: '代码示例',
    examplesNote: '接口遵循 OpenAI 规范，替换模型名即可在不同供应商间路由。',
    note: '模型的可用性与速率限制取决于你的套餐与上游供应商，详见「模型」与「定价」页面。',
  },
}

// 代码示例与语言无关，中英文共用一份（Base URL / 鉴权方式保持一致）
export const quickStartExamples: CodeExample[] = [
  {
    label: 'cURL',
    lang: 'bash',
    code: `curl https://api.91flow.com/v1/chat/completions \\
  -H "Authorization: Bearer $ORIGINFLOW_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`,
  },
  {
    label: 'Python (OpenAI SDK)',
    lang: 'python',
    code: `from openai import OpenAI

client = OpenAI(
    base_url="https://api.91flow.com/v1",
    api_key="YOUR_ORIGINFLOW_API_KEY",
)

resp = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(resp.choices[0].message.content)`,
  },
  {
    label: 'Node.js (OpenAI SDK)',
    lang: 'javascript',
    code: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://api.91flow.com/v1",
  apiKey: "YOUR_ORIGINFLOW_API_KEY",
});

const resp = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Hello!" }],
});
console.log(resp.choices[0].message.content);`,
  },
]

export const siteContent: Record<Locale, SiteContent> = { en, zh }
