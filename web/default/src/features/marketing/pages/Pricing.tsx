import { useQuery } from '@tanstack/react-query'
import { Footer } from '@/components/layout/components/footer'
import { PublicLayout } from '@/components/layout'

import { PricingCard } from '../components/PricingCard'
import { Section, SectionTitle } from '../components/Section'
import { getPricing } from '../api'
import { defaultPlans, pricingFaq } from '../data/pricing'
import { marketingNavLinks } from '../data/site'
import { useLocale } from '../hooks/useLocale'
import { useSeo } from '@/lib/seo'

export function Pricing() {
  const locale = useLocale()
  useSeo({
    title: locale === 'zh' ? '定价 | 元点流商 OriginFlow' : 'Pricing | OriginFlow',
    description:
      locale === 'zh'
        ? '按量、订阅与企业定制报价，透明展示销售方式与计费说明。'
        : 'Pay-as-you-go, subscription, and custom enterprise quotes with clear billing.',
  })
  const { data, isLoading } = useQuery({
    queryKey: ['marketing-pricing', locale],
    queryFn: () => getPricing(locale),
  })

  const plans = (data && data.length ? data : defaultPlans[locale])
    .slice()
    .sort((a, b) => a.sort - b.sort)
  const faq = pricingFaq[locale]

  return (
    <PublicLayout
      showMainContainer={false}
      navLinks={marketingNavLinks[locale]}
      showAuthButtons
      showThemeSwitch
    >
      <div className='pt-16'>
        <Section>
          <SectionTitle
            title={locale === 'zh' ? '定价' : 'Pricing'}
            description={
              locale === 'zh'
                ? '按量、订阅或企业定制，透明计费。'
                : 'Pay as you go, subscribe, or custom enterprise quotes.'
            }
          />
          {isLoading ? (
            <p className='text-center text-[#94A3B8]'>
              {locale === 'zh' ? '加载中…' : 'Loading…'}
            </p>
          ) : (
            <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-4'>
              {plans.map((p) => (
                <PricingCard key={p.planKey} plan={p} locale={locale} />
              ))}
            </div>
          )}
        </Section>
        <Section>
          <SectionTitle title={faq.title} />
          <div className='mx-auto max-w-3xl space-y-4'>
            {faq.items.map((item) => (
              <div key={item.q} className='rounded-xl border border-white/10 bg-[#111827]/70 p-4'>
                <p className='font-medium text-foreground'>{item.q}</p>
                <p className='mt-1 text-sm text-[#94A3B8]'>{item.a}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>
      <Footer />
    </PublicLayout>
  )
}
