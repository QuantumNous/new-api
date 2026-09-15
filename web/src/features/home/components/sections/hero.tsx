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
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

interface HeroProps {
  isAuthenticated?: boolean
  maxSavingsPercent?: number
}

function AnimatedPercent(props: { value?: number }) {
  const [shown, setShown] = useState(0)

  useEffect(() => {
    if (props.value == null) {
      setShown(0)
      return
    }
    const target = props.value
    const start = performance.now()
    const duration = 900
    let frame = 0
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - (1 - progress) ** 3
      setShown(Math.round(target * eased))
      if (progress < 1) {
        frame = requestAnimationFrame(tick)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [props.value])

  return <span data-testid='hero-savings-percent'>{shown}</span>
}

export function Hero(props: HeroProps) {
  const { t } = useTranslation()
  const primaryTo = props.isAuthenticated ? '/dashboard' : '/sign-up'
  const primaryLabel = props.isAuthenticated
    ? t('Go to Dashboard')
    : t('Start saving')

  return (
    <section className='px-4 pt-28 pb-10 sm:px-6 md:pt-32 md:pb-14'>
      <div className='mx-auto max-w-5xl'>
        <h1 className='ci-display text-[clamp(3.1rem,8vw,6.4rem)] text-[var(--ci-ink)]'>
          <span className='block'>
            {t('Save up to')}{' '}
            <span className='whitespace-nowrap'>
              <AnimatedPercent value={props.maxSavingsPercent ?? 0} />%
            </span>
          </span>
          <span className='mt-1 block'>{t('on AI models')}</span>
        </h1>
        <p className='mt-6 max-w-2xl text-base leading-relaxed text-[var(--ci-body)] md:text-lg'>
          {t(
            'Access leading discounted AI models from multiple providers through one OpenAI-compatible API,'
          )}{' '}
          <strong className='font-semibold'>
            {t('without changing your request format.')}
          </strong>
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
        <ul className='text-muted-foreground mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm'>
          <li>{t('Pay as you go')}</li>
          <li>{t('Usage-based pricing')}</li>
          <li>{t('No monthly commitment')}</li>
        </ul>
      </div>
    </section>
  )
}
