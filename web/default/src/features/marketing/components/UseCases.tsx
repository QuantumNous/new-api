import { Section, SectionTitle } from './Section'
import type { HomeContent } from '../types'

export function UseCases({ content }: { content: HomeContent['useCases'] }) {
  return (
    <Section>
      <SectionTitle title={content.title} />
      <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-4'>
        {content.items.map((item) => (
          <div
            key={item.title}
            className='rounded-2xl border border-white/10 bg-[#111827]/70 p-6 backdrop-blur'
          >
            <h3 className='text-lg font-semibold text-foreground'>{item.title}</h3>
            <p className='mt-2 text-sm text-[#94A3B8]'>{item.description}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}
