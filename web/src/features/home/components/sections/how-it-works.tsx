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
import { ArrowRightLeft, Share2, Building2, Puzzle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'

interface UseCasesProps {
  className?: string
}

export function HowItWorks(_props: UseCasesProps) {
  const { t } = useTranslation()

  const cases = [
    {
      icon: <ArrowRightLeft className='size-6' strokeWidth={1.5} />,
      title: t('Compute Relay'),
      desc: t(
        'Route inference through optimized provider chains with intelligent load balancing and automatic failover. Unlike simple relays, our engine applies per-model pricing rules and revenue tracking at every hop.'
      ),
      tag: t('中转'),
    },
    {
      icon: <Share2 className='size-6' strokeWidth={1.5} />,
      title: t('Secondary Distribution'),
      desc: t(
        'Resell compute capacity with custom markups and auto-revenue split. Each downstream tenant gets their own pricing, quotas, and billing — not just shared API keys.'
      ),
      tag: t('分销'),
    },
    {
      icon: <Building2 className='size-6' strokeWidth={1.5} />,
      title: t('Team Internal Use'),
      desc: t(
        'Unified model access for your organization with per-team quotas and departmental spend tracking. No more managing dozens of upstream accounts or juggling multiple API keys.'
      ),
      tag: t('团队'),
    },
    {
      icon: <Puzzle className='size-6' strokeWidth={1.5} />,
      title: t('SaaS Integration'),
      desc: t(
        'Embed AI capabilities with white-labeled API endpoints. Your customers see your brand, your pricing, your billing — the AI infrastructure runs entirely behind the scenes.'
      ),
      tag: t('SaaS'),
    },
  ]

  return (
    <section className='border-border/40 relative z-10 border-t px-6 py-24 md:py-32'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-16 text-center md:mb-20'>
          <p className='text-muted-foreground mb-3 text-sm font-medium tracking-widest uppercase'>
            {t('Use Cases')}
          </p>
          <h2 className='text-3xl font-bold tracking-tight md:text-4xl'>
            {t('Flexible deployment')}
            <br />
            <span className='bg-gradient-to-r from-amber-400 via-orange-400 to-rose-500 bg-clip-text text-transparent'>
              {t('for every scenario')}
            </span>
          </h2>
        </AnimateInView>

        <div className='grid gap-6 md:grid-cols-2 md:gap-8'>
          {cases.map((c, i) => (
            <AnimateInView
              key={c.title}
              delay={i * 100}
              animation='fade-up'
              className='group relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-b from-card/80 to-card/30 p-8 transition-all duration-300 hover:border-border hover:shadow-md dark:from-card/5 dark:to-card/0'
            >
              {/* Top accent */}
              <div
                aria-hidden
                className='absolute top-0 left-[10%] h-[2px] w-[80%] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100'
              />

              <div className='relative flex gap-5'>
                <div className='border-border/40 bg-muted/30 flex size-14 shrink-0 items-center justify-center rounded-xl border transition-colors duration-300 group-hover:border-amber-500/20 group-hover:bg-amber-500/10'>
                  <div className='text-foreground/70 group-hover:text-amber-500 transition-colors duration-300'>
                    {c.icon}
                  </div>
                </div>
                <div className='min-w-0 flex-1'>
                  <div className='mb-1 flex items-center gap-2'>
                    <h3 className='text-lg font-semibold'>{c.title}</h3>
                    <span className='rounded-md border border-amber-500/15 bg-amber-500/5 px-1.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400'>
                      {c.tag}
                    </span>
                  </div>
                  <p className='text-muted-foreground text-base leading-relaxed'>
                    {c.desc}
                  </p>
                </div>
              </div>
            </AnimateInView>
          ))}
        </div>
      </div>
    </section>
  )
}
