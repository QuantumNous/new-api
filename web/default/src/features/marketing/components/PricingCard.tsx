import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import type { MarketingPlan } from '../types'

const billingLabel: Record<MarketingPlan['billingMode'], Record<'en' | 'zh', string>> = {
  payg: { en: 'Pay as you go', zh: '按量计费' },
  subscription: { en: 'Subscription', zh: '订阅' },
  custom: { en: 'Custom', zh: '定制' },
}

export function PricingCard({
  plan,
  locale,
}: {
  plan: MarketingPlan
  locale: 'en' | 'zh'
}) {
  return (
    <Card className='flex flex-col border-white/10 bg-[#111827]/70 backdrop-blur'>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <CardTitle className='text-xl text-foreground'>{plan.title}</CardTitle>
          <span className='rounded-full bg-[#4F8CFF]/10 px-3 py-1 text-xs text-[#8B5CF6]'>
            {billingLabel[plan.billingMode][locale]}
          </span>
        </div>
        <p className='mt-2 text-sm text-[#94A3B8]'>{plan.description}</p>
        <p className='mt-4 text-2xl font-bold text-foreground'>{plan.priceText}</p>
      </CardHeader>
      <CardContent className='flex flex-1 flex-col'>
        <ul className='space-y-2 text-sm text-[#94A3B8]'>
          {plan.features.map((f) => (
            <li key={f} className='flex items-start gap-2'>
              <span className='mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#22D3EE]' />
              {f}
            </li>
          ))}
        </ul>
        <Button
          className='mt-6 bg-gradient-to-r from-[#4F8CFF] to-[#8B5CF6] text-white border-0'
          render={<Link to='/sign-in' />}
        >
          {locale === 'zh' ? '开始使用' : 'Get started'}
        </Button>
      </CardContent>
    </Card>
  )
}
