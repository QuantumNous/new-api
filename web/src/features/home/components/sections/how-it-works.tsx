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
import { ArrowRight, ClipboardCopy, KeyRound, MessageCircleHeart } from 'lucide-react'
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
        'Open Cherry Studio or any tool you like, paste the address and key. Done.'
      ),
      icon: <ClipboardCopy className='size-7' strokeWidth={2} />,
      hue: 'var(--chart-2)',
    },
    {
      num: '3',
      title: t('Start chatting'),
      desc: t(
        'Pick a model and go. Every model, one bill, no extra accounts.'
      ),
      icon: <MessageCircleHeart className='size-7' strokeWidth={2} />,
      hue: 'var(--chart-3)',
    },
  ]

  return (
    <section
      ref={sectionRef}
      className='relative z-10 px-6 py-24 md:py-32'
    >
      <div className='mx-auto max-w-6xl'>
        <div className='dopa-reveal mb-16 text-center'>
          <p className='text-primary mb-3 text-sm font-bold tracking-widest uppercase'>
            {t('How It Works')}
          </p>
          <h2 className='text-3xl font-extrabold tracking-tight text-balance md:text-4xl'>
            {t('Up and running in 3 easy steps')}
          </h2>
          <p className='text-muted-foreground mx-auto mt-4 max-w-md text-base text-pretty'>
            {t('If you can copy and paste, you can do this.')}
          </p>
        </div>

        <div className='relative grid gap-6 md:grid-cols-3 md:gap-8'>
          {/* Dotted connector (desktop) */}
          <div
            aria-hidden
            className='border-border absolute top-14 right-[16%] left-[16%] hidden border-t-2 border-dashed md:block'
          />

          {steps.map((step, i) => (
            <div
              key={step.num}
              className='dopa-reveal dopa-lift border-border bg-card relative flex flex-col items-center rounded-3xl border px-6 py-10 text-center'
              style={{ transitionDelay: `${i * 120}ms` }}
            >
              <div className='relative mb-6'>
                <div
                  className='flex size-20 items-center justify-center rounded-2xl'
                  style={{
                    backgroundColor: `color-mix(in oklch, ${step.hue} 14%, transparent)`,
                    color: step.hue,
                  }}
                >
                  {step.icon}
                </div>
                <div
                  className='absolute -top-2.5 -right-2.5 flex size-8 items-center justify-center rounded-full text-sm font-extrabold text-white'
                  style={{ backgroundColor: step.hue }}
                >
                  {step.num}
                </div>
              </div>
              <h3 className='mb-2.5 text-lg font-bold'>{step.title}</h3>
              <p className='text-muted-foreground max-w-[260px] text-sm leading-relaxed'>
                {step.desc}
              </p>
            </div>
          ))}
        </div>

        <div className='dopa-reveal mt-12 text-center' style={{ transitionDelay: '360ms' }}>
          <Button
            variant='outline'
            className='dopa-spring h-11 rounded-full px-6 font-semibold'
            render={<Link to='/guide' />}
          >
            {t('See the full beginner guide')}
            <ArrowRight className='ml-1.5 size-4' />
          </Button>
        </div>
      </div>
    </section>
  )
}
