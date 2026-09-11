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

import { RotatingPolyhedron } from '../rotating-polyhedron'

type HeroProps = {
  className?: string
  isAuthenticated?: boolean
}

export function Hero(props: HeroProps) {
  const { t } = useTranslation()
  const isAuthenticated = props.isAuthenticated === true

  return (
    <section className='relative isolate overflow-hidden px-6 pt-20 pb-20 sm:px-10 sm:pt-24 sm:pb-24 lg:px-14 lg:pt-24 lg:pb-28'>
      {/* Ambient primary wash + hairline grid, both following the landing tone. */}
      <div
        aria-hidden='true'
        className='landing-glow pointer-events-none absolute top-[-16rem] left-1/2 -z-10 h-[38rem] w-[120%] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--primary)_9%,transparent),transparent)]'
      />
      <div
        aria-hidden='true'
        className='landing-grid pointer-events-none absolute inset-0 -z-10 [background-image:linear-gradient(var(--foreground)_1px,transparent_1px),linear-gradient(90deg,var(--foreground)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,black,transparent)] [background-size:56px_56px] opacity-[0.04]'
      />

      <div className='mx-auto max-w-7xl'>
        <h1 className='landing-animate-fade-up max-w-[16ch] font-serif text-[clamp(3rem,7.5vw,6.5rem)] leading-[0.98] font-medium tracking-[-0.03em] opacity-0'>
          {t('One router,')}
          <br />
          {t('more ways to build.')}
        </h1>

        <div className='mt-12 grid items-center gap-14 lg:mt-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12'>
          <div className='landing-animate-fade-up max-w-xl opacity-0 [animation-delay:140ms]'>
            <p className='text-muted-foreground font-serif text-lg leading-8 sm:text-xl sm:leading-9'>
              {t(
                'Access models from nearly every provider at a lower cost. Each model has more than one path: choose a group for the task, then select the model.'
              )}
            </p>

            <div className='mt-9 flex flex-wrap items-center gap-3'>
              {isAuthenticated ? (
                <Button
                  className='group h-12 rounded-full px-7 text-base font-medium'
                  render={<Link to='/dashboard' />}
                >
                  {t('Go to Dashboard')}
                  <ArrowRight className='ml-1.5 size-4 transition-transform group-hover:translate-x-0.5' />
                </Button>
              ) : (
                <Button
                  className='group h-12 rounded-full px-7 text-base font-medium'
                  render={<Link to='/sign-up' />}
                >
                  {t('Create account')}
                  <ArrowRight className='ml-1.5 size-4 transition-transform group-hover:translate-x-0.5' />
                </Button>
              )}
              <Button
                variant='outline'
                className='border-border/70 h-12 rounded-full px-7 text-base font-medium'
                render={<Link to='/pricing' />}
              >
                {t('View pricing')}
              </Button>
            </div>
          </div>

          <div className='landing-animate-fade-up landing-float relative mx-auto w-full max-w-[24rem] opacity-0 [animation-delay:200ms] sm:max-w-[28rem] lg:mx-0 lg:max-w-[30rem]'>
            <RotatingPolyhedron label={t('Rotating 3D gateway routing core')} />
          </div>
        </div>

        {/* Telemetry data stream — a scrolling mono strip that fills the hero
            footer space with mechanical movement. */}
        <div className='landing-animate-fade-in border-border/60 mt-16 overflow-hidden border-y opacity-0 [animation-delay:320ms]'>
          <div className='rt-ticker text-muted-foreground/70 flex w-max items-center gap-8 py-2.5 font-mono text-[10px] tracking-[0.18em] uppercase'>
            <TickerRow />
          </div>
        </div>
      </div>
    </section>
  )
}

const TELEMETRY = [
  'RTT 38MS',
  'CH 04',
  'MODEL gpt-4o',
  '200 OK',
  'TOKEN 1.2K',
  'UPSTREAM openai',
  'LAT 99.98%',
  'RPS 412',
  'QUOTA 84%',
  'NODE cn-east-1',
  'BALANCE OK',
  'ROUTE default',
]

function TickerRow() {
  // Repeat the sequence 3x so the seamless loop has enough width.
  return (
    <>
      {Array.from({ length: 3 }, (_, k) => (
        <span key={k} className='flex items-center gap-8' aria-hidden={k > 0}>
          {TELEMETRY.map((item) => (
            <span
              key={item}
              className='flex items-center gap-8 whitespace-nowrap'
            >
              {item}
              <span className='text-border'>/</span>
            </span>
          ))}
        </span>
      ))}
    </>
  )
}
