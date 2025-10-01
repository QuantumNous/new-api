import { HelpCircle } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
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
                <span className='text-sm leading-relaxed font-semibold [overflow-wrap:anywhere] break-words break-all'>
                  {item.question}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <p className='text-muted-foreground text-sm leading-relaxed [overflow-wrap:anywhere] break-words break-all whitespace-pre-wrap'>
                  {item.answer}
                </p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </ScrollArea>
    </PanelWrapper>
  )
}
