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

import { AnimateInView } from '@/components/animate-in-view'

import { useLandingModels } from '../../hooks/use-landing-models'
import type { RouteKind } from '../../lib/default-landing-models'
import { RouteChart } from '../route-chart'

const KIND_META: Record<
  RouteKind,
  { label: string; title: string; dot: string }
> = {
  priority: {
    label: '01',
    title: 'Priority',
    dot: 'bg-emerald-500',
  },
  free: {
    label: '02',
    title: 'Free models',
    dot: 'bg-sky-500',
  },
  value: {
    label: '03',
    title: 'Value & aggregated',
    dot: 'bg-amber-500',
  },
}

export function ServiceRoutes() {
  const { t } = useTranslation()
  const config = useLandingModels()

  return (
    <section className='relative z-10 px-6 py-24 sm:px-10 md:py-32 lg:px-14'>
      <div className='mx-auto max-w-7xl'>
        <AnimateInView className='mb-16 max-w-2xl md:mb-20'>
          <p className='text-primary mb-5 font-mono text-[11px] tracking-[0.28em] uppercase'>
            01 / {t('Service routes')}
          </p>
          <h2 className='text-foreground font-serif text-4xl leading-[1.05] font-medium tracking-[-0.02em] md:text-5xl'>
            {t('The same model,')}
            <br />
            {t('more than one service expectation.')}
          </h2>
          <p className='text-muted-foreground mt-6 max-w-xl text-base leading-7'>
            {t(
              'Price, speed, and stability come from different supply and maintenance paths. Start with a group, then choose a model.'
            )}
          </p>
        </AnimateInView>

        <div className='grid gap-4 md:grid-cols-3'>
          {config.serviceRoutes.map((group, i) => {
            const meta = KIND_META[group.kind] ?? KIND_META.value
            return (
              <AnimateInView
                key={group.id}
                delay={i * 80}
                animation='fade-up'
                className='landing-card-motion border-border/60 bg-card/40 rounded-2xl border p-7 md:p-8'
              >
                <div className='text-muted-foreground mb-6 flex items-center gap-3'>
                  <span className='font-mono text-xs tracking-[0.2em]'>
                    {meta.label}
                  </span>
                  <span className='text-primary font-mono text-[10px] tracking-[0.2em] uppercase'>
                    {t(meta.title)}
                  </span>
                </div>
                <p className='text-muted-foreground mb-6 text-sm leading-6'>
                  {t(group.description)}
                </p>
                <div className='border-border/60 flex items-center gap-2 border-t pt-5 font-mono text-xs'>
                  <span className='text-muted-foreground'>group</span>
                  <span className='text-foreground'>{group.group}</span>
                </div>
                <ul className='mt-4 space-y-2'>
                  {group.models.map((model) => (
                    <li
                      key={model}
                      className='border-border/40 flex items-center gap-2.5 border-b pb-2 text-sm'
                    >
                      <span
                        className={`size-1.5 shrink-0 rounded-full ${meta.dot}`}
                      />
                      <span className='text-foreground/90'>{model}</span>
                    </li>
                  ))}
                </ul>
              </AnimateInView>
            )
          })}
        </div>

        <div className='mt-12 grid items-center gap-10 lg:grid-cols-[1fr_20rem] lg:gap-14'>
          <RouteChart />
          <AnimateInView animation='fade-up' className='max-w-sm'>
            <p className='text-muted-foreground text-sm leading-6'>
              {t(
                'Automatic failover is available only for Claude Code and Codex. Keep a backup group strategy for production workloads.'
              )}
            </p>
            <p className='text-muted-foreground/70 mt-4 text-sm leading-6'>
              {t(
                'GPT and Claude APIs on this site are not official interfaces.'
              )}
            </p>
          </AnimateInView>
        </div>
      </div>
    </section>
  )
}
