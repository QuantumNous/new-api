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

interface CTAProps {
  className?: string
  isAuthenticated?: boolean
}

export function CTA(props: CTAProps) {
  const { t } = useTranslation()
  const primaryTo = props.isAuthenticated ? '/dashboard' : '/sign-up'
  const primaryLabel = props.isAuthenticated
    ? t('Go to Dashboard')
    : t('Start saving')

  return (
    <section className='px-4 py-20 sm:px-6 md:py-28'>
      <div className='mx-auto max-w-5xl'>
        <h2 className='ci-display text-[clamp(2.6rem,6vw,5.2rem)] text-[var(--ci-ink)]'>
          {t('Lower the cost of your')}
          <span className='mt-1 block'>{t('next API request')}</span>
        </h2>
        <p className='text-muted-foreground mt-5 max-w-xl text-base leading-relaxed'>
          {t(
            'Create an account, add credit, and keep your current request format.'
          )}
        </p>
        <div className='mt-8 flex flex-wrap items-center gap-3'>
          <Button
            size='lg'
            className='h-10 rounded-md px-4 text-sm'
            render={<Link to={primaryTo} />}
          >
            {primaryLabel}
            <ArrowRight className='size-4' />
          </Button>
          {props.isAuthenticated ? (
            <Button
              variant='outline'
              size='lg'
              className='h-10 rounded-md px-4 text-sm'
              render={<Link to='/guide' />}
            >
              {t('Read the docs')}
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  )
}
