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
import { ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/empty-state'
import { Main } from '@/components/layout/components/main'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { useCustomPages } from './hooks/use-custom-pages'

/* oxlint-disable react/iframe-missing-sandbox -- Administrator-configured pages require scripts and their own origin; top navigation remains blocked. */
export function CustomPageEmbed(props: { slug: string }) {
  const { t } = useTranslation()
  const pages = useCustomPages()
  const role = useAuthStore((state) => state.auth.user?.role ?? ROLE.GUEST)
  const page = pages.links.find((link) => link.slug === props.slug)

  if (pages.isLoading) return <LoadingState />
  if (pages.isError) {
    return <EmptyState title={t('Failed to load custom pages')} />
  }
  if (!page || (page.adminOnly && role < ROLE.ADMIN)) {
    return (
      <EmptyState
        title={t('Page not found')}
        description={t(
          'This page is not configured, was renamed, or is limited to administrators.'
        )}
      />
    )
  }

  return (
    <Main>
      <header className='flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3'>
        <div className='min-w-0 flex-1'>
          <h1 className='truncate text-base font-semibold'>{page.name}</h1>
          <p
            className='text-muted-foreground truncate text-xs'
            title={page.url}
          >
            {page.url}
          </p>
        </div>
        <Button
          role='link'
          variant='outline'
          size='sm'
          render={
            <a href={page.url} target='_blank' rel='noopener noreferrer' />
          }
        >
          <ExternalLink aria-hidden='true' />
          {t('Open in new tab')}
        </Button>
      </header>
      <iframe
        key={page.url}
        src={page.url}
        title={page.name}
        className='min-h-0 w-full flex-1 border-0'
        sandbox='allow-scripts allow-same-origin allow-forms allow-popups allow-downloads'
        referrerPolicy='no-referrer'
      />
    </Main>
  )
}
