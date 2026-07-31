import type { UseCaseItem } from '../types'

export const solutions: Record<
  'en' | 'zh',
  { title: string; description: string; items: (UseCaseItem & { points: string[] })[] }
> = {
  en: {
    title: 'Solutions',
    description:
      'OriginFlow adapts to developers, SaaS teams, cross-border commerce, and AI resellers.',
    items: [
      {
        title: 'For Developers',
        description: 'Migrate to a multi-model gateway with minimal changes.',
        points: [
          'OpenAI-compatible SDK migration',
          'Unified key management',
          'Multi-model A/B testing',
        ],
      },
      {
        title: 'For SaaS Teams',
        description: 'Control cost and reliability at scale.',
        points: ['Team permissions', 'Cost analytics', 'Audit logs', 'Rate limits'],
      },
      {
        title: 'For Cross-border Commerce',
        description: 'Generate multilingual content and automation.',
        points: ['Copywriting', 'Product images', 'Ad creatives', 'Support automation'],
      },
      {
        title: 'For AI Resellers',
        description: 'Operate channels and billing for your customers.',
        points: ['Channel management', 'User groups', 'Quota management', 'Subscription billing'],
      },
    ],
  },
  zh: {
    title: '解决方案',
    description: '元点流商适配开发者、SaaS 团队、跨境电商与 AI 分销商。',
    items: [
      {
        title: '面向开发者',
        description: '以最小改动迁移到多模型网关。',
        points: ['兼容 OpenAI SDK 迁移', '统一 Key 管理', '多模型 A/B 测试'],
      },
      {
        title: '面向 SaaS 团队',
        description: '在规模下管控成本与稳定性。',
        points: ['团队权限', '成本分析', '审计日志', '限流'],
      },
      {
        title: '面向跨境电商',
        description: '生成多语言内容与自动化。',
        points: ['文案', '商品图', '广告素材', '客服自动化'],
      },
      {
        title: '面向 AI 分销商',
        description: '为客户运营渠道与计费。',
        points: ['渠道管理', '用户分组', '额度管理', '订阅计费'],
      },
    ],
  },
}
