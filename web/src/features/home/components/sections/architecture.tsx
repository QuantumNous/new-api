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

interface ArchitectureProps {
  className?: string
}

export function Architecture(_props: ArchitectureProps) {
  const { t } = useTranslation()

  const layers = [
    {
      title: t('API Gateway Layer'),
      items: [
        t('OpenAI-Compatible Routes'),
        t('Authentication & Rate Limiting'),
        t('Request Distribution'),
      ],
      accent: 'from-cyan-500/10 to-blue-500/5',
      border: 'border-cyan-500/20',
      text: 'text-cyan-400',
    },
    {
      title: t('Scheduling & Routing'),
      items: [
        t('Intelligent Load Balancing'),
        t('Priority & Weighted Distribution'),
        t('Automatic Failover'),
      ],
      accent: 'from-violet-500/10 to-purple-500/5',
      border: 'border-violet-500/20',
      text: 'text-violet-400',
    },
    {
      title: t('Provider Adapters'),
      items: [
        t('40+ Provider Integrations'),
        t('Protocol Translation'),
        t('Stream & Non-Stream Support'),
      ],
      accent: 'from-amber-500/10 to-orange-500/5',
      border: 'border-amber-500/20',
      text: 'text-amber-400',
    },
    {
      title: t('Billing & Settlement'),
      items: [
        t('Expression-Based Custom Pricing'),
        t('Revenue Settlement & Profit Split'),
        t('Audit Logs & Financial Reports'),
      ],
      accent: 'from-emerald-500/10 to-teal-500/5',
      border: 'border-emerald-500/20',
      text: 'text-emerald-400',
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
            'radial-gradient(ellipse 45% 35% at 40% 50%, oklch(0.6 0.14 220 / 50%) 0%, transparent 70%)',
        }}
      />

      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-16 text-center'>
          <p className='text-muted-foreground mb-3 text-sm font-medium tracking-widest uppercase'>
            {t('Platform Architecture')}
          </p>
          <h2 className='text-3xl font-bold tracking-tight md:text-4xl'>
            {t('End-to-end request flow')}
          </h2>
          <p className='text-muted-foreground/70 mx-auto mt-3 max-w-lg text-base leading-relaxed'>
            {t(
              'Every request passes through intelligent routing layers — from authentication to provider selection to billing settlement.'
            )}
          </p>
        </AnimateInView>

        {/* Architecture flow */}
        <div className='relative'>
          {/* Connection arrows (desktop) — SVG line */}
          <svg
            aria-hidden
            className='pointer-events-none absolute top-1/2 left-0 hidden h-[2px] w-full md:block'
            viewBox='0 0 100 2'
            preserveAspectRatio='none'
          >
            <line
              x1='0'
              y1='1'
              x2='100'
              y2='1'
              className='text-border [stroke:currentColor]'
              strokeWidth='1'
              strokeDasharray='4 4'
            />
          </svg>

          <div className='grid gap-4 md:grid-cols-4 md:gap-0'>
            {layers.map((layer, i) => (
              <AnimateInView
                key={layer.title}
                delay={i * 80}
                animation='fade-up'
                className='relative'
              >
                {/* Arrow connector between cards (mobile) */}
                {i < layers.length - 1 && (
                  <div
                    aria-hidden
                    className='border-border/30 mx-auto h-4 w-px border-l border-dashed md:hidden'
                  />
                )}

                <div
                  className={`group relative mx-2 overflow-hidden rounded-xl border ${layer.border} bg-gradient-to-b ${layer.accent} p-5 transition-all duration-300 hover:shadow-md md:mx-0 md:rounded-none md:border-0 md:border-t-2 md:bg-none md:p-4 md:hover:shadow-none`}
                >
                  {/* Layer number */}
                  <div
                    aria-hidden
                    className='border-border/30 text-muted-foreground/30 absolute top-3 right-3 text-[10px] font-bold tabular-nums'
                  >
                    {String(i + 1).padStart(2, '0')}
                  </div>

                  <h3 className={`mb-3 text-base font-semibold ${layer.text}`}>
                    {layer.title}
                  </h3>
                  <ul className='space-y-1.5'>
                    {layer.items.map((item) => (
                      <li
                        key={item}
                        className='text-muted-foreground flex items-center gap-2 text-sm'
                      >
                        <div className={`size-1 shrink-0 rounded-full ${layer.text.replace('text-', 'bg-')}`} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </AnimateInView>
            ))}
          </div>
        </div>

        {/* Bottom callout */}
        <AnimateInView
          className='border-border/30 bg-muted/10 mx-auto mt-12 max-w-2xl rounded-xl border p-4 text-center'
          animation='fade-in'
        >
          <p className='text-muted-foreground text-sm leading-relaxed'>
            {t(
              'Supports OpenAI, Claude, Gemini, DeepSeek, Qwen, Llama, and 40+ more providers. Stream and non-stream, image and audio, reasoning and code — all through one unified gateway.'
            )}
          </p>
        </AnimateInView>
      </div>
    </section>
  )
}
