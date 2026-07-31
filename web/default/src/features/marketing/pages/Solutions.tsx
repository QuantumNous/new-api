import { Footer } from '@/components/layout/components/footer'
import { PublicLayout } from '@/components/layout'

import { Section, SectionTitle } from '../components/Section'
import { marketingNavLinks } from '../data/site'
import { solutions } from '../data/solutions'
import { useLocale } from '../hooks/useLocale'

export function Solutions() {
  const locale = useLocale()
  const content = solutions[locale]

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
          <div className='grid gap-6 md:grid-cols-2'>
            {content.items.map((item) => (
              <div
                key={item.title}
                className='rounded-2xl border border-white/10 bg-[#111827]/70 p-6 backdrop-blur'
              >
                <h3 className='text-xl font-semibold text-foreground'>{item.title}</h3>
                <p className='mt-2 text-sm text-[#94A3B8]'>{item.description}</p>
                <ul className='mt-4 space-y-2 text-sm text-[#94A3B8]'>
                  {item.points.map((p) => (
                    <li key={p} className='flex items-start gap-2'>
                      <span className='mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#22D3EE]' />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      </div>
      <Footer />
    </PublicLayout>
  )
}
