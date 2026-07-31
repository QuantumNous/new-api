import { Section, SectionTitle } from './Section'
import type { HomeContent } from '../types'

export function ModelGateway({ content }: { content: HomeContent['modelGateway'] }) {
  return (
    <Section>
      <SectionTitle title={content.title} description={content.description} />
      <div className='grid gap-6 md:grid-cols-3'>
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
