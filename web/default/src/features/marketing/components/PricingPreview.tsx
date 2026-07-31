import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

import { Section, SectionTitle } from './Section'
import type { HomeContent } from '../types'

export function PricingPreview({ content }: { content: HomeContent['pricingPreview'] }) {
  return (
    <Section dark>
      <SectionTitle title={content.title} description={content.description} />
      <div className='text-center'>
        <Button
          className='bg-gradient-to-r from-[#4F8CFF] to-[#8B5CF6] text-white border-0 px-6 py-3 text-base'
          render={<Link to='/pricing' />}
        >
          {content.cta}
        </Button>
      </div>
    </Section>
  )
}
