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

interface HomeCtaSectionProps {
  isAuthenticated: boolean
}

export function HomeCtaSection(props: HomeCtaSectionProps) {
  const { t } = useTranslation()
  const path = props.isAuthenticated ? '/dashboard' : '/sign-up'
  const label = props.isAuthenticated ? t('Go to Dashboard') : t('Get Started')

  return (
    <section className='bg-primary/5 px-4 py-16 sm:px-6 sm:py-20'>
      <div className='mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-8 md:flex-row md:items-center'>
        <div>
          <p className='text-primary mb-3 text-xs font-semibold uppercase'>
            {t('Ready when you are')}
          </p>
          <h2 className='max-w-3xl text-3xl leading-tight font-semibold sm:text-4xl'>
            {t('Give your next model request a clearer path.')}
          </h2>
          <p className='text-muted-foreground mt-3 max-w-2xl text-sm leading-7 sm:text-base'>
            {t(
              'Create an API key and connect to the models available on this deployment.'
            )}
          </p>
        </div>
        <Button
          size='lg'
          className='h-11 shrink-0 px-5'
          render={<Link to={path} />}
        >
          {label}
          <HugeiconsIcon icon={ArrowRight01Icon} data-icon='inline-end' />
        </Button>
      </div>
    </section>
  )
}
