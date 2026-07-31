import type { NavLinkItem } from '../types'

// 营销站导航（传入 PublicHeader 的 navLinks）。
export const marketingNavLinks: Record<'en' | 'zh', NavLinkItem[]> = {
  en: [
    { title: 'Home', href: '/' },
    { title: 'Pricing', href: '/pricing' },
    { title: 'Models', href: '/models' },
    { title: 'Solutions', href: '/solutions' },
    { title: 'Quick Start', href: '/quickstart' },
    { title: 'Usage', href: '/usage' },
    { title: 'Contact Sales', href: '/contact-sales' },
  ],
  zh: [
    { title: '首页', href: '/' },
    { title: '定价', href: '/pricing' },
    { title: '模型', href: '/models' },
    { title: '解决方案', href: '/solutions' },
    { title: '快速开始', href: '/quickstart' },
    { title: '用量说明', href: '/usage' },
    { title: '联系销售', href: '/contact-sales' },
  ],
}

export const marketingFooterNote: Record<'en' | 'zh', string> = {
  en: 'OriginFlow — One API for Chinese & Global AI Models.',
  zh: '元点流商 OriginFlow — 一个 API，连接中国与全球大模型。',
}
