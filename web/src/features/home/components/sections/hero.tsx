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
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { HeroTerminalDemo } from '../hero-terminal-demo'

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
}

export function Hero(props: HeroProps) {
  const { t } = useTranslation()

  return (
    <section className='relative z-10 flex flex-col items-center px-6 pt-28 pb-16 md:pt-36 md:pb-24'>
      {/* Central radial glow — lifts the card area without darkening the rest */}
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 -z-10'
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 38%, oklch(0.97 0.02 250 / 22%) 0%, transparent 70%)',
        }}
      />

      {/* Subtle grid pattern */}
      <div
        aria-hidden
        className='absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_30%,black_20%,transparent_100%)] bg-[size:4rem_4rem] opacity-[0.05]'
      />

      {/* Glass focus card */}
      <div
        className={[
          'landing-animate-fade-up relative w-full max-w-2xl',
          'rounded-3xl border border-white/25 dark:border-white/10',
          'bg-background/45 dark:bg-background/30',
          'shadow-[0_8px_40px_rgb(0_0_0/0.18)]',
          'px-8 py-10 md:px-12 md:py-14',
          'flex flex-col items-center text-center',
          'backdrop-blur-xl',
        ].join(' ')}
        style={{ animationDelay: '0ms' }}
      >
        <img
          src='/mainsite.png'
          alt='Milky API Hub'
          width={240}
          height={80}
          className='landing-animate-fade-up h-16 w-auto opacity-0 md:h-20'
          style={{ animationDelay: '40ms' }}
        />

        <h1
          className='landing-animate-fade-up mt-5 text-[clamp(1.75rem,4.5vw,2.75rem)] leading-[1.15] font-bold tracking-tight opacity-0'
          style={{ animationDelay: '120ms' }}
        >
          <span className='bg-gradient-to-r from-blue-400 via-violet-400 to-purple-500 bg-clip-text text-transparent'>
            {t('Milky API Hub')}
          </span>
        </h1>

        <p
          className='landing-animate-fade-up text-foreground/85 mt-4 max-w-md text-base leading-relaxed opacity-0 md:text-lg'
          style={{ animationDelay: '200ms' }}
        >
          {t(
            'Power AI applications, manage digital assets, connect the Future'
          )}
        </p>

        <div
          className='landing-animate-fade-up mt-7 flex items-center gap-3 opacity-0'
          style={{ animationDelay: '280ms' }}
        >
          {props.isAuthenticated ? (
            <Button
              className='group rounded-lg'
              render={<Link to='/dashboard' />}
            >
              {t('Go to Dashboard')}
              <ArrowRight className='ml-1 size-3.5 transition-transform duration-200 group-hover:translate-x-0.5' />
            </Button>
          ) : (
            <>
              <Button
                className='group rounded-lg'
                render={<Link to='/sign-up' />}
              >
                {t('Get Started')}
                <ArrowRight className='ml-1 size-3.5 transition-transform duration-200 group-hover:translate-x-0.5' />
              </Button>
              <Button
                variant='outline'
                className='border-border/50 hover:border-border bg-background/60 hover:bg-background/80 rounded-lg backdrop-blur-md'
                render={<Link to='/pricing' />}
              >
                {t('View Pricing')}
              </Button>
            </>
          )}
        </div>
      </div>

      <div
        className='landing-animate-fade-up relative mt-12 w-full opacity-0'
        style={{ animationDelay: '380ms' }}
      >
        <HeroTerminalDemo />
      </div>
    </section>
  )
}
