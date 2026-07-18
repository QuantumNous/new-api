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
    <section className='border-border/70 relative grid min-h-svh min-w-0 grid-rows-[31svh_auto_1fr] overflow-hidden border-b sm:grid-rows-[27svh_auto_1fr]'>
      <div aria-hidden='true' className='pointer-events-none absolute inset-0'>
        <span className='bg-primary/15 absolute top-[38%] left-[7%] h-px w-[42%] -rotate-12' />
        <span className='bg-primary/15 absolute top-[32%] right-[4%] h-px w-[42%] rotate-12' />
        <span className='bg-primary/10 absolute bottom-[24%] left-[32%] h-px w-[36%] rotate-6' />
        <span className='border-primary/25 bg-background absolute top-[30%] left-[18%] size-1.5 rounded-[2px] border' />
        <span className='border-primary/25 bg-background absolute top-[40%] right-[18%] size-1.5 rounded-[2px] border' />
      </div>

      <div className='relative row-start-2 mx-auto flex w-full max-w-6xl min-w-0 flex-col items-center px-4 text-center sm:px-6'>
        <h1 className='text-foreground text-4xl leading-[1.08] font-bold sm:text-5xl lg:text-6xl'>
          {t('One API key')}
          <br />
          {t('Connect to global AI models')}
        </h1>
        <div className='mt-8 flex flex-wrap items-center justify-center gap-3 lg:mt-12'>
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
      </div>

      <div className='relative row-start-3 min-w-0 self-end'>
        <ProviderMarquee />
      </div>
    </section>
  )
}
