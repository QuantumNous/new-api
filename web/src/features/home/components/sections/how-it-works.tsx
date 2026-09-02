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
  ClipboardCopy,
  KeyRound,
  MessageCircleHeart,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useRevealOnScroll } from '@/hooks/use-reveal-on-scroll'

export function HowItWorks() {
  const { t } = useTranslation()
  const sectionRef = useRevealOnScroll<HTMLElement>()

  const steps = [
    {
      num: '1',
      title: t('Create your key'),
      desc: t(
        'Sign up and tap "Create Key" — think of it as your personal AI pass.'
      ),
      icon: <KeyRound className='size-7' strokeWidth={2} />,
      hue: 'var(--chart-1)',
    },
    {
      num: '2',
      title: t('Paste it into your tool'),
      desc: t(
        'Paste one key into any of these — chat apps, coding assistants, translators and more.'
      ),
      icon: <ClipboardCopy className='size-7' strokeWidth={2} />,
      hue: 'var(--chart-2)',
    },
    {
      num: '3',
      title: t('Start chatting'),
      desc: t('Pick a model and go. Every model, one bill, no extra accounts.'),
      icon: <MessageCircleHeart className='size-7' strokeWidth={2} />,
      hue: 'var(--chart-3)',
    },
  ]

  return (
    <section ref={sectionRef} className='relative z-10 px-6 py-16 md:py-24'>
      <div
        className='dopa-section-shell grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16'
        data-section='SETUP'
      >
        <div className='dopa-reveal lg:sticky lg:top-24 lg:self-start'>
          <p className='dopa-section-kicker'>{t('How It Works')}</p>
          <h2 className='mt-4 text-3xl font-black tracking-[-0.055em] text-balance md:text-5xl'>
            {t('Up and running in 3 easy steps')}
          </h2>
          <p className='text-muted-foreground mt-4 max-w-md text-base leading-relaxed text-pretty'>
            {t('If you can copy and paste, you can do this.')}
          </p>
          <Button
            variant='outline'
            className='dopa-spring mt-7 h-11 rounded-full px-6 font-semibold'
            render={<Link to='/guide' />}
          >
            {t('See the full beginner guide')}
            <ArrowRight className='ml-1.5 size-4' />
          </Button>
        </div>

        <ol className='dopa-paper dopa-setup-trace overflow-hidden rounded-[1.75rem]'>
          {steps.map((step, i) => (
            <li
              key={step.num}
              className='dopa-setup-step dopa-reveal group grid grid-cols-[3.75rem_1fr_auto] items-center gap-4 border-b border-[var(--dopa-rule)] px-4 py-6 last:border-b-0 sm:grid-cols-[5rem_1fr_auto] sm:px-7 sm:py-8'
              data-step={step.num}
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <span
                className='font-mono text-4xl font-black tracking-[-0.1em] sm:text-5xl'
                style={{ color: step.hue }}
              >
                0{step.num}
              </span>
              <div className='min-w-0'>
                <h3 className='text-base font-extrabold sm:text-lg'>
                  {step.title}
                </h3>
                <p className='text-muted-foreground mt-1 text-sm leading-relaxed'>
                  {step.desc}
                </p>
              </div>
              <span
                className='hidden size-12 items-center justify-center rounded-2xl sm:flex'
                style={{
                  backgroundColor: `color-mix(in oklch, ${step.hue} 14%, transparent)`,
                  color: step.hue,
                }}
              >
                {step.icon}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
