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
import { BarChart3, KeyRound, Link2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AnimateInView } from '@/components/animate-in-view'

export function HowItWorks() {
  const { t } = useTranslation()

  const steps = [
    {
      num: '1',
      title: t('Get one key'),
      desc: t(
        'Create a flatkey account, open the dashboard, and generate an API key for your app.'
      ),
      icon: <KeyRound className='size-6' strokeWidth={1.5} />,
    },
    {
      num: '2',
      title: t('Change the base URL'),
      desc: t(
        'Point your OpenAI-compatible client to https://router.flatkey.ai/v1 and keep your existing SDK.'
      ),
      icon: <Link2 className='size-6' strokeWidth={1.5} />,
    },
    {
      num: '3',
      title: t('Monitor and optimize'),
      desc: t(
        'Review usage, cost, routing, and errors from the same product dashboard.'
      ),
      icon: <BarChart3 className='size-6' strokeWidth={1.5} />,
    },
  ]

  return (
    <section className='relative z-10 border-t border-violet-500/10 px-6 py-24 md:py-32 dark:border-violet-300/10'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-16 text-center md:mb-20'>
          <p className='text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase'>
            {t('How it fits together')}
          </p>
          <h2 className='text-2xl font-bold tracking-tight md:text-3xl'>
            {t('From homepage to production calls')}
          </h2>
        </AnimateInView>

        <div className='grid gap-8 md:grid-cols-3 md:gap-12'>
          {steps.map((step, i) => (
            <AnimateInView
              key={step.num}
              delay={i * 150}
              animation='fade-up'
              className='relative flex flex-col items-center text-center'
            >
              <div className='relative mb-6'>
                <div className='flex size-16 items-center justify-center rounded-2xl border border-violet-500/15 bg-white/70 text-violet-600 shadow-[0_18px_48px_-34px_rgba(91,33,182,0.7)] transition-colors dark:bg-white/[0.04] dark:text-violet-200'>
                  {step.icon}
                </div>
                <div className='absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white shadow-[0_0_18px_rgba(124,58,237,0.55)] dark:bg-violet-300 dark:text-violet-950'>
                  {step.num}
                </div>
              </div>
              <h3 className='mb-2 text-base font-semibold'>{step.title}</h3>
              <p className='text-muted-foreground max-w-[240px] text-sm leading-relaxed'>
                {step.desc}
              </p>
            </AnimateInView>
          ))}
        </div>
      </div>
    </section>
  )
}
