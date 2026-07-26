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
import { ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import ribbonAnimation from '@/assets/home/alltokenapi-smooth-ribbon-loop-v3.webp'
import { Button } from '@/components/ui/button'

import { ProviderMarquee } from './provider-marquee'

interface LandingHeroProps {
  isAuthenticated: boolean
  catalogAvailable: boolean
}

function HeroRibbonBackdrop() {
  return (
    <div
      aria-hidden='true'
      className='pointer-events-none absolute inset-x-0 top-[8%] z-0 h-[64%] overflow-hidden'
    >
      <div className='absolute inset-0 overflow-hidden'>
        <img
          src={ribbonAnimation}
          alt=''
          width={1200}
          height={646}
          decoding='async'
          className='landing-hero-ribbon-source absolute top-[-12%] left-1/2 max-w-none -translate-x-1/2'
        />
      </div>
      <div className='from-background/80 to-background/80 absolute inset-0 bg-gradient-to-r via-transparent' />
      <div className='landing-hero-ribbon-glow absolute inset-x-[4%] top-[17%] h-[62%]' />
      <span className='landing-hero-ribbon-wave landing-hero-ribbon-wave-mint absolute' />
      <span className='landing-hero-ribbon-wave landing-hero-ribbon-wave-lavender absolute' />
      <span className='landing-hero-ribbon-wave landing-hero-ribbon-wave-pink absolute' />
      <div className='landing-hero-ribbon-veil absolute inset-x-[12%] top-[24%] h-[50%]' />
      <div className='landing-hero-stardust absolute inset-0' />
    </div>
  )
}

export function LandingHero(props: LandingHeroProps) {
  const { t } = useTranslation()
  const primaryPath = props.isAuthenticated ? '/dashboard' : '/sign-up'
  const primaryLabel = props.isAuthenticated
    ? t('Go to Dashboard')
    : t('Get Started')
  const secondaryPath = props.catalogAvailable ? '/pricing' : '/docs'
  const secondaryLabel = props.catalogAvailable
    ? t('Explore models')
    : t('Docs')

  return (
    <section className='border-border/70 relative grid min-h-svh min-w-0 grid-rows-[31svh_auto_1fr] overflow-hidden border-b sm:grid-rows-[27svh_auto_1fr]'>
      <HeroRibbonBackdrop />

      <div className='relative row-start-2 mx-auto flex w-full max-w-6xl min-w-0 flex-col items-center px-4 text-center sm:px-6'>
        <h1 className='text-foreground relative z-10 max-w-[calc(100vw-2rem)] text-3xl leading-[1.12] font-bold sm:max-w-4xl sm:text-5xl lg:text-6xl'>
          {t('One API key')}
          <br />
          {t('Connect to global AI models')}
        </h1>
        <p className='text-muted-foreground relative z-10 mt-5 max-w-2xl text-base leading-7 font-medium sm:text-lg'>
          {t('Prices start at less than 1/100 of official rates.')}
        </p>
        <div className='relative z-10 mt-7 flex flex-wrap items-center justify-center gap-3 lg:mt-10'>
          <Button
            size='lg'
            className='h-11 px-5'
            render={<Link to={primaryPath} />}
          >
            {primaryLabel}
            <HugeiconsIcon icon={ArrowRight01Icon} data-icon='inline-end' />
          </Button>
          <Button
            variant='ghost'
            size='lg'
            className='h-11 px-5'
            render={<Link to={secondaryPath} />}
          >
            {secondaryLabel}
          </Button>
        </div>
      </div>

      <div className='relative row-start-3 min-w-0 self-end'>
        <ProviderMarquee />
      </div>
    </section>
  )
}
