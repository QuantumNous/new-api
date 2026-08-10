import { PublicLayout } from '@/components/layout/components/public-layout'

import { useMarketingNavLinks, useSiteContent } from '../hooks/useSiteContent'
import { FooterCta, Faq } from '../components/MarketingSections'
import { PricingCard } from '../components/Cards'
import { usePublicPricing } from '../hooks/usePublicData'

export function MarketingPricing() {
  const c = useSiteContent()
  const { data, isLoading, isError } = usePublicPricing()
  return (
    <PublicLayout navLinks={useMarketingNavLinks()} showAuthButtons showThemeSwitch>
      <section className='px-4 pt-20 pb-8 text-center'>
        <h1 className='text-4xl font-bold text-[#F8FAFC]'>{c.pricing.title}</h1>
        <p className='mt-3 text-[#94A3B8]'>{c.pricing.subtitle}</p>
      </section>
      <section className='px-4 pb-8'>
        {isLoading && (
          <p className='text-center text-[#94A3B8]'>Loading…</p>
        )}
        {isError && (
          <p className='text-center text-red-400'>Failed to load pricing.</p>
        )}
        {data && data.length > 0 && (
          <div className='mx-auto grid max-w-5xl gap-6 md:grid-cols-3'>
            {data.map((plan) => (
              <PricingCard key={plan.id} plan={plan} />
            ))}
          </div>
        )}
        {data && data.length === 0 && !isLoading && (
          <p className='text-center text-[#94A3B8]'>{c.pricing.note}</p>
        )}
      </section>
      <Faq />
      <FooterCta />
    </PublicLayout>
  )
}
