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
import { ArrowRight, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import { Button } from '@/components/ui/button'
import { useStatus } from '@/hooks/use-status'

interface CTAProps {
  className?: string
  isAuthenticated?: boolean
}

export function CTA(props: CTAProps) {
  const { t } = useTranslation()
  const { status } = useStatus()

  const systemName = (status?.system_name as string) || '随星AI'

  if (props.isAuthenticated) {
    return null
  }

  return (
    <section className='relative z-10 overflow-hidden px-6 py-24 md:py-32'>
      {/* Gradient mesh background */}
      <div
        aria-hidden
        className='absolute inset-0 -z-10 opacity-20 dark:opacity-[0.08]'
        style={{
          background: [
            'radial-gradient(ellipse 50% 50% at 30% 50%, oklch(0.65 0.16 260 / 70%) 0%, transparent 70%)',
            'radial-gradient(ellipse 40% 40% at 70% 40%, oklch(0.55 0.12 210 / 50%) 0%, transparent 70%)',
            'radial-gradient(ellipse 30% 30% at 50% 20%, oklch(0.7 0.14 80 / 40%) 0%, transparent 70%)',
          ].join(', '),
        }}
      />

      <AnimateInView
        className='mx-auto max-w-2xl text-center'
        animation='scale-in'
      >
        <div className='mb-6 inline-flex items-center gap-1.5 rounded-full border border-amber-500/15 bg-amber-500/5 px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-400'>
          <Sparkles className='size-3' />
          <span>{systemName} · {t('Computing Engine')}</span>
        </div>

        <h2 className='text-3xl leading-tight font-bold tracking-tight md:text-5xl'>
          <span className='bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-500 bg-clip-text text-transparent'>
            {t('Ready to deploy')}
          </span>
          <br />
          <span className='text-foreground/90'>{t('your AI compute gateway?')}</span>
        </h2>
        <p className='text-muted-foreground/80 mx-auto mt-5 max-w-md text-base leading-relaxed md:text-lg'>
          {t(
            'Deploy your private AI compute platform in minutes. Unified access, custom pricing, and revenue settlement — ready for wholesale and enterprise.'
          )}
        </p>
        <div className='mt-8 flex items-center justify-center gap-3'>
          <Button className='group rounded-lg' render={<Link to='/sign-up' />}>
            {t('Get Started')}
            <ArrowRight className='ml-1 size-3.5 transition-transform duration-200 group-hover:translate-x-0.5' />
          </Button>
          <Button
            variant='outline'
            className='border-border/50 hover:border-border hover:bg-muted/50 rounded-lg'
            render={<Link to='/pricing' />}
          >
            {t('View Pricing')}
          </Button>
        </div>
      </AnimateInView>
    </section>
  )
}
