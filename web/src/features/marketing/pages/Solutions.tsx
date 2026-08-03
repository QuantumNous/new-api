import { PublicLayout } from '@/components/layout/components/public-layout'

import { useMarketingNavLinks, useSiteContent } from '../hooks/useSiteContent'
import { FooterCta } from '../components/MarketingSections'

export function MarketingSolutions() {
  const c = useSiteContent()
  return (
    <PublicLayout navLinks={useMarketingNavLinks()} showAuthButtons showThemeSwitch>
      <section className='px-4 pt-20 pb-8 text-center'>
        <h1 className='text-4xl font-bold text-[#F8FAFC]'>{c.solutions.title}</h1>
        <p className='mt-3 text-[#94A3B8]'>{c.solutions.subtitle}</p>
      </section>
      <section className='px-4 pb-8'>
        <div className='mx-auto grid max-w-5xl gap-6 md:grid-cols-3'>
          {c.solutions.items.map((item) => (
            <div
              key={item.title}
              className='rounded-2xl border border-white/10 bg-[#111827]/70 p-6'
            >
              <div className='text-lg font-semibold text-[#F8FAFC]'>
                {item.title}
              </div>
              <p className='mt-2 text-sm text-[#94A3B8]'>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
      <FooterCta />
    </PublicLayout>
  )
}
