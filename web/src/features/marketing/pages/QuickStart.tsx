import { PublicLayout } from '@/components/layout/components/public-layout'

import { useMarketingNavLinks, useSiteContent } from '../hooks/useSiteContent'
import { FooterCta } from '../components/MarketingSections'
import { CodeBlock } from '../components/CodeBlock'
import { quickStartExamples } from '../data/content'

export function MarketingQuickStart() {
  const c = useSiteContent()
  const qs = c.quickStart
  return (
    <PublicLayout
      navLinks={useMarketingNavLinks()}
      showAuthButtons
      showThemeSwitch
    >
      <section className='px-4 pt-20 pb-8 text-center'>
        <h1 className='text-4xl font-bold text-[#F8FAFC]'>{qs.title}</h1>
        <p className='mt-3 text-[#94A3B8]'>{qs.subtitle}</p>
      </section>

      <section className='px-4 pb-8'>
        <div className='mx-auto max-w-3xl rounded-2xl border border-white/10 bg-[#111827]/70 p-6'>
          <div className='text-sm text-[#94A3B8]'>{qs.baseUrlLabel}</div>
          <code className='mt-2 block rounded-lg bg-[#0b1220] px-4 py-3 text-[#22D3EE]'>
            {qs.baseUrl}
          </code>
          <p className='mt-3 text-sm text-[#94A3B8]'>{qs.baseUrlNote}</p>
        </div>
      </section>

      <section className='px-4 pb-8'>
        <div className='mx-auto max-w-3xl'>
          <h2 className='text-2xl font-bold text-[#F8FAFC]'>{qs.authTitle}</h2>
          <p className='mt-2 text-sm text-[#94A3B8]'>{qs.authDesc}</p>
          <div className='mt-4'>
            <CodeBlock code='Authorization: Bearer $ORIGINFLOW_API_KEY' />
          </div>
        </div>
      </section>

      <section className='px-4 pb-8'>
        <div className='mx-auto max-w-3xl'>
          <h2 className='text-2xl font-bold text-[#F8FAFC]'>{qs.stepsTitle}</h2>
          <ol className='mt-5 space-y-4'>
            {qs.steps.map((s, i) => (
              <li
                key={s.title}
                className='rounded-xl border border-white/10 bg-[#111827]/70 p-5'
              >
                <div className='font-semibold text-[#F8FAFC]'>
                  {i + 1}. {s.title}
                </div>
                <p className='mt-1 text-sm text-[#94A3B8]'>{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className='px-4 pb-8'>
        <div className='mx-auto max-w-3xl'>
          <h2 className='text-2xl font-bold text-[#F8FAFC]'>{qs.examplesTitle}</h2>
          <p className='mt-2 text-sm text-[#94A3B8]'>{qs.examplesNote}</p>
          <div className='mt-5 space-y-6'>
            {quickStartExamples.map((ex) => (
              <div key={ex.label}>
                <div className='mb-2 text-sm font-medium text-[#94A3B8]'>
                  {ex.label}
                </div>
                <CodeBlock code={ex.code} />
              </div>
            ))}
          </div>
          <p className='mt-6 rounded-xl border border-white/10 bg-[#111827]/50 p-4 text-sm text-[#94A3B8]'>
            {qs.note}
          </p>
        </div>
      </section>

      <FooterCta />
    </PublicLayout>
  )
}
