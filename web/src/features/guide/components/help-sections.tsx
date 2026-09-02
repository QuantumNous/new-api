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
import { LifeBuoy, Wand2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

import { troubleshootRows, useCaseRows } from '../data'

const DIFFICULTY_HUE: Record<string, string> = {
  简单: 'var(--success)',
  中等: 'var(--warning)',
  较难: 'var(--destructive)',
}

/** "Which tool should I use?" quick picker. */
export function UseCasePicker() {
  const { t } = useTranslation()

  return (
    <div className='flex flex-col gap-5'>
      <div className='flex items-center gap-3'>
        <span className='bg-secondary text-secondary-foreground flex size-10 items-center justify-center rounded-2xl'>
          <Wand2 className='size-5' />
        </span>
        <div>
          <h2 className='text-xl font-extrabold text-balance md:text-2xl'>
            {t('Not sure which tool? Start from what you want to do')}
          </h2>
          <p className='text-muted-foreground text-sm'>
            {t('Pick your tool, follow the steps')}
          </p>
        </div>
      </div>

      <div className='grid gap-3 sm:grid-cols-2'>
        {useCaseRows.map((row) => (
          <div
            key={row.useCase}
            className='dopa-lift border-border bg-card flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5'
          >
            <div className='min-w-0'>
              <p className='text-sm font-semibold'>{row.useCase}</p>
              <p className='text-muted-foreground mt-0.5 truncate text-xs'>
                {row.tools}
              </p>
            </div>
            <span
              className='shrink-0 rounded-full px-2.5 py-1 text-xs font-bold'
              style={{
                backgroundColor: `color-mix(in oklab, ${DIFFICULTY_HUE[row.difficulty]} 14%, transparent)`,
                color: DIFFICULTY_HUE[row.difficulty],
              }}
            >
              {row.difficulty}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Plain-language error decoder table. */
export function Troubleshoot() {
  const { t } = useTranslation()

  return (
    <div className='flex flex-col gap-5'>
      <div className='flex items-center gap-3'>
        <span
          className='flex size-10 items-center justify-center rounded-2xl'
          style={{
            backgroundColor:
              'color-mix(in oklab, var(--info) 14%, transparent)',
            color: 'var(--info)',
          }}
        >
          <LifeBuoy className='size-5' />
        </span>
        <div>
          <h2 className='text-xl font-extrabold text-balance md:text-2xl'>
            {t('Saw an error? Decode it here')}
          </h2>
          <p className='text-muted-foreground text-sm'>
            {t('Every common error in plain language, with the fix next to it')}
          </p>
        </div>
      </div>

      <Accordion className='border-border bg-card rounded-3xl border px-5'>
        {troubleshootRows.map((row, i) => (
          <AccordionItem
            key={row.error}
            value={`err-${i}`}
            className={i === troubleshootRows.length - 1 ? 'border-b-0' : ''}
          >
            <AccordionTrigger className='py-4 text-left font-mono text-sm font-semibold hover:no-underline'>
              {row.error}
            </AccordionTrigger>
            <AccordionContent className='flex flex-col gap-2 pb-4'>
              <p className='text-sm'>
                <span className='text-muted-foreground'>
                  {t('What it means')}:{' '}
                </span>
                {row.meaning}
              </p>
              <p className='text-sm'>
                <span className='font-semibold' style={{ color: 'var(--success)' }}>
                  {t('How to fix')}:{' '}
                </span>
                {row.fix}
              </p>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
