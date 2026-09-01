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
import { BookOpen, KeyRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { Footer } from '@/components/layout/components/footer'
import { Button } from '@/components/ui/button'

import { AddressKit } from './components/address-kit'
import { Troubleshoot, UseCasePicker } from './components/help-sections'
import { ToolExplorer } from './components/tool-explorer'
import { useGuideAddress } from './use-guide-address'

/**
 * In-site beginner onboarding guide. All interface addresses are resolved
 * from the live deployment configuration at render time — the guide keeps
 * working as-is when the domain changes.
 */
export function Guide() {
  const { t } = useTranslation()
  const address = useGuideAddress()

  return (
    <PublicLayout showMainContainer={false}>
      <main className='relative overflow-hidden'>
        {/* Decorative candy blobs */}
        <div
          aria-hidden='true'
          className='dopa-blob dopa-float pointer-events-none absolute -top-24 -right-24 size-72'
          style={{ backgroundColor: 'var(--chart-3)' }}
        />
        <div
          aria-hidden='true'
          className='dopa-blob dopa-float-delayed pointer-events-none absolute top-96 -left-32 size-80'
          style={{ backgroundColor: 'var(--chart-2)' }}
        />

        <div className='relative mx-auto flex max-w-6xl flex-col gap-16 px-6 py-14 md:gap-20 md:py-20'>
          {/* Header */}
          <header className='dopa-fade-up flex max-w-3xl flex-col gap-4'>
            <span className='bg-accent text-accent-foreground inline-flex w-fit items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold'>
              <BookOpen className='size-4' />
              {t('Beginner guide')}
            </span>
            <h1 className='text-4xl font-extrabold tracking-tight text-balance md:text-5xl'>
              {t('Plug AI into your favorite tools,')}{' '}
              <span className='dopa-gradient-text'>
                {t('no tech background needed')}
              </span>
            </h1>
            <p className='text-muted-foreground text-lg leading-relaxed text-pretty'>
              {t(
                'Every tool only ever asks you for three things. Grab them below, pick your tool, and follow the steps — done in about three minutes.'
              )}
            </p>
            <div className='flex flex-wrap gap-3 pt-1'>
              <Button
                size='lg'
                className='dopa-press rounded-full font-bold'
                render={<Link to='/keys' />}
              >
                <KeyRound className='size-4' />
                {t('Create my key')}
              </Button>
            </div>
          </header>

          {/* The three essentials */}
          <section
            className='dopa-fade-up flex flex-col gap-5'
            style={{ animationDelay: '120ms' }}
            aria-labelledby='guide-essentials'
          >
            <h2
              id='guide-essentials'
              className='text-xl font-extrabold text-balance md:text-2xl'
            >
              {t('The three things every tool asks for')}
            </h2>
            <AddressKit address={address} />
          </section>

          {/* Tool wall */}
          <section
            className='flex flex-col gap-5'
            aria-labelledby='guide-tools'
          >
            <div>
              <h2
                id='guide-tools'
                className='text-xl font-extrabold text-balance md:text-2xl'
              >
                {t('Pick your tool, follow the steps')}
              </h2>
              <p className='text-muted-foreground mt-1 text-sm'>
                {t(
                  'Click any card for step-by-step setup. Addresses in the steps are already filled in with the real address of this site.'
                )}
              </p>
            </div>
            <ToolExplorer address={address} />
          </section>

          <UseCasePicker />

          <Troubleshoot />
        </div>
      </main>
      <Footer />
    </PublicLayout>
  )
}
