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
  LayoutDashboard,
  Cable,
  UserCog,
  KeyRound,
  MonitorDot,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'

interface AdminShowcaseProps {
  className?: string
}

export function AdminShowcase(_props: AdminShowcaseProps) {
  const { t } = useTranslation()

  const features = [
    {
      icon: <Cable className='size-5' strokeWidth={1.5} />,
      title: t('Channel Management'),
      desc: t(
        'Configure upstream providers, API keys, model mappings, and channel priorities from a single dashboard.'
      ),
      accent: 'from-cyan-500/20 to-cyan-500/5',
      iconBg: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-500',
    },
    {
      icon: <UserCog className='size-5' strokeWidth={1.5} />,
      title: t('User Management'),
      desc: t(
        'Create and manage users, groups, and roles. Set quota limits, access permissions, and rate tiers per user.'
      ),
      accent: 'from-violet-500/20 to-violet-500/5',
      iconBg: 'border-violet-500/20 bg-violet-500/10 text-violet-500',
    },
    {
      icon: <KeyRound className='size-5' strokeWidth={1.5} />,
      title: t('Token Management'),
      desc: t(
        'Issue, revoke, and monitor API tokens. Track usage patterns and set expiration policies for each token.'
      ),
      accent: 'from-amber-500/20 to-amber-500/5',
      iconBg: 'border-amber-500/20 bg-amber-500/10 text-amber-500',
    },
    {
      icon: <MonitorDot className='size-5' strokeWidth={1.5} />,
      title: t('Log Monitoring'),
      desc: t(
        'Real-time request logs with detailed error diagnostics. Filter by user, model, provider, or status code.'
      ),
      accent: 'from-emerald-500/20 to-emerald-500/5',
      iconBg: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500',
    },
  ]

  return (
    <section className='relative z-10 overflow-hidden px-6 py-24 md:py-32'>
      {/* Background accent */}
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 -z-10 opacity-15 dark:opacity-[0.06]'
        style={{
          background:
            'radial-gradient(ellipse 50% 40% at 60% 50%, oklch(0.6 0.14 280 / 50%) 0%, transparent 70%)',
        }}
      />

      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-16 max-w-lg'>
          <p className='text-muted-foreground mb-3 text-sm font-medium tracking-widest uppercase'>
            {t('Admin Backend')}
          </p>
          <h2 className='text-3xl leading-tight font-bold tracking-tight md:text-4xl'>
            {t('Independent Admin Console')}
          </h2>
          <p className='text-muted-foreground/70 mt-3 max-w-md text-base leading-relaxed'>
            {t(
              'Full-featured admin backend with everything you need to manage your AI compute infrastructure.'
            )}
          </p>
        </AnimateInView>

        {/* Dashboard mockup area */}
        <div className='relative mb-16'>
          {/* Browser chrome mockup */}
          <div className='border-border/40 bg-muted/30 mx-auto max-w-4xl overflow-hidden rounded-xl border shadow-xl backdrop-blur-sm'>
            {/* Chrome bar */}
            <div className='border-border/30 flex items-center gap-2 border-b px-4 py-2.5'>
              <div className='flex items-center gap-1.5'>
                <div className='size-3 rounded-full bg-red-400/80' />
                <div className='size-3 rounded-full bg-amber-400/80' />
                <div className='size-3 rounded-full bg-emerald-400/80' />
              </div>
              <div className='border-border/20 bg-muted/50 mx-auto flex max-w-[280px] items-center gap-2 rounded-md border px-3 py-1 text-sm text-muted-foreground/60'>
                <LayoutDashboard className='size-3' />
                <span className='truncate'>admin / dashboard</span>
              </div>
            </div>

            {/* Dashboard preview grid */}
            <div className='grid grid-cols-2 gap-px bg-border/20 md:grid-cols-4'>
              {features.map((f) => (
                <div
                  key={f.title}
                  className='group relative overflow-hidden bg-background/60 p-6 transition-colors duration-300 hover:bg-background/90'
                >
                  {/* Background gradient */}
                  <div
                    aria-hidden
                    className={`absolute inset-0 bg-gradient-to-br ${f.accent} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
                  />
                  <div className='relative'>
                    <div
                      className={`mb-3 flex size-10 items-center justify-center rounded-lg border ${f.iconBg}`}
                    >
                      {f.icon}
                    </div>
                    <h3 className='mb-1 text-base font-semibold'>{f.title}</h3>
                    <p className='text-muted-foreground text-sm leading-relaxed'>
                      {f.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Glow behind mockup */}
          <div
            aria-hidden
            className='pointer-events-none absolute -inset-10 -z-10 rounded-full bg-gradient-to-br from-cyan-500/10 via-violet-500/10 to-amber-500/10 blur-3xl'
          />
        </div>

        {/* Callout text */}
        <AnimateInView className='mx-auto max-w-2xl text-center' animation='fade-in'>
          <div className='border-border/30 bg-muted/10 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm text-muted-foreground'>
            <LayoutDashboard className='size-3' />
            <span>
              {t(
                'One unified dashboard — channel management, user administration, token control, and real-time log monitoring'
              )}
            </span>
          </div>
        </AnimateInView>
      </div>
    </section>
  )
}
