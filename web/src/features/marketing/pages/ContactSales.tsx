import { PublicLayout } from '@/components/layout/components/public-layout'

import { useMarketingNavLinks, useSiteContent } from '../hooks/useSiteContent'
import { FooterCta } from '../components/MarketingSections'
import { ContactForm } from '../components/ContactForm'

export function MarketingContactSales() {
  const c = useSiteContent()
  return (
    <PublicLayout navLinks={useMarketingNavLinks()} showAuthButtons showThemeSwitch>
      <section className='px-4 pt-20 pb-8 text-center'>
        <h1 className='text-4xl font-bold text-[#F8FAFC]'>{c.contact.title}</h1>
        <p className='mt-3 text-[#94A3B8]'>{c.contact.subtitle}</p>
      </section>
      <section className='px-4 pb-12'>
        <ContactForm />
      </section>
      <FooterCta />
    </PublicLayout>
  )
}
