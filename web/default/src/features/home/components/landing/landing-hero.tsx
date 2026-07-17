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

import { Button } from '@/components/ui/button'

import { ProviderMarquee } from './provider-marquee'

interface LandingHeroProps {
  isAuthenticated: boolean
  catalogAvailable: boolean
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
    <section className='border-border/70 relative flex min-h-[760px] flex-col justify-between overflow-hidden border-b pt-16'>
      <div aria-hidden='true' className='pointer-events-none absolute inset-0'>
        <span className='bg-primary/15 absolute top-[38%] left-[7%] h-px w-[42%] -rotate-12' />
        <span className='bg-primary/15 absolute top-[32%] right-[4%] h-px w-[42%] rotate-12' />
        <span className='bg-primary/10 absolute bottom-[24%] left-[32%] h-px w-[36%] rotate-6' />
        <span className='border-primary/25 bg-background absolute top-[30%] left-[18%] size-1.5 rounded-[2px] border' />
        <span className='border-primary/25 bg-background absolute top-[40%] right-[18%] size-1.5 rounded-[2px] border' />
      </div>

      <div className='relative mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-4 pt-20 pb-16 text-center sm:px-6 sm:pt-24'>
        <p className='text-primary mb-5 text-xs font-semibold uppercase'>
          {t('Unified AI gateway')}
        </p>
        <h1 className='text-foreground text-4xl leading-[1.08] font-bold sm:text-5xl lg:text-6xl'>
          {t('One API key')}
          <br />
          {t('Connect to global AI models')}
        </h1>
        <p className='text-muted-foreground mt-6 max-w-2xl text-sm leading-7 sm:text-base'>
          {t(
            'One endpoint, transparent pricing, and configurable routing. Use familiar APIs to access the models your product needs.'
          )}
        </p>
        <div className='mt-8 flex flex-wrap items-center justify-center gap-3'>
          <Button
            size='lg'
            className='h-11 px-5'
            render={<Link to={primaryPath} />}
          >
            {primaryLabel}
            <HugeiconsIcon icon={ArrowRight01Icon} data-icon='inline-end' />
          </Button>
          <Button
            variant='outline'
            size='lg'
            className='h-11 px-5'
            render={<Link to={secondaryPath} />}
          >
            {secondaryLabel}
          </Button>
        </div>
        <p className='text-muted-foreground mt-7 flex items-center gap-2 text-xs leading-5'>
          <span className='bg-success size-1.5 shrink-0 rounded-full' />
          {t('The catalog and availability shown here follow this deployment.')}
        </p>
      </div>

      <div className='relative'>
        <ProviderMarquee />
      </div>
    </section>
  )
}
