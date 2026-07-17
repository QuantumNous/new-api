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
import { Activity01Icon, Chart01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import type { HomeCatalogModel } from '../../lib/catalog'
import { SectionHeading } from './section-heading'

interface ConsolePreviewSectionProps {
  models: HomeCatalogModel[]
}

const USAGE_BARS = [32, 46, 38, 57, 68, 52, 74, 62, 84, 71, 92, 79].map(
  (height, position) => ({ id: `usage-${position + 1}`, height })
)
const LOG_SAMPLES = [
  { time: '10:42:18', tokens: '1,824', cost: '$0.012', duration: '412 ms' },
  { time: '10:41:52', tokens: '2,306', cost: '$0.021', duration: '638 ms' },
  { time: '10:40:09', tokens: '968', cost: '$0.004', duration: '295 ms' },
  { time: '10:38:44', tokens: '1,476', cost: '$0.015', duration: '526 ms' },
]

export function ConsolePreviewSection(props: ConsolePreviewSectionProps) {
  const { t } = useTranslation()
  const metrics = [
    { label: t("Today's usage"), value: '$24.68', hint: t('Usage') },
    { label: t('Requests'), value: '18,420', hint: t('Last 24 hours') },
    { label: t('Average TPM'), value: '3,280', hint: t('Tokens per minute') },
    { label: t('Current Balance'), value: '$824.10', hint: t('Credit') },
  ]

  return (
    <section className='px-4 py-20 sm:px-6 sm:py-24 lg:py-28'>
      <div className='mx-auto w-full max-w-6xl'>
        <SectionHeading
          eyebrow={t('Usage and observability')}
          title={t('Every request leaves a clear record.')}
          description={t(
            'Review usage, cost, and response timing by model, token, and time.'
          )}
        />

        <Card className='gap-0 rounded-lg py-0 shadow-xs'>
          <header className='border-border flex min-h-13 flex-col justify-center gap-1 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5'>
            <div className='flex items-center gap-2 text-sm font-semibold'>
              <span className='bg-primary size-2 rounded-[3px]' />
              {t('Sample workspace')}
            </div>
            <span className='text-muted-foreground text-xs'>
              {t('Last 24 hours · sample data')}
            </span>
          </header>

          <div className='bg-border grid grid-cols-2 gap-px border-b lg:grid-cols-4'>
            {metrics.map((metric) => (
              <div key={metric.label} className='bg-card p-4 sm:p-5'>
                <p className='text-muted-foreground text-xs'>{metric.label}</p>
                <p className='mt-2 font-mono text-xl font-semibold tabular-nums sm:text-2xl'>
                  {metric.value}
                </p>
                <p className='text-muted-foreground mt-1 text-[11px]'>
                  {metric.hint}
                </p>
              </div>
            ))}
          </div>

          <div className='grid lg:grid-cols-[0.86fr_1.14fr]'>
            <section className='border-border p-4 sm:p-5 lg:border-e'>
              <header className='flex items-start justify-between gap-4'>
                <div className='flex items-center gap-2'>
                  <HugeiconsIcon
                    icon={Chart01Icon}
                    className='text-muted-foreground size-4'
                  />
                  <div>
                    <h3 className='text-sm font-semibold'>
                      {t('Usage trend')}
                    </h3>
                    <p className='text-muted-foreground mt-0.5 text-xs'>
                      {t('By hour')}
                    </p>
                  </div>
                </div>
                <Badge variant='secondary'>
                  <span className='bg-success size-1.5 rounded-full' />
                  {t('Healthy')}
                </Badge>
              </header>

              <div className='bg-muted/70 mt-5 flex h-48 items-end gap-2 border-b px-3 pt-4'>
                {USAGE_BARS.map((bar) => (
                  <span
                    key={bar.id}
                    className='bg-primary block w-full rounded-t-sm opacity-70'
                    style={{ height: `${bar.height}%` }}
                  />
                ))}
              </div>
              <div className='text-muted-foreground mt-2 flex justify-between font-mono text-[10px]'>
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>{t('Now')}</span>
              </div>
            </section>

            <section className='border-border border-t p-4 sm:p-5 lg:border-t-0'>
              <header className='flex items-start justify-between gap-4'>
                <div className='flex items-center gap-2'>
                  <HugeiconsIcon
                    icon={Activity01Icon}
                    className='text-muted-foreground size-4'
                  />
                  <div>
                    <h3 className='text-sm font-semibold'>
                      {t('Recent calls')}
                    </h3>
                    <p className='text-muted-foreground mt-0.5 text-xs'>
                      {t('Token redacted')}
                    </p>
                  </div>
                </div>
                <span className='text-muted-foreground text-xs'>
                  {t('Sample data')}
                </span>
              </header>

              <Table className='mt-3'>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('Time / model')}</TableHead>
                    <TableHead>{t('Tokens')}</TableHead>
                    <TableHead className='hidden sm:table-cell'>
                      {t('Cost')}
                    </TableHead>
                    <TableHead>{t('Duration')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {LOG_SAMPLES.map((sample, index) => (
                    <TableRow key={sample.time}>
                      <TableCell>
                        <span className='block font-mono text-xs font-semibold'>
                          {sample.time}
                        </span>
                        <span className='text-muted-foreground block max-w-36 truncate font-mono text-[11px]'>
                          {props.models[index]?.model_name || 'YOUR_MODEL'}
                        </span>
                      </TableCell>
                      <TableCell className='font-mono text-xs'>
                        {sample.tokens}
                      </TableCell>
                      <TableCell className='hidden font-mono text-xs sm:table-cell'>
                        {sample.cost}
                      </TableCell>
                      <TableCell className='font-mono text-xs'>
                        {sample.duration}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          </div>
        </Card>
      </div>
    </section>
  )
}
