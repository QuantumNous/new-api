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
import { Sparkles, TrendingDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AnimateInView } from '@/components/animate-in-view'

export function SmartRouting() {
  const { t } = useTranslation()

  // Non-technical pitch for smart model selection (deeprouter-auto). Each row
  // is a concrete everyday example: question → which tier of model handles it
  // → the saving. Keeps the "you don't need to know models" promise tangible.
  const examples = [
    {
      level: t('Easy'),
      dot: 'bg-emerald-500',
      ask: t('“What day is it today?”'),
      model: t('→ a fast, cheap model'),
      note: t('about 95% cheaper'),
    },
    {
      level: t('Medium'),
      dot: 'bg-amber-500',
      ask: t('“Write a polite follow-up email”'),
      model: t('→ a balanced mid-tier model'),
      note: t('best value'),
    },
    {
      level: t('Hard'),
      dot: 'bg-rose-500',
      ask: t('“Analyse this code and fix the bug”'),
      model: t('→ a top-tier model, only when needed'),
      note: t('full power'),
    },
  ]

  return (
    <section className='border-border relative z-10 border-t px-6 py-24 md:py-32'>
      <div className='mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2 md:gap-16'>
        <AnimateInView animation='fade-up'>
          <p className='text-muted-foreground mb-3 flex items-center gap-2 text-xs font-semibold tracking-widest uppercase'>
            <Sparkles className='size-4' strokeWidth={1.5} />
            {t('Smart Routing')}
          </p>
          <h2 className='mb-5 text-3xl font-bold tracking-normal md:text-5xl'>
            {t("Don't know which model to pick? We do.")}
          </h2>
          <p className='text-muted-foreground mb-6 text-base leading-relaxed md:text-lg'>
            {t(
              'Just set the model to “auto”. DeepRouter reads each request and sends it to the cheapest model that can do the job well — so simple questions cost pennies and only the hard ones use a premium model. You save money without thinking about it.'
            )}
          </p>
          <div className='text-accent-foreground bg-accent inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold'>
            <TrendingDown className='size-4' strokeWidth={2} />
            {t('Up to 90% cheaper on everyday tasks')}
          </div>
        </AnimateInView>

        <AnimateInView animation='fade-up' delay={150}>
          <div className='border-border bg-card rounded-2xl border p-6 shadow-[0_8px_24px_rgb(28_28_28/0.06)] md:p-8'>
            <p className='text-muted-foreground mb-5 text-xs font-semibold tracking-widest uppercase'>
              {t('For example')}
            </p>
            <div className='flex flex-col gap-5'>
              {examples.map((ex) => (
                <div key={ex.level} className='flex items-start gap-3'>
                  <span
                    className={`mt-1.5 size-2.5 shrink-0 rounded-full ${ex.dot}`}
                  />
                  <div className='min-w-0'>
                    <p className='text-sm font-medium'>{ex.ask}</p>
                    <p className='text-muted-foreground text-sm'>
                      {ex.model}{' '}
                      <span className='text-foreground font-semibold'>
                        · {ex.note}
                      </span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className='border-border text-muted-foreground mt-6 border-t pt-5 text-sm leading-relaxed'>
              {t(
                'Same great result where it matters — you only pay premium prices for the requests that actually need it.'
              )}
            </p>
          </div>
        </AnimateInView>
      </div>
    </section>
  )
}
