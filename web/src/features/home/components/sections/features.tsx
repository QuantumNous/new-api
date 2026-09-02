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
import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  Bot,
  Code2,
  FileText,
  Globe,
  Languages,
  PiggyBank,
  ShieldCheck,
  Smile,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useRevealOnScroll } from '@/hooks/use-reveal-on-scroll'

interface FeaturesProps {
  className?: string
}

export function Features(_props: FeaturesProps) {
  const { t } = useTranslation()
  const sectionRef = useRevealOnScroll<HTMLElement>()

  const useCases = [
    {
      number: '01',
      icon: FileText,
      title: t('Research and content'),
      desc: t('Copywriting, ad creative, SEO'),
      hue: 'var(--chart-3)',
    },
    {
      number: '02',
      icon: Languages,
      title: t('Translation'),
      desc: t('Multilingual translation and localisation'),
      hue: 'var(--chart-1)',
    },
    {
      number: '03',
      icon: Code2,
      title: t('AI coding'),
      desc: t('Code generation, refactoring, autocomplete'),
      hue: 'var(--chart-4)',
    },
    {
      number: '04',
      icon: Bot,
      title: t('Customer support and operations'),
      desc: t('Automation'),
      hue: 'var(--chart-2)',
    },
  ]

  const reasons = [
    {
      icon: <Smile className='size-6' strokeWidth={2} />,
      title: t('Made for beginners'),
      desc: t(
        'Plain-language guides for every tool. No jargon, no config files to hand-edit.'
      ),
      hue: 'var(--chart-1)',
    },
    {
      icon: <PiggyBank className='size-6' strokeWidth={2} />,
      title: t('One bill, pay as you go'),
      desc: t(
        'No monthly subscriptions per model. Top up once, use any model, see every cent.'
      ),
      hue: 'var(--chart-2)',
    },
    {
      icon: <Globe className='size-6' strokeWidth={2} />,
      title: t('Direct access, no VPN'),
      desc: t(
        'Reach top models from anywhere with a stable connection that just works.'
      ),
      hue: 'var(--chart-4)',
    },
    {
      icon: <ShieldCheck className='size-6' strokeWidth={2} />,
      title: t('Your key, your control'),
      desc: t(
        'Set spending limits and expiry dates per key. Revoke a key any time with one tap.'
      ),
      hue: 'var(--chart-3)',
    },
  ]

  return (
    <section ref={sectionRef} className='relative z-10 px-6 py-16 md:py-24'>
      <div className='dopa-section-shell' data-section='TOOLS'>
        {/* Use-case first: people choose a job, not an API client. */}
        <div className='dopa-reveal grid items-end gap-5 md:grid-cols-[0.9fr_1.1fr]'>
          <div>
            <p className='dopa-section-kicker'>{t('Use case')}</p>
            <h2 className='mt-4 text-3xl font-black tracking-[-0.055em] text-balance md:text-5xl'>
              {t('AI without the headaches')}
            </h2>
          </div>
          <p className='text-muted-foreground text-base leading-relaxed text-pretty'>
            {t(
              "No complicated setup and no expensive subscription barrier. Configure once, pay only as you go, and put the latest productivity within everyone's reach."
            )}
          </p>
        </div>

        <div className='dopa-bento-grid mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
          {useCases.map((item, i) => {
            const Icon = item.icon

            return (
              <article
                key={item.number}
                className='dopa-tool-tile dopa-reveal dopa-lift dopa-paper group relative min-h-60 overflow-hidden rounded-[1.75rem] p-5'
                style={{ transitionDelay: `${i * 70}ms` }}
              >
                <span
                  className='absolute top-5 right-5 font-mono text-xs font-black'
                  style={{ color: item.hue }}
                >
                  {item.number}
                </span>
                <div
                  className='flex size-12 items-center justify-center rounded-2xl'
                  style={{
                    backgroundColor: `color-mix(in oklch, ${item.hue} 15%, transparent)`,
                    color: item.hue,
                  }}
                >
                  <Icon className='size-5' aria-hidden='true' />
                </div>
                <h3 className='mt-10 text-lg font-black tracking-[-0.035em]'>
                  {item.title}
                </h3>
                <p className='text-muted-foreground mt-2 text-xs leading-relaxed'>
                  {item.desc}
                </p>
                <ArrowRight
                  className='text-muted-foreground absolute right-5 bottom-5 size-4 transition-transform duration-200 group-hover:translate-x-1'
                  aria-hidden='true'
                />
              </article>
            )
          })}
        </div>

        <div className='dopa-reveal dopa-data-rail mt-4 flex flex-wrap items-center gap-3 rounded-[1.5rem] px-5 py-4'>
          <div className='min-w-0 flex-1'>
            <p className='text-sm font-extrabold'>
              {t('Works with your tools')}
            </p>
            <p className='text-muted-foreground mt-0.5 text-xs'>
              {t(
                'Connect one key to the chat, coding, translation, and knowledge-base tools you already use.'
              )}
            </p>
          </div>
          <Button
            variant='ghost'
            className='dopa-spring text-primary h-auto shrink-0 rounded-full px-4 py-2.5 text-sm font-bold'
            render={<Link to='/guide' />}
          >
            {t('How do I connect it?')}
            <ArrowRight className='ml-1 size-3.5' />
          </Button>
        </div>

        {/* Why us */}
        <div className='mt-16 md:mt-20'>
          <div className='dopa-reveal mb-8 flex flex-wrap items-end justify-between gap-4'>
            <p className='dopa-section-kicker'>{t('Why people love it')}</p>
            <h2 className='max-w-xl text-2xl font-black tracking-[-0.04em] text-balance md:text-3xl'>
              {t('AI without the headaches')}
            </h2>
          </div>

          <div className='dopa-bento-grid grid gap-4 md:grid-cols-12'>
            {reasons.map((r, i) => (
              <div
                key={r.title}
                className={`dopa-tool-tile dopa-reveal dopa-lift dopa-paper flex min-h-48 flex-col rounded-[1.6rem] p-6 ${
                  i === 0 || i === 3 ? 'md:col-span-7' : 'md:col-span-5'
                }`}
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div
                  className='mb-5 flex size-14 items-center justify-center rounded-2xl'
                  style={{
                    backgroundColor: `color-mix(in oklch, ${r.hue} 14%, transparent)`,
                    color: r.hue,
                  }}
                >
                  {r.icon}
                </div>
                <h3 className='mb-2 text-base font-bold'>{r.title}</h3>
                <p className='text-muted-foreground text-sm leading-relaxed'>
                  {r.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
