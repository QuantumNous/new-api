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
import {
  LayoutGrid,
  Variable,
  Warehouse,
  Coins,
  Handshake,
  Paintbrush,
  Puzzle,
  ScrollText,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'

interface CoreCapabilitiesProps {
  className?: string
}

interface Capability {
  key: string
  icon: React.ReactNode
  title: string
  desc: string
}

export function Features(_props: CoreCapabilitiesProps) {
  const { t } = useTranslation()

  const capabilities: Capability[] = [
    {
      key: 'unified',
      icon: <LayoutGrid className='size-4 text-cyan-400' />,
      title: t('Multi-Provider Compute Aggregation'),
      desc: t(
        'Aggregate 100+ models across 40+ providers behind a single access point. One integration for all major AI providers.'
      ),
    },
    {
      key: 'pricing',
      icon: <Variable className='size-4 text-orange-400' />,
      title: t('Expression-Based Pricing Engine'),
      desc: t(
        'Per-model, per-channel billing formulas with fallback chains. Define custom pricing tiers, sync upstream rates, and automate margin calculations.'
      ),
    },
    {
      key: 'wholesale',
      icon: <Warehouse className='size-4 text-violet-400' />,
      title: t('Multi-Level Wholesale Distribution'),
      desc: t(
        'Build reseller hierarchies with auto-revenue split. Distribute compute capacity to downstream partners with granular pricing and settlement controls.'
      ),
    },
    {
      key: 'tokens',
      icon: <Coins className='size-4 text-amber-400' />,
      title: t('Token & Quota Management'),
      desc: t(
        'Allocate, recharge, and transfer token quotas across users, groups, and channels. Real-time consumption tracking with group-level budgets.'
      ),
    },
    {
      key: 'settlement',
      icon: <Handshake className='size-4 text-emerald-400' />,
      title: t('Smart Settlement & Profit Split'),
      desc: t(
        'Full revenue settlement between upstream providers and downstream resellers. Track costs, margins, and profits per user, group, or channel.'
      ),
    },
    {
      key: 'branding',
      icon: <Paintbrush className='size-4 text-pink-400' />,
      title: t('White-Label Brand Customization'),
      desc: t(
        'Full brand customization with custom logos, colors, domain, and footer. No mandatory attribution — deploy as your own AI platform.'
      ),
    },
    {
      key: 'saas',
      icon: <Puzzle className='size-4 text-indigo-400' />,
      title: t('SaaS Embedding Ready'),
      desc: t(
        'Embed AI capabilities into your SaaS product. Offer model access as a value-add feature with white-labeled API endpoints and billing.'
      ),
    },
    {
      key: 'audit',
      icon: <ScrollText className='size-4 text-rose-400' />,
      title: t('Audit & Compliance Logs'),
      desc: t(
        'Detailed audit trail for every API request. Full request/response logging with user, model, cost, and latency tracking for compliance.'
      ),
    },
  ]

  return (
    <section className='relative z-10 overflow-hidden px-6 py-24 md:py-32'>
      {/* Section background accent */}
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 -z-10 opacity-15 dark:opacity-[0.06]'
        style={{
          background: [
            'radial-gradient(ellipse 40% 30% at 20% 50%, oklch(0.65 0.15 250 / 60%) 0%, transparent 70%)',
            'radial-gradient(ellipse 30% 25% at 80% 60%, oklch(0.6 0.12 200 / 50%) 0%, transparent 70%)',
          ].join(', '),
        }}
      />

      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-16 max-w-lg'>
          <p className='text-muted-foreground mb-3 text-sm font-medium tracking-widest uppercase'>
            {t('Key Differentiators')}
          </p>
          <h2 className='text-3xl leading-tight font-bold tracking-tight md:text-4xl'>
            {t('Beyond the standard API gateway')}
            <br />
            <span className='bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-500 bg-clip-text text-transparent'>
              {t('your comprehensive compute platform')}
            </span>
          </h2>
          <p className='text-muted-foreground/70 mt-3 max-w-md text-base leading-relaxed'>
            {t(
              'Built for AI commerce at scale — from unified access and custom pricing to wholesale distribution and full financial settlement.'
            )}
          </p>
        </AnimateInView>

        {/* 8-card bento grid */}
        <div className='grid gap-4 md:grid-cols-4'>
          {capabilities.map((cap, i) => (
            <AnimateInView
              key={cap.key}
              delay={i * 60}
              animation='fade-up'
              className='group relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-b from-card/80 to-card/30 p-6 transition-all duration-300 hover:border-border hover:shadow-md dark:from-card/5 dark:to-card/0'
            >
              {/* Top accent line */}
              <div
                aria-hidden
                className='absolute top-0 left-[10%] h-[2px] w-[80%] bg-gradient-to-r from-transparent via-foreground/5 to-transparent transition-all duration-300 group-hover:via-foreground/20'
              />

              {/* Hover glow */}
              <div
                aria-hidden
                className='absolute -inset-1 rounded-xl bg-gradient-to-br from-transparent via-foreground/[0.02] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100'
              />

              <div className='relative'>
                <div className='border-border/40 bg-muted/30 mb-3 flex size-8 items-center justify-center rounded-lg border'>
                  {cap.icon}
                </div>
                <h3 className='mb-1.5 text-base font-semibold'>{cap.title}</h3>
                <p className='text-muted-foreground text-sm leading-relaxed'>
                  {cap.desc}
                </p>
              </div>
            </AnimateInView>
          ))}
        </div>
      </div>
    </section>
  )
}
