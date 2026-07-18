/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
    70|but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { Link, createFileRoute } from '@tanstack/react-router'
import { ExternalLink, MessageCircleWarning } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  resolveCustomPageOpenMode,
  type CustomPageStatusItem,
} from '@/features/system-settings/extensions/constants'
import { useStatus } from '@/hooks/use-status'

export const Route = createFileRoute('/_authenticated/custom-pages/$pageId')({
  component: CustomPageRouteComponent,
})

function CustomPageRouteComponent() {
  const { t } = useTranslation()
  const { pageId } = Route.useParams()
  const { status, loading } = useStatus()
  const autoOpenedRef = useRef(false)

  const page = useMemo(() => {
    const pages = (status?.custom_pages ??
      status?.data?.custom_pages) as CustomPageStatusItem[] | undefined
    if (!Array.isArray(pages)) return undefined
    return pages.find((item) => item.id === pageId)
  }, [pageId, status])

  const openMode = resolveCustomPageOpenMode(page?.open_mode)

  useEffect(() => {
    autoOpenedRef.current = false
  }, [page?.id, page?.url, openMode])

  useEffect(() => {
    if (!page?.url || openMode !== 'external' || autoOpenedRef.current) {
      return
    }
    autoOpenedRef.current = true
    window.open(page.url, '_blank', 'noopener,noreferrer')
  }, [openMode, page?.url])

  if (loading && !page) {
    return (
      <div className='flex h-full items-center justify-center p-6'>
        <p className='text-muted-foreground text-sm'>{t('Loading...')}</p>
      </div>
    )
  }

  if (!page || !page.url) {
    return (
      <div className='flex h-full flex-col items-center justify-center gap-4 p-6 text-center'>
        <MessageCircleWarning className='text-muted-foreground h-12 w-12' />
        <div className='space-y-1'>
          <h2 className='text-lg font-semibold'>
            {t('Custom page not found')}
          </h2>
          <p className='text-muted-foreground'>
            {t(
              'The requested page does not exist, is disabled, or has no URL configured.'
            )}
          </p>
        </div>
        <Button variant='outline' render={<Link to='/dashboard' />}>
          {t('Return to dashboard')}
        </Button>
      </div>
    )
  }

  if (openMode === 'external') {
    return (
      <div className='flex h-full flex-col items-center justify-center gap-4 p-6 text-center'>
        <ExternalLink className='text-muted-foreground h-12 w-12' />
        <div className='space-y-1'>
          <h2 className='text-lg font-semibold'>{page.title}</h2>
          <p className='text-muted-foreground max-w-md'>
            {t(
              'This page opens in a new browser tab because the target site cannot be embedded.'
            )}
          </p>
        </div>
        <div className='flex flex-wrap items-center justify-center gap-2'>
          <Button
            onClick={() =>
              window.open(page.url, '_blank', 'noopener,noreferrer')
            }
          >
            <ExternalLink className='mr-2 h-4 w-4' />
            {t('Open in new tab')}
          </Button>
          <Button variant='outline' render={<Link to='/dashboard' />}>
            {t('Return to dashboard')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className='flex h-full min-h-0 flex-col'>
      <div className='bg-background flex shrink-0 items-center justify-between gap-3 border-b px-3 py-2'>
        <p className='truncate text-sm font-medium'>{page.title}</p>
        <Button
          size='sm'
          variant='outline'
          onClick={() => window.open(page.url, '_blank', 'noopener,noreferrer')}
        >
          <ExternalLink className='mr-2 h-4 w-4' />
          {t('Open in new tab')}
        </Button>
      </div>
      <iframe
        src={page.url}
        key={page.url}
        className='min-h-0 w-full flex-1 border-0'
        title={page.title}
      />
    </div>
  )
}
