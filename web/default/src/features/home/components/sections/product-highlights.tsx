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
import { Boxes, Gauge, ReceiptText, Route } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AnimateInView } from '@/components/animate-in-view'
import { cn } from '@/lib/utils'

export function ProductHighlights() {
  const { t } = useTranslation()

  const highlights = [
    {
      title: t('AI product teams'),
      desc: t(
        'Add model access to your product without managing separate provider accounts, keys, and SDK changes.'
      ),
      icon: <Boxes className='size-6' strokeWidth={1.6} />,
    },
    {
      title: t('Operations and finance'),
      desc: t(
        'Keep token spend, recharge records, and team usage visible in one dashboard.'
      ),
      icon: <ReceiptText className='size-6' strokeWidth={1.6} />,
    },
    {
      title: t('Automation builders'),
      desc: t(
        'Route high-volume workflows to suitable models while keeping failures and cost easier to review.'
      ),
      icon: <Route className='size-6' strokeWidth={1.6} />,
    },
    {
      title: t('Model evaluation and iteration'),
      desc: t(
        'Compare providers, switch models, and keep existing OpenAI-compatible clients pointed at the same base URL.'
      ),
      icon: <Gauge className='size-6' strokeWidth={1.6} />,
    },
  ]

  return (
    <section className='relative z-10 px-6 py-24 md:py-32'>
      <div className='mx-auto max-w-7xl'>
        <AnimateInView className='mb-10 max-w-3xl md:mb-12'>
          <p className='text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase'>
            {t('Product focus')}
          </p>
          <h2 className='text-2xl leading-tight font-bold tracking-tight md:text-3xl'>
            {t('Built for teams shipping AI features')}
          </h2>
          <p className='text-muted-foreground mt-4 max-w-2xl text-sm leading-7 md:text-base'>
            {t(
              'flatkey keeps model access, routing, billing, and usage policy in one place so teams can move faster without extra provider management.'
            )}
          </p>
        </AnimateInView>

        <div className='grid gap-5 md:grid-cols-2'>
          {highlights.map((item, index) => (
            <AnimateInView
              key={item.title}
              delay={index * 90}
              animation='fade-up'
              className={cn(
                'group min-h-[210px] rounded-2xl border border-violet-500/16 bg-white/62 p-7 shadow-[0_24px_70px_-52px_rgba(91,33,182,0.78)] backdrop-blur-sm transition-colors duration-300 md:p-8',
                'hover:border-violet-500/28 hover:bg-white/78',
                'dark:border-violet-300/14 dark:bg-white/[0.035] dark:hover:border-violet-200/22 dark:hover:bg-white/[0.055]'
              )}
            >
              <div className='mb-7 flex size-14 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/8 text-violet-700 shadow-[0_18px_44px_-30px_rgba(124,58,237,0.8)] transition-transform duration-300 group-hover:scale-[1.03] dark:border-violet-300/18 dark:bg-violet-300/8 dark:text-violet-200'>
                {item.icon}
              </div>
              <h3 className='text-xl font-semibold tracking-tight'>
                {item.title}
              </h3>
              <p className='text-muted-foreground mt-4 max-w-xl text-sm leading-7 md:text-[15px]'>
                {item.desc}
              </p>
            </AnimateInView>
          ))}
        </div>
      </div>
    </section>
  )
}
