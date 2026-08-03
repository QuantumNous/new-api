import type { Locale, SiteContent } from '../types'

const en: SiteContent = {
  nav: [
    { label: 'Home', href: '/' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Models', href: '/models' },
    { label: 'Solutions', href: '/solutions' },
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
}

const zh: SiteContent = {
  nav: [
    { label: '首页', href: '/' },
    { label: '定价', href: '/pricing' },
    { label: '模型', href: '/models' },
    { label: '方案', href: '/solutions' },
    { label: '联系销售', href: '/contact-sales' },
  ],
  hero: {
    badge: '中国大模型与全球大模型的统一入口',
    title: '中国与世界大模型的统一 API 网关',
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
}

export const siteContent: Record<Locale, SiteContent> = { en, zh }
