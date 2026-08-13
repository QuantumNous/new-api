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
import {
  ArrowRight01Icon,
  BookOpen01Icon,
  Key01Icon,
  Store01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { RichContent } from '@/components/rich-content'
import { Button } from '@/components/ui/button'

const API_BASE_URL = 'https://async-api.nexaapp.cn/v1'

export function ApiDocs() {
  const { t } = useTranslation()

  return (
    <PublicLayout>
      <div className='mx-auto max-w-6xl pt-8 pb-16 md:pt-14'>
        <section className='border-border/70 bg-card relative overflow-hidden rounded-3xl border px-6 py-10 shadow-sm md:px-10 md:py-14'>
          <div className='bg-primary/10 absolute -top-24 -right-24 size-72 rounded-full blur-3xl' />
          <div className='relative max-w-3xl'>
            <div className='text-primary mb-4 inline-flex items-center gap-2 text-sm font-medium'>
              <HugeiconsIcon icon={BookOpen01Icon} className='size-4' />
              {t('OpenAI-compatible public API')}
            </div>
            <h1 className='text-3xl font-semibold tracking-tight md:text-5xl'>
              {t('API Documentation')}
            </h1>
            <p className='text-muted-foreground mt-5 max-w-2xl text-base leading-7 md:text-lg'>
              {t(
                'Connect chat and image models through one API. The examples below use the interfaces currently available in production.'
              )}
            </p>

            <div className='mt-7 flex flex-wrap gap-3'>
              <Button size='lg' render={<Link to='/sign-up' />}>
                {t('Register and get started')}
                <HugeiconsIcon icon={ArrowRight01Icon} className='size-4' />
              </Button>
              <Button
                size='lg'
                variant='outline'
                render={<Link to='/pricing' />}
              >
                <HugeiconsIcon icon={Store01Icon} className='size-4' />
                {t('View models and pricing')}
              </Button>
              <Button size='lg' variant='outline' render={<Link to='/keys' />}>
                <HugeiconsIcon icon={Key01Icon} className='size-4' />
                {t('Create API Key')}
              </Button>
            </div>
          </div>
        </section>

        <div className='mt-6 grid gap-4 sm:grid-cols-3'>
          <div className='border-border/70 bg-card rounded-2xl border p-5'>
            <p className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
              {t('Base URL')}
            </p>
            <code className='mt-2 block overflow-x-auto text-sm font-medium'>
              {API_BASE_URL}
            </code>
          </div>
          <div className='border-border/70 bg-card rounded-2xl border p-5'>
            <p className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
              {t('Authentication')}
            </p>
            <p className='mt-2 text-sm font-medium'>Bearer API Key</p>
          </div>
          <div className='border-border/70 bg-card rounded-2xl border p-5'>
            <p className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
              {t('Protocol')}
            </p>
            <p className='mt-2 text-sm font-medium'>OpenAI Compatible</p>
          </div>
        </div>

        <article className='border-border/70 bg-card mt-6 rounded-3xl border px-6 py-8 shadow-sm md:px-10 md:py-10'>
          <RichContent
            mode='markdown'
            content={t('API documentation content')}
            className='prose-neutral dark:prose-invert md:prose-base max-w-none [&_h2]:scroll-mt-24 [&_h2]:border-b [&_h2]:pb-2 [&_pre]:rounded-xl'
          />
        </article>
      </div>
    </PublicLayout>
  )
}
