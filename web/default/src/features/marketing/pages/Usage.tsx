import { Footer } from '@/components/layout/components/footer'
import { PublicLayout } from '@/components/layout'

import { Section, SectionTitle } from '../components/Section'
import { usage } from '../data/usage'
import { marketingNavLinks } from '../data/site'
import { useLocale } from '../hooks/useLocale'
import { useSeo } from '@/lib/seo'

export function Usage() {
  const locale = useLocale()
  const content = usage[locale]

  useSeo({ title: content.title, description: content.description })

  return (
    <PublicLayout
      showMainContainer={false}
      navLinks={marketingNavLinks[locale]}
      showAuthButtons
      showThemeSwitch
    >
      <div className='pt-16'>
        <Section>
          <SectionTitle title={content.title} description={content.description} />
          <p className='mb-8 max-w-3xl text-sm text-[#94A3B8]'>{content.intro}</p>
          <div className='grid gap-4 md:grid-cols-2'>
            {content.items.map((item) => (
              <div
                key={item.term}
                className='rounded-2xl border border-white/10 bg-[#111827]/70 p-5 backdrop-blur'
              >
                <h3 className='text-base font-semibold text-foreground'>{item.term}</h3>
                <p className='mt-2 text-sm text-[#94A3B8]'>{item.detail}</p>
              </div>
            ))}
          </div>
          <p className='mt-8 rounded-xl border border-white/10 bg-[#0b1120] p-4 text-sm text-[#94A3B8]'>
            {content.billingNote}
          </p>
        </Section>
      </div>
      <Footer />
    </PublicLayout>
  )
}
