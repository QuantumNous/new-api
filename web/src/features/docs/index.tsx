/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

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

import { DocsQuickStart } from './components/docs-quickstart'
import { DocsReferenceSections } from './components/docs-reference-sections'

const sections = [
  { id: 'quick-start', title: 'Quick start' },
  { id: 'api-reference', title: 'API reference' },
  { id: 'security', title: 'Keep your key safe' },
  { id: 'troubleshooting', title: 'Troubleshooting' },
]

export function Docs() {
  const { t } = useTranslation()

  return (
    <PublicLayout showMainContainer={false}>
      <main className='mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 lg:py-16'>
        <header
          id='overview'
          className='border-border/60 from-primary/10 via-background to-background mb-12 rounded-3xl border bg-gradient-to-br p-7 sm:p-10'
        >
          <div className='text-primary mb-4 flex items-center gap-2 text-sm font-medium'>
            <BookOpen className='size-4' aria-hidden='true' />
            {t('Documentation')}
          </div>
          <h1 className='max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl'>
            {t('Connect to your models in a few minutes.')}
          </h1>
          <p className='text-muted-foreground mt-4 max-w-2xl text-base leading-7'>
            {t(
              'A short guide to creating an API key, choosing a model, and sending your first request.'
            )}
          </p>
          <div className='mt-7 flex flex-wrap gap-3'>
            <Link
              to='/dashboard'
              className='bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium transition-colors'
            >
              <KeyRound className='mr-2 size-4' aria-hidden='true' />
              {t('Open Console')}
            </Link>
            <Link
              to='/pricing'
              className='border-border bg-background hover:bg-muted inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium transition-colors'
            >
              {t('Browse models')}
            </Link>
          </div>
        </header>

        <div className='grid gap-12 lg:grid-cols-[190px_minmax(0,1fr)]'>
          <aside className='lg:sticky lg:top-24 lg:h-fit'>
            <p className='text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase'>
              {t('On this page')}
            </p>
            <nav aria-label={t('Documentation sections')}>
              <ul className='border-border space-y-1 border-l pl-4'>
                {sections.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className='text-muted-foreground hover:text-foreground block py-1.5 text-sm transition-colors'
                    >
                      {t(section.title)}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          <div className='min-w-0 space-y-14'>
            <DocsQuickStart />
            <DocsReferenceSections />
          </div>
        </div>
      </main>
    </PublicLayout>
  )
}
