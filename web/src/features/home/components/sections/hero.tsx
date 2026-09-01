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
import { ArrowRight, BookOpen, Check, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
}

/** Floating candy-colored model chips around the demo card. */
const modelChips = [
  { name: 'GPT-5', className: 'dopa-float -top-4 -left-6', hue: 'var(--chart-4)' },
  { name: 'Claude', className: 'dopa-float-alt top-16 -right-8', hue: 'var(--chart-2)' },
  { name: 'Gemini', className: 'dopa-float bottom-24 -left-10', hue: 'var(--chart-3)' },
  { name: 'DeepSeek', className: 'dopa-float-alt -bottom-4 right-6', hue: 'var(--chart-1)' },
]

/** A friendly fake chat that shows beginners what they actually get. */
function HeroChatDemo() {
  const { t } = useTranslation()

  return (
    <div className='relative w-full max-w-md'>
      {/* Glow blobs behind the card */}
      <div
        aria-hidden
        className='dopa-glow-pulse absolute -inset-8 -z-10 rounded-[3rem] opacity-60 blur-3xl'
        style={{
          background:
            'radial-gradient(ellipse 60% 55% at 30% 30%, color-mix(in oklch, var(--chart-1) 32%, transparent), transparent 70%), radial-gradient(ellipse 55% 50% at 75% 65%, color-mix(in oklch, var(--chart-3) 26%, transparent), transparent 70%)',
        }}
      />

      {/* Floating model chips */}
      {modelChips.map((chip) => (
        <span
          key={chip.name}
          className={`${chip.className} dopa-candy-shadow absolute z-10 hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold sm:inline-flex`}
          style={{
            backgroundColor: 'var(--card)',
            borderColor: 'color-mix(in oklch, ' + chip.hue + ' 35%, transparent)',
            color: chip.hue,
          }}
        >
          <Sparkles className='size-3' />
          {chip.name}
        </span>
      ))}

      {/* Chat card */}
      <div className='dopa-candy-shadow border-border bg-card overflow-hidden rounded-3xl border'>
        <div className='border-border flex items-center gap-2 border-b px-5 py-3.5'>
          <span className='bg-chart-3 size-2.5 rounded-full' />
          <span className='bg-chart-2 size-2.5 rounded-full' />
          <span className='bg-chart-1 size-2.5 rounded-full' />
          <span className='text-muted-foreground ml-2 text-xs font-medium'>
            {t('Your favorite AI tool')}
          </span>
        </div>
        <div className='flex flex-col gap-4 px-5 py-6'>
          {/* User bubble */}
          <div className='dopa-fade-up dopa-delay-2 flex justify-end'>
            <div className='bg-primary text-primary-foreground max-w-[80%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed'>
              {t('Help me polish this weekly report')}
            </div>
          </div>
          {/* AI bubble */}
          <div className='dopa-fade-up dopa-delay-4 flex justify-start'>
            <div className='bg-muted text-foreground max-w-[85%] rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed'>
              {t(
                'Sure! I tightened the wording and highlighted your three key results. Take a look:'
              )}
            </div>
          </div>
          {/* Status row */}
          <div className='dopa-fade-up dopa-delay-6 flex items-center gap-2'>
            <span className='bg-success/15 text-success inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold'>
              <Check className='size-3' />
              {t('Connected via one key')}
            </span>
            <span className='bg-info/15 text-info inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold'>
              {t('Switch models anytime')}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Hero(props: HeroProps) {
  const { t } = useTranslation()

  return (
    <section className='relative z-10 overflow-hidden px-6 pt-24 pb-16 md:pt-32 md:pb-24'>
      {/* Soft candy background blobs */}
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 -z-10'
        style={{
          background: [
            'radial-gradient(ellipse 55% 45% at 12% 18%, color-mix(in oklch, var(--chart-1) 14%, transparent) 0%, transparent 70%)',
            'radial-gradient(ellipse 45% 40% at 88% 12%, color-mix(in oklch, var(--chart-3) 12%, transparent) 0%, transparent 70%)',
            'radial-gradient(ellipse 40% 38% at 70% 85%, color-mix(in oklch, var(--chart-2) 10%, transparent) 0%, transparent 70%)',
          ].join(', '),
        }}
      />

      <div className='mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 lg:grid-cols-12 lg:gap-10'>
        {/* Left column */}
        <div className='flex flex-col items-start text-left lg:col-span-6'>
          <div className='dopa-fade-up bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold'>
            <Sparkles className='size-3.5' />
            {t('Beginner friendly · Ready in 3 minutes')}
          </div>

          <h1 className='dopa-fade-up dopa-delay-1 mt-6 text-[clamp(2.4rem,5vw,3.6rem)] leading-[1.12] font-extrabold tracking-tight text-balance'>
            {t('One key to unlock')}
            <br />
            <span className='dopa-gradient-text'>{t('all the best AI models')}</span>
          </h1>

          <p className='dopa-fade-up dopa-delay-2 text-muted-foreground mt-6 max-w-xl text-base leading-relaxed text-pretty md:text-lg'>
            {t(
              'No coding needed. Sign up, copy your key, paste it into the AI tool you already use — and chat with GPT, Claude, Gemini and more through one simple address.'
            )}
          </p>

          <div className='dopa-fade-up dopa-delay-3 mt-9 flex flex-wrap items-center gap-3'>
            {props.isAuthenticated ? (
              <Button
                className='dopa-spring dopa-shine group h-12 rounded-full px-7 text-base font-bold'
                render={<Link to='/dashboard' />}
              >
                {t('Go to Dashboard')}
                <ArrowRight className='ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
              </Button>
            ) : (
              <Button
                className='dopa-spring dopa-shine group h-12 rounded-full px-7 text-base font-bold'
                render={<Link to='/sign-up' />}
              >
                {t('Start for free')}
                <ArrowRight className='ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
              </Button>
            )}
            <Button
              variant='outline'
              className='dopa-spring h-12 rounded-full px-6 text-base font-semibold'
              render={<Link to='/guide' />}
            >
              <BookOpen className='mr-1.5 size-4' />
              {t('How do I connect it?')}
            </Button>
          </div>

          {/* Reassurance row */}
          <div className='dopa-fade-up dopa-delay-4 text-muted-foreground mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm'>
            <span className='inline-flex items-center gap-1.5'>
              <Check className='text-success size-4' />
              {t('No credit card required')}
            </span>
            <span className='inline-flex items-center gap-1.5'>
              <Check className='text-success size-4' />
              {t('Works with 30+ popular tools')}
            </span>
            <span className='inline-flex items-center gap-1.5'>
              <Check className='text-success size-4' />
              {t('Pay only for what you use')}
            </span>
          </div>
        </div>

        {/* Right column */}
        <div className='dopa-fade-up dopa-delay-3 flex w-full justify-center lg:col-span-6'>
          <HeroChatDemo />
        </div>
      </div>
    </section>
  )
}
