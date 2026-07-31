import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

import { Section, SectionTitle } from './Section'
import type { FaqItem } from '../types'

export function Faq({ title, items }: { title: string; items: FaqItem[] }) {
  return (
    <Section>
      <SectionTitle title={title} />
      <div className='mx-auto max-w-3xl'>
        <Accordion>
          {items.map((item, idx) => (
            <AccordionItem key={item.question} value={`faq-${idx}`}>
              <AccordionTrigger>{item.question}</AccordionTrigger>
              <AccordionContent>
                <p className='text-sm text-[#94A3B8]'>{item.answer}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </Section>
  )
}
