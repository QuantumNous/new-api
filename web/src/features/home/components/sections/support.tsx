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

import { AnimateInView } from '@/components/animate-in-view'
import { Button } from '@/components/ui/button'

export function Support() {
  const { t } = useTranslation()

  return (
    <section className='relative z-10 px-6 py-24 sm:px-10 md:py-32 lg:px-14'>
      <div className='mx-auto max-w-4xl text-center'>
        <AnimateInView className='mx-auto mb-16 max-w-3xl md:mb-20'>
          <p className='text-primary mb-5 font-mono text-[11px] tracking-[0.28em] uppercase'>
            05 / {t('Support')}
          </p>
          <h2 className='text-foreground font-serif text-4xl leading-[1.05] font-medium tracking-[-0.02em] md:text-5xl'>
            {t('Every route,')}
            <br />
            {t('needs clear context.')}
          </h2>
        </AnimateInView>

        <div className='landing-card-motion border-border/60 bg-card/40 rounded-2xl border p-8 text-center md:p-12'>
          <div className='text-primary mb-3 font-mono text-[10px] tracking-[0.2em] uppercase'>
            {t('Support, one message away')}
          </div>
          <div className='text-muted-foreground mx-auto mt-6 max-w-2xl space-y-4 text-sm leading-7'>
            <p>
              {t(
                'Support may operate in a different time zone from yours, but replies arrive within 20 hours at the latest.'
              )}
            </p>
            <p>
              {t(
                'When reporting an issue, include the group, model, time, and error. Refunds are normally returned to account balance with a 1% processing fee; payment gateways can add delay.'
              )}
            </p>
            <p>
              {t(
                'Please avoid sending repeated messages while waiting for a reply. Platform-wide incidents, upstream risk controls, or overload can also affect primary routes.'
              )}
            </p>
          </div>
        </div>

        <div className='mt-20 text-center'>
          <h3 className='text-foreground font-serif text-3xl leading-tight font-medium tracking-[-0.02em] md:text-4xl'>
            {t('Ready to build on one router?')}
          </h3>
          <div className='mt-8 flex flex-wrap items-center justify-center gap-3'>
            <Button
              className='group h-12 rounded-full px-7 text-base font-medium'
              render={<Link to='/sign-up' />}
            >
              {t('Create account')}
              <ArrowRight className='ml-1.5 size-4 transition-transform group-hover:translate-x-0.5' />
            </Button>
            <Button
              variant='outline'
              className='border-border/60 h-12 rounded-full px-7 text-base font-medium'
              render={<Link to='/pricing' />}
            >
              {t('View pricing')}
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
