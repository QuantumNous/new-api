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
import { ArrowRight, BookOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useRevealOnScroll } from '@/hooks/use-reveal-on-scroll'

interface CTAProps {
  className?: string
  isAuthenticated?: boolean
}

export function CTA(props: CTAProps) {
  const { t } = useTranslation()
  const sectionRef = useRevealOnScroll<HTMLElement>()

  if (props.isAuthenticated) {
    return null
  }

  return (
    <section ref={sectionRef} className='relative z-10 px-6 py-16 md:py-20'>
      <div className='dopa-reveal dopa-section-shell' data-section='GO'>
        <div className='dopa-gradient-surface dopa-ribbon-surface dopa-candy-shadow dopa-cut-corner relative overflow-hidden px-8 py-14 text-left md:px-14 md:py-16'>
          {/* Soft white glow on top of the gradient for readability */}
          <div
            aria-hidden
            className='absolute inset-0 opacity-15'
            style={{
              background:
                'radial-gradient(ellipse 70% 60% at 50% 0%, white 0%, transparent 70%)',
            }}
          />
          <div className='relative grid items-end gap-8 lg:grid-cols-[1fr_auto]'>
            <div>
              <h2 className='max-w-2xl text-3xl font-black tracking-[-0.055em] text-balance text-white md:text-5xl'>
                {t('Ready to meet your new AI sidekick?')}
              </h2>
              <p className='mt-4 max-w-xl text-base leading-relaxed text-pretty text-white/85'>
                {t(
                  'Free to sign up. Three minutes to set up. A hundred models to play with.'
                )}
              </p>
            </div>
            <div className='flex flex-wrap items-center gap-3 lg:justify-end'>
              <Button
                className='dopa-spring dopa-shine text-foreground h-12 rounded-full bg-white px-7 text-base font-bold hover:bg-white/90'
                render={<Link to='/sign-up' />}
              >
                {t('Start for free')}
                <ArrowRight className='ml-1.5 size-4' />
              </Button>
              <Button
                variant='outline'
                className='dopa-spring h-12 rounded-full border-white/40 bg-transparent px-6 text-base font-semibold text-white hover:bg-white/10 hover:text-white'
                render={<Link to='/guide' />}
              >
                <BookOpen className='mr-1.5 size-4' />
                {t('Read the guide first')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
