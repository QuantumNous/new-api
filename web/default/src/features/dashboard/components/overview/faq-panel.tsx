import { HelpCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Markdown } from '@/components/ui/markdown'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useFAQ } from '@/features/dashboard/hooks/use-status-data'
import type { FAQItem } from '@/features/dashboard/types'
import { PanelWrapper } from '../ui/panel-wrapper'

export function FAQPanel() {
  const { t } = useTranslation()
  const { items: list, loading } = useFAQ()

  return (
    <PanelWrapper
      title={
        <span className='flex items-center gap-2'>
          <HelpCircle className='text-muted-foreground/60 size-4' />
          {t('FAQ')}
        </span>
      }
      loading={loading}
      empty={!list.length}
      emptyMessage={t('No FAQ entries available')}
      height='h-64 sm:h-80'
    >
      <ScrollArea className='h-64 sm:h-80'>
        <Accordion className='w-full'>
          {list.map((item: FAQItem, idx: number) => {
            const key = item.id ?? `faq-${idx}`
            const value = `item-${key}`
            return (
              <AccordionItem
                key={key}
                value={value}
                className='border-border/60'
              >
                <AccordionTrigger className='text-start hover:no-underline'>
                  <Markdown className='text-sm leading-relaxed font-semibold'>
                    {item.question}
                  </Markdown>
                </AccordionTrigger>
                <AccordionContent>
                  <Markdown className='text-muted-foreground/60 text-sm'>
                    {item.answer}
                  </Markdown>
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      </ScrollArea>
    </PanelWrapper>
  )
}
