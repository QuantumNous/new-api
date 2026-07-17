/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useTranslation } from 'react-i18next'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

import { SectionHeading } from './section-heading'

export function FaqSection() {
  const { t } = useTranslation()
  const items = [
    {
      value: 'gateway',
      question: t('Why use a unified model gateway?'),
      answer: t(
        'It reduces repeated authentication and protocol work while keeping model access, API keys, usage records, and billing in one place.'
      ),
    },
    {
      value: 'availability',
      question: t('Do you support every model and endpoint?'),
      answer: t(
        'Availability depends on the channels and models enabled in this deployment. Check the model catalog and documentation for the current list.'
      ),
    },
    {
      value: 'pricing',
      question: t('Can model pricing change?'),
      answer: t(
        'Model and channel pricing can change. Review the live model catalog and billing details before making a request.'
      ),
    },
    {
      value: 'first-request',
      question: t('How do I make my first request?'),
      answer: t(
        'Create an API key, confirm the base URL and model name, then use one of the request examples in the documentation.'
      ),
    },
  ]

  return (
    <section className='px-4 py-20 sm:px-6 sm:py-24 lg:py-28'>
      <div className='mx-auto w-full max-w-4xl'>
        <SectionHeading
          eyebrow={t('FAQ')}
          title={t('Common questions about model access.')}
          description={t(
            'The essentials to know before sending your first request.'
          )}
          centered
        />

        <Accordion className='border-border border-t'>
          {items.map((item) => (
            <AccordionItem
              key={item.value}
              value={item.value}
              className='border-border'
            >
              <AccordionTrigger className='min-h-16 py-4 text-base hover:no-underline'>
                {item.question}
              </AccordionTrigger>
              <AccordionContent className='text-muted-foreground max-w-3xl pb-5 leading-7'>
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
