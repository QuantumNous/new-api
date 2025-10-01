import { HelpCircle } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Markdown } from '@/components/ui/markdown'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useFAQ } from '@/features/dashboard/hooks/use-status-data'
import { PanelWrapper } from '../ui/panel-wrapper'

export function FAQPanel() {
  const { items: list, loading } = useFAQ()

  return (
    <PanelWrapper
      title={
        <span className='flex items-center gap-2'>
          <HelpCircle className='h-5 w-5' />
          FAQ
        </span>
      }
      loading={loading}
      empty={!list.length}
      emptyMessage='No FAQ entries available'
      height='h-80'
    >
      <ScrollArea className='h-80'>
        <Accordion type='single' collapsible className='w-full pe-4'>
          {list.map((item: any, idx: number) => (
            <AccordionItem key={idx} value={`item-${idx}`}>
              <AccordionTrigger className='text-start hover:no-underline'>
                <Markdown className='text-sm leading-relaxed font-semibold'>
                  {item.question}
                </Markdown>
              </AccordionTrigger>
              <AccordionContent>
                <Markdown className='text-muted-foreground'>
                  {item.answer}
                </Markdown>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </ScrollArea>
    </PanelWrapper>
  )
}
