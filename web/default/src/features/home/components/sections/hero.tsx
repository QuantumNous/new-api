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
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_SYSTEM_NAME } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { HeroTerminalDemo } from '../hero-terminal-demo'

const HOME_CAPABILITY_KEYS = [
  'Unified model service access',
  'Unified token resource operations',
  'Tenant and application management',
  'Call audit and operations monitoring',
] as const

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
}

export function Hero(props: HeroProps) {
  const { t } = useTranslation()

  return (
    <section className='relative z-10 flex flex-col items-center overflow-hidden px-6 pt-28 pb-16 md:pt-36 md:pb-24'>
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 -z-10'
      >
        <div
          className='absolute inset-0 opacity-90'
          style={{
            background: [
              'radial-gradient(ellipse 70% 55% at 15% 10%, oklch(0.45 0.2 265 / 55%) 0%, transparent 65%)',
              'radial-gradient(ellipse 55% 45% at 85% 15%, oklch(0.42 0.18 290 / 45%) 0%, transparent 65%)',
              'radial-gradient(ellipse 50% 40% at 50% 90%, oklch(0.38 0.14 250 / 35%) 0%, transparent 70%)',
            ].join(', '),
          }}
        />
        <div
          className='absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_65%_55%_at_50%_25%,black_15%,transparent_100%)] bg-[size:4rem_4rem]'
        />
      </div>

      <div className='flex max-w-3xl flex-col items-center text-center'>
        <h1
          className='landing-animate-fade-up text-[clamp(1.75rem,4.5vw,3rem)] leading-[1.2] font-bold tracking-tight text-slate-50'
          style={{ animationDelay: '0ms' }}
        >
          <span className='bg-gradient-to-r from-blue-300 via-violet-300 to-purple-400 bg-clip-text text-transparent'>
            {DEFAULT_SYSTEM_NAME}
          </span>
        </h1>
        <p
          className='landing-animate-fade-up mt-4 max-w-2xl text-base leading-relaxed text-slate-300 opacity-0 md:text-lg'
          style={{ animationDelay: '60ms' }}
        >
          {t('Home portal subtitle')}
        </p>
        <ul
          className='landing-animate-fade-up mt-6 flex w-full max-w-xl flex-col gap-2.5 text-left opacity-0 sm:gap-3'
          style={{ animationDelay: '120ms' }}
        >
          {HOME_CAPABILITY_KEYS.map((key) => (
            <li
              key={key}
              className='flex items-start gap-2.5 rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-slate-200 backdrop-blur-sm'
            >
              <CheckCircle2 className='mt-0.5 size-4 shrink-0 text-violet-400' />
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>
        <div
          className='landing-animate-fade-up mt-8 flex flex-wrap items-center justify-center gap-3 opacity-0'
          style={{ animationDelay: '200ms' }}
        >
          {props.isAuthenticated ? (
            <Button
              className='group rounded-lg border-0 bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-lg shadow-violet-900/30 hover:from-blue-500 hover:to-violet-500'
              render={<Link to='/dashboard' />}
            >
              {t('Home Enter Operations Console')}
              <ArrowRight className='ml-1 size-3.5 transition-transform duration-200 group-hover:translate-x-0.5' />
            </Button>
          ) : (
            <>
              <Button
                className='group rounded-lg border-0 bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-lg shadow-violet-900/30 hover:from-blue-500 hover:to-violet-500'
                render={<Link to='/sign-up' />}
              >
                {t('Home Enter Operations Console')}
                <ArrowRight className='ml-1 size-3.5 transition-transform duration-200 group-hover:translate-x-0.5' />
              </Button>
              <Button
                variant='outline'
                className='rounded-lg border-white/20 bg-white/5 text-slate-100 hover:border-violet-400/50 hover:bg-violet-500/10 hover:text-white'
                render={<Link to='/pricing' />}
              >
                {t('Home View Integration Capabilities')}
              </Button>
            </>
          )}
        </div>
      </div>

      <div
        className='landing-animate-fade-up w-full opacity-0'
        style={{ animationDelay: '300ms' }}
      >
        <HeroTerminalDemo />
      </div>
    </section>
  )
}
