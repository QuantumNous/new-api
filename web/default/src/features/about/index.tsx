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
import { useQuery } from '@tanstack/react-query'
import { Construction } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Markdown } from '@/components/ui/markdown'
import { Skeleton } from '@/components/ui/skeleton'
import { PublicLayout } from '@/components/layout'
import { getAboutContent } from './api'

function isValidUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function isLikelyHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value)
}

function EmptyAboutState() {
  const { t } = useTranslation()
  const currentYear = new Date().getFullYear()

  return (
    <div className='flex min-h-[60vh] items-center justify-center p-8'>
      <div className='max-w-2xl space-y-6 text-center'>
        <div className='flex justify-center'>
          <Construction className='text-muted-foreground h-24 w-24' />
        </div>
        <div className='space-y-2'>
          <h2 className='text-2xl font-bold'>{t('About Center')}</h2>
          <p className='text-muted-foreground'>
            {t(
              'Yunhe Xingze Token Operations Center provides integrated model service access, token resource operations, tenant management, and call auditing for enterprise scenarios.'
            )}
          </p>
        </div>
        <div className='mx-auto grid max-w-2xl gap-3 text-left text-sm sm:grid-cols-2'>
          <div className='bg-muted/30 rounded-lg border p-4'>
            <p className='font-medium'>{t('Unified Model Service Access')}</p>
            <p className='text-muted-foreground mt-1'>
              {t(
                'Centralized access and governance for multiple model services.'
              )}
            </p>
          </div>
          <div className='bg-muted/30 rounded-lg border p-4'>
            <p className='font-medium'>{t('Token Resource Operations')}</p>
            <p className='text-muted-foreground mt-1'>
              {t('Manage token quota, recharge, settlement, and consumption.')}
            </p>
          </div>
          <div className='bg-muted/30 rounded-lg border p-4'>
            <p className='font-medium'>{t('Tenant Account Governance')}</p>
            <p className='text-muted-foreground mt-1'>
              {t(
                'Coordinate tenant groups, accounts, roles, and access policies.'
              )}
            </p>
          </div>
          <div className='bg-muted/30 rounded-lg border p-4'>
            <p className='font-medium'>{t('Call Audit Center')}</p>
            <p className='text-muted-foreground mt-1'>
              {t(
                'Track service calls, usage details, and operational records.'
              )}
            </p>
          </div>
        </div>
        <div className='text-muted-foreground space-y-2 text-sm'>
          <p>
            &copy; {currentYear} {t('Yunhe Xingze Token Operations Center')}.{' '}
            {t('All rights reserved.')}
          </p>
        </div>
      </div>
    </div>
  )
}

export function About() {
  const { t } = useTranslation()
  const { data, isLoading } = useQuery({
    queryKey: ['about-content'],
    queryFn: getAboutContent,
  })

  const rawContent = data?.data?.trim() ?? ''
  const hasContent = rawContent.length > 0
  const isUrl = hasContent && isValidUrl(rawContent)
  const isHtml = hasContent && !isUrl && isLikelyHtml(rawContent)

  if (isLoading) {
    return (
      <PublicLayout>
        <div className='mx-auto flex max-w-4xl flex-col gap-4 py-12'>
          <Skeleton className='h-8 w-[45%]' />
          <Skeleton className='h-4 w-full' />
          <Skeleton className='h-4 w-[90%]' />
          <Skeleton className='h-4 w-[80%]' />
        </div>
      </PublicLayout>
    )
  }

  if (!hasContent) {
    return (
      <PublicLayout>
        <EmptyAboutState />
      </PublicLayout>
    )
  }

  if (isUrl) {
    return (
      <PublicLayout showMainContainer={false}>
        <iframe
          src={rawContent}
          className='h-[calc(100vh-3.5rem)] w-full border-0'
          title={t('About Center')}
        />
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <div className='mx-auto max-w-6xl px-4 py-8'>
        {isHtml ? (
          <div
            className='prose prose-neutral dark:prose-invert max-w-none'
            dangerouslySetInnerHTML={{ __html: rawContent }}
          />
        ) : (
          <Markdown className='prose-neutral dark:prose-invert max-w-none'>
            {rawContent}
          </Markdown>
        )}
      </div>
    </PublicLayout>
  )
}
