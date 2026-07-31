import type { HomeContent } from '../types'

export const homeContent: Record<'en' | 'zh', HomeContent> = {
  en: {
    hero: {
      badge: 'Global AI Model Gateway',
      title: 'One API for Chinese & Global AI Models',
      subtitle:
        'Route, manage, and bill multi-provider AI traffic through a unified gateway.',
      description:
        'OriginFlow unifies access to Chinese and international LLMs behind a single OpenAI-compatible API — with centralized billing, smart routing, and full observability for developers, SaaS teams, and cross-border AI businesses.',
      primaryCta: 'Start Building',
      secondaryCta: 'Contact Sales',
      codeTitle: 'Drop-in OpenAI compatible',
      code: `import OpenAI from 'openai'

const client = new OpenAI({
  baseURL: 'https://api.91flow.com/v1',
  apiKey: 'YOUR_ORIGINFLOW_KEY',
})

const res = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello OriginFlow' }],
})`,
    },
    trustBar: [
      'OpenAI-compatible API',
      '40+ providers',
      'Unified billing',
      'Smart routing',
      'Transparent logs',
    ],
    modelGateway: {
      title: 'A unified gateway for every model',
      description:
        'One endpoint, every provider. OriginFlow normalizes request and response formats across OpenAI, Claude, Gemini, and Chinese LLMs.',
      items: [
        {
          title: 'Format conversion',
          description:
            'OpenAI / Claude / Gemini formats are converted automatically behind one API.',
        },
        {
          title: 'Centralized billing',
          description:
            'One balance, one quota, one invoice across all providers and regions.',
        },
        {
          title: 'Observability',
          description:
            'Per-request logs, token usage, cost, and latency in a single dashboard.',
        },
      ],
    },
    flow: {
      title: 'China ↔ Global, one infrastructure',
      description:
        'Connect Chinese model capabilities to the world, and bring global models into your stack — through compliant, enterprise-grade unified access.',
      outbound: {
        title: 'Chinese models outbound',
        description:
          'Expose text, image, video, voice, and multimodal Chinese model capabilities to global developers via a stable gateway.',
      },
      inbound: {
        title: 'Global models inbound',
        description:
          'Unify access to mainstream overseas model providers for cross-border and domestic teams.',
      },
    },
    useCases: {
      title: 'Built for every AI team',
      items: [
        {
          title: 'Developers',
          description:
            'Migrate in minutes with an OpenAI-compatible SDK and a single API key.',
        },
        {
          title: 'SaaS teams',
          description:
            'Team permissions, cost analytics, audit logs, and rate limits out of the box.',
        },
        {
          title: 'Cross-border commerce',
          description:
            'Copywriting, product images, ads, and customer-service automation across languages.',
        },
        {
          title: 'AI resellers',
          description:
            'Channel management, user groups, quotas, and subscription billing.',
        },
      ],
    },
    pricingPreview: {
      title: 'Simple, transparent pricing',
      description:
        'Pay as you go, monthly subscription, or enterprise custom quotes. No hidden fees.',
      cta: 'View Pricing',
    },
    faq: {
      title: 'Frequently asked questions',
      items: [
        {
          question: 'Which models are available?',
          answer:
            'Model availability, pricing, and context length follow your actual console configuration. The models page shows categories and capabilities, not fixed guarantees.',
        },
        {
          question: 'How is billing calculated?',
          answer:
            'Text, image, audio, and video models may use different billing units. All prices are subject to the page display and your actual bill.',
        },
        {
          question: 'Is it OpenAI compatible?',
          answer:
            'Yes. OriginFlow exposes an OpenAI-compatible API so you can migrate with minimal code changes.',
        },
        {
          question: 'Do you support enterprise deployment?',
          answer:
            'Enterprise customers can get private deployment, dedicated channels, regional routing, and SLA support via a custom quote.',
        },
      ],
    },
    cta: {
      title: 'Start routing global AI traffic today',
      description:
        'Create a free account, generate a key, and call any model through one API.',
      primaryCta: 'Start Building',
      secondaryCta: 'Contact Sales',
    },
  },
  zh: {
    hero: {
      badge: '全球 AI 模型网关',
      title: '一个 API，连接中国与全球大模型',
      subtitle: '统一接入、统一鉴权、统一计费、统一日志，稳定管理多模型 AI 流量。',
      description:
        '元点流商 OriginFlow 通过单一兼容 OpenAI 的 API，统一接入中国与海外大模型，为开发者、SaaS 团队和跨境 AI 企业提供集中计费、智能路由与全链路可观测。',
      primaryCta: '立即开始',
      secondaryCta: '联系销售',
      codeTitle: '兼容 OpenAI，无缝接入',
      code: `import OpenAI from 'openai'

const client = new OpenAI({
  baseURL: 'https://api.91flow.com/v1',
  apiKey: 'YOUR_ORIGINFLOW_KEY',
})

const res = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: '你好，元点流商' }],
})`,
    },
    trustBar: [
      '兼容 OpenAI API',
      '40+ 模型供应商',
      '统一计费',
      '智能路由',
      '透明日志',
    ],
    modelGateway: {
      title: '一个网关，接入所有模型',
      description:
        '一个端点，全部供应商。元点流商在单一 API 后自动完成 OpenAI、Claude、Gemini 与中国大模型的格式互转。',
      items: [
        {
          title: '格式转换',
          description: 'OpenAI / Claude / Gemini 格式在单一 API 后自动完成互转。',
        },
        {
          title: '统一计费',
          description: '跨供应商、跨区域的统一余额、额度与账单。',
        },
        {
          title: '可观测',
          description: '单次请求日志、Token 用量、成本与延迟统一看板。',
        },
      ],
    },
    flow: {
      title: '中国 ↔ 全球，一套基础设施',
      description:
        '以合规、企业级统一接入，把中国模型能力输出到世界，也将海外模型引入你的技术栈。',
      outbound: {
        title: '中国大模型出海',
        description:
          '通过稳定网关，把文本、图像、视频、语音与多模态中国模型能力开放给全球开发者。',
      },
      inbound: {
        title: '海外大模型进口',
        description: '为跨境与国内团队统一接入海外主流模型供应商能力。',
      },
    },
    useCases: {
      title: '为每一类 AI 团队而生',
      items: [
        {
          title: '开发者',
          description: '兼容 OpenAI SDK，单个 API Key 即可在数分钟内完成迁移。',
        },
        {
          title: 'SaaS 团队',
          description: '开箱即用的团队权限、成本分析、审计日志与限流。',
        },
        {
          title: '跨境电商',
          description: '跨语言的文案、商品图、广告素材与客服自动化。',
        },
        {
          title: 'AI 分销商',
          description: '渠道管理、用户分组、额度与订阅计费。',
        },
      ],
    },
    pricingPreview: {
      title: '简单透明的定价',
      description: '按量计费、月度订阅或企业定制报价，没有隐藏费用。',
      cta: '查看定价',
    },
    faq: {
      title: '常见问题',
      items: [
        {
          question: '支持哪些模型？',
          answer:
            '模型可用性、价格与上下文长度以实际控制台配置为准。模型页展示分类与能力，而非固定承诺。',
        },
        {
          question: '如何计费？',
          answer:
            '文本、图像、音频与视频模型可能采用不同计费单位。所有价格以页面展示与实际账单为准。',
        },
        {
          question: '是否兼容 OpenAI？',
          answer: '兼容。元点流商提供兼容 OpenAI 的 API，迁移代码改动极小。',
        },
        {
          question: '是否支持企业部署？',
          answer:
            '企业客户可通过定制报价获得私有部署、专属通道、区域路由与 SLA 支持。',
        },
      ],
    },
    cta: {
      title: '今天就开始统一调度全球 AI 流量',
      description: '注册免费账号，生成 Key，通过一个 API 调用任意模型。',
      primaryCta: '立即开始',
      secondaryCta: '联系销售',
    },
  },
}
