import type { MarketingPlan } from '../types'

// 默认展示内容（后端 /api/public/pricing 未配置时的兜底）。
// 实际生产价格以后台配置与实际账单为准，页面不承诺未经验证的数值。
export const defaultPlans: Record<'en' | 'zh', MarketingPlan[]> = {
  en: [
    {
      planKey: 'starter',
      title: 'Starter',
      description: 'For individual developers and small team trials.',
      billingMode: 'payg',
      priceText: 'Pay as you go',
      features: [
        'Base model access',
        'Standard logs',
        'Basic rate limits',
        'OpenAI-compatible API',
      ],
      sort: 1,
    },
    {
      planKey: 'pro',
      title: 'Pro',
      description: 'For SaaS teams with steady production traffic.',
      billingMode: 'subscription',
      priceText: 'Monthly + usage',
      features: [
        'Higher concurrency',
        'Priority routing',
        'Usage reports',
        'Email support',
      ],
      sort: 2,
    },
    {
      planKey: 'business',
      title: 'Business',
      description: 'For enterprises and cross-border teams.',
      billingMode: 'custom',
      priceText: 'Tiered + contract',
      features: [
        'Team permissions',
        'Dedicated model pool',
        'Invoicing',
        'SLA support',
      ],
      sort: 3,
    },
    {
      planKey: 'enterprise',
      title: 'Enterprise',
      description: 'For large customers and channel resellers.',
      billingMode: 'custom',
      priceText: 'Custom quote',
      features: [
        'Private deployment',
        'Dedicated channels',
        'Regional routing',
        'Dedicated technical support',
      ],
      sort: 4,
    },
  ],
  zh: [
    {
      planKey: 'starter',
      title: 'Starter',
      description: '面向个人开发者与小团队测试。',
      billingMode: 'payg',
      priceText: '按量充值',
      features: ['基础模型接入', '标准日志', '基础限流', '兼容 OpenAI API'],
      sort: 1,
    },
    {
      planKey: 'pro',
      title: 'Pro',
      description: '面向稳定业务的 SaaS 团队。',
      billingMode: 'subscription',
      priceText: '月度订阅 + 按量',
      features: ['更高并发', '优先路由', '用量报表', '邮件支持'],
      sort: 2,
    },
    {
      planKey: 'business',
      title: 'Business',
      description: '面向企业与跨境团队。',
      billingMode: 'custom',
      priceText: '阶梯价格 + 合同',
      features: ['团队权限', '专属模型池', '发票', 'SLA 支持'],
      sort: 3,
    },
    {
      planKey: 'enterprise',
      title: 'Enterprise',
      description: '面向大客户与渠道商。',
      billingMode: 'custom',
      priceText: '定制报价',
      features: ['私有部署', '专属通道', '区域路由', '专属技术支持'],
      sort: 4,
    },
  ],
}

export const pricingFaq: Record<'en' | 'zh', { title: string; items: { q: string; a: string }[] }> = {
  en: {
    title: 'Billing FAQ',
    items: [
      {
        q: 'How does balance map to quota?',
        a: 'Balance and quota are converted per provider pricing. See the console for the exact rate.',
      },
      {
        q: 'Do prices change?',
        a: 'Upstream costs vary; prices shown are indicative and subject to the actual bill.',
      },
      {
        q: 'What about images / video / audio?',
        a: 'These may use different billing units. Details are shown on the console.',
      },
    ],
  },
  zh: {
    title: '计费说明',
    items: [
      {
        q: '余额与额度如何换算？',
        a: '余额与额度按各供应商价格换算，具体比例请见控制台。',
      },
      {
        q: '价格会变化吗？',
        a: '上游成本会波动，页面价格仅供参考，以实际账单为准。',
      },
      {
        q: '图像 / 视频 / 音频如何计费？',
        a: '可能采用不同计费单位，详情见控制台。',
      },
    ],
  },
}
