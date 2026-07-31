import { Section, SectionTitle } from './Section'
import type { HomeContent } from '../types'

export function ChinaGlobalFlow({ content }: { content: HomeContent['flow'] }) {
  return (
    <Section dark>
      <SectionTitle title={content.title} description={content.description} />
      <div className='grid gap-6 md:grid-cols-2'>
        <div className='rounded-2xl border border-[#4F8CFF]/30 bg-gradient-to-br from-[#4F8CFF]/10 to-transparent p-6'>
          <h3 className='text-xl font-semibold text-[#4F8CFF]'>{content.outbound.title}</h3>
          <p className='mt-2 text-sm text-[#94A3B8]'>{content.outbound.description}</p>
        </div>
        <div className='rounded-2xl border border-[#8B5CF6]/30 bg-gradient-to-br from-[#8B5CF6]/10 to-transparent p-6'>
          <h3 className='text-xl font-semibold text-[#8B5CF6]'>{content.inbound.title}</h3>
          <p className='mt-2 text-sm text-[#94A3B8]'>{content.inbound.description}</p>
        </div>
      </div>
    </Section>
  )
}
