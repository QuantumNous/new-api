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
import { useSystemConfig } from '@/hooks/use-system-config'
import { cn } from '@/lib/utils'

import { minimalHomeLayoutClasses } from '../../lib/home-layout'

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
}

export function Hero(props: HeroProps) {
  const { t } = useTranslation()
  const { systemName, logo } = useSystemConfig()
  const displayName = systemName || 'New API'
  const displayLogo = logo || '/logo.png'

  return (
    <main className={cn(minimalHomeLayoutClasses.hero, props.className)}>
      <div aria-hidden='true' className='pointer-events-none absolute inset-0'>
        <div className='bg-primary/10 absolute top-1/2 left-1/2 size-[32rem] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl' />
      </div>

      <div className={minimalHomeLayoutClasses.content}>
        <div className='bg-card ring-border/60 mb-7 flex size-16 items-center justify-center rounded-2xl shadow-sm ring-1'>
          <img
            src={displayLogo}
            alt={displayName}
            className='size-10 rounded-xl object-contain'
          />
        </div>

        <h1 className='from-foreground via-foreground to-primary bg-gradient-to-r bg-clip-text text-5xl leading-tight font-semibold tracking-tight text-balance text-transparent sm:text-6xl md:text-7xl'>
          {displayName}
        </h1>
        <p className='text-muted-foreground mt-5 max-w-xl text-base leading-relaxed text-balance sm:text-lg'>
          {t('Build on your API gateway in minutes')}
        </p>

        <div className={minimalHomeLayoutClasses.actions}>
          <Button
            size='lg'
            className='h-11 rounded-xl px-5'
            render={
              <Link to={props.isAuthenticated ? '/dashboard' : '/sign-up'} />
            }
          >
            {props.isAuthenticated ? t('Go to Dashboard') : t('Get Started')}
            <HugeiconsIcon icon={ArrowRight01Icon} data-icon='inline-end' />
          </Button>
        </div>
      </div>
    </main>
  )
}
