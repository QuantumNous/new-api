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
import { AnimateInView } from '@/components/animate-in-view'

interface CTAProps {
  className?: string
  isAuthenticated?: boolean
}

export function CTA(props: CTAProps) {
  const { t } = useTranslation()

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
            'radial-gradient(ellipse 55% 45% at 30% 50%, rgba(124,58,237,0.28) 0%, transparent 70%)',
            'radial-gradient(ellipse 42% 38% at 70% 40%, rgba(217,70,239,0.2) 0%, transparent 70%)',
          ].join(', '),
        }}
      />

      <AnimateInView
        className='mx-auto max-w-2xl text-center'
        animation='scale-in'
      >
        <h2 className='text-2xl leading-tight font-bold tracking-tight md:text-4xl'>
          {t('Ready to replace')}
          <br />
          <span className='bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 bg-clip-text text-transparent dark:from-violet-200 dark:via-fuchsia-300 dark:to-indigo-300'>
            {t('model chaos with one key?')}
          </span>
        </h2>
        <p className='text-muted-foreground/80 mx-auto mt-5 max-w-md text-sm leading-relaxed md:text-base'>
          {t(
            'Start from the flatkey homepage, manage your product dashboard, and keep router.flatkey.ai as the stable API endpoint.'
          )}
        </p>
        <div className='mt-8 flex items-center justify-center gap-3'>
          <Button
            className='group rounded-lg bg-violet-600 text-white shadow-[0_16px_34px_-18px_rgba(124,58,237,0.85)] hover:bg-violet-500'
            render={<Link to='/sign-up' />}
          >
            {t('Get a key')}
            <ArrowRight className='ml-1 size-3.5 transition-transform duration-200 group-hover:translate-x-0.5' />
          </Button>
          <Button
            variant='outline'
            className='rounded-lg border-violet-500/20 bg-white/65 hover:border-violet-500/35 hover:bg-violet-500/10 dark:bg-white/[0.04] dark:hover:bg-violet-300/10'
            render={<Link to='/pricing' />}
          >
            {t('View Pricing')}
          </Button>
        </div>
      </AnimateInView>
    </section>
  )
}
