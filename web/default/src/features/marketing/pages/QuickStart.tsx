import { Footer } from '@/components/layout/components/footer'
import { PublicLayout } from '@/components/layout'

import { CodeBlock } from '../components/CodeBlock'
import { Section, SectionTitle } from '../components/Section'
import { quickstart } from '../data/quickstart'
import { marketingNavLinks } from '../data/site'
import { useLocale } from '../hooks/useLocale'
import { useSeo } from '@/lib/seo'

export function QuickStart() {
  const locale = useLocale()
  const content = quickstart[locale]

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
          <div className='space-y-8'>
            {content.sections.map((s) => (
              <div key={s.heading}>
                <h3 className='mb-2 text-lg font-semibold text-foreground'>{s.heading}</h3>
                <p className='mb-3 text-sm text-[#94A3B8]'>{s.body}</p>
                {s.code && <CodeBlock code={s.code.code} lang={s.code.lang} />}
              </div>
            ))}
          </div>
        </Section>
      </div>
      <Footer />
    </PublicLayout>
  )
}
