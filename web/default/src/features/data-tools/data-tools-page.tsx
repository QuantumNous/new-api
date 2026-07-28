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
import { type FormEvent, type ReactNode, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useMediaQuery } from '@/hooks'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { SectionPageLayout } from '@/components/layout'
import { dataToolQueryKeys, getDataTools } from './api'
import { DataToolCard } from './components/data-tool-card'
import { DataToolInspectorPanel } from './components/data-tool-inspector-panel'
import { DataToolRunDialog } from './components/data-tool-run-dialog'
import { getMarketplacePlatforms } from './platforms'
import type { DataToolSummary } from './types'

const pageSize = 24
const collapsedPlatformCount = 16

export function DataToolsPage() {
  const { t } = useTranslation()
  const userQuota = useAuthStore((state) => state.auth.user?.quota ?? 0)
  const isDesktop = useMediaQuery('(min-width: 1280px)')
  const [searchDraft, setSearchDraft] = useState('')
  const [query, setQuery] = useState('')
  const [platform, setPlatform] = useState('')
  const [page, setPage] = useState(1)
  const [showAllPlatforms, setShowAllPlatforms] = useState(false)
  const [selectedTool, setSelectedTool] = useState<DataToolSummary | null>(null)
  const params = {
    q: query || undefined,
    platform: platform || undefined,
    page,
    page_size: pageSize,
  }
  const toolsQuery = useQuery({
    queryKey: dataToolQueryKeys.list(params),
    queryFn: () => getDataTools(params),
    placeholderData: (previous) => previous,
  })

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setQuery(searchDraft.trim())
    setPage(1)
    setSelectedTool(null)
  }

  function selectPlatform(nextPlatform: string) {
    setPlatform(nextPlatform)
    setPage(1)
    setSelectedTool(null)
  }

  const data = toolsQuery.data
  const canGoNext = data ? page * pageSize < data.matched : false
  const totalPages = data ? Math.max(1, Math.ceil(data.matched / pageSize)) : 1
  const marketplacePlatforms = getMarketplacePlatforms(data?.platforms ?? [])
  const visiblePlatforms = showAllPlatforms
    ? marketplacePlatforms
    : marketplacePlatforms.slice(0, collapsedPlatformCount)
  const remainingPlatforms = Math.max(
    0,
    marketplacePlatforms.length - collapsedPlatformCount
  )

  let catalogContent: ReactNode
  if (toolsQuery.isError) {
    catalogContent = (
      <div className='border-destructive/30 bg-destructive/5 text-destructive rounded-2xl border p-5 text-sm'>
        <p className='font-medium'>{t('Marketplace unavailable')}</p>
        <p>{toolsQuery.error.message}</p>
        <Button
          className='mt-3'
          size='sm'
          variant='outline'
          onClick={() => toolsQuery.refetch()}
        >
          {t('Try again')}
        </Button>
      </div>
    )
  } else if (toolsQuery.isPending) {
    catalogContent = (
      <div className='grid gap-3 md:grid-cols-2 2xl:grid-cols-3'>
        {Array.from({ length: 9 }, (_, index) => (
          <Skeleton key={index} className='h-48 rounded-2xl' />
        ))}
      </div>
    )
  } else if (data && data.tools.length > 0) {
    catalogContent = (
      <div className='grid gap-3 md:grid-cols-2 2xl:grid-cols-3'>
        {data.tools.map((tool) => (
          <DataToolCard
            key={tool.id}
            tool={tool}
            selected={selectedTool?.id === tool.id}
            onOpen={setSelectedTool}
          />
        ))}
      </div>
    )
  } else {
    catalogContent = (
      <div className='text-muted-foreground rounded-2xl border border-dashed p-16 text-center'>
        {t('No APIs match your filters.')}
      </div>
    )
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('API Marketplace')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <div className='text-muted-foreground text-right text-xs'>
          <p>{t('Available Flatkey Credits')}</p>
          <p className='text-foreground text-sm font-semibold'>
            {formatQuota(userQuota)}
          </p>
        </div>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='mx-auto grid w-full max-w-[1680px] gap-6 pb-4'>
          <section className='mx-auto grid w-full max-w-5xl gap-5 text-center'>
            <div>
              <p className='text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase'>
                {t('Developer tools')}
              </p>
              <p className='text-muted-foreground mt-2 text-sm sm:text-base'>
                {t(
                  'Explore and test {{tools}} endpoints across {{platforms}} platforms',
                  {
                    tools: data?.total.toLocaleString() ?? '—',
                    platforms: data ? marketplacePlatforms.length : '—',
                  }
                )}
              </p>
            </div>

            <form
              className='mx-auto flex w-full max-w-4xl flex-col gap-2 sm:flex-row'
              onSubmit={submitSearch}
            >
              <div className='relative min-w-0 flex-1'>
                <Search className='text-muted-foreground absolute top-1/2 left-4 size-4 -translate-y-1/2' />
                <Input
                  value={searchDraft}
                  className='h-11 rounded-full pl-11'
                  placeholder={t(
                    'Search endpoint name, platform, or capability'
                  )}
                  onChange={(event) => setSearchDraft(event.target.value)}
                />
              </div>
              <Button className='h-11 rounded-full px-6' type='submit'>
                {t('Search')}
              </Button>
            </form>

            <div>
              <p className='text-muted-foreground mb-3 text-xs font-semibold tracking-[0.14em] uppercase'>
                {t('Platforms')}
              </p>
              <div className='flex flex-wrap justify-center gap-2'>
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  className={cn(
                    'rounded-full',
                    platform === '' &&
                      'bg-foreground text-background hover:bg-foreground/90 hover:text-background'
                  )}
                  onClick={() => selectPlatform('')}
                >
                  {t('All')}
                  <span className='bg-background/10 rounded-full px-1.5 font-mono text-[11px]'>
                    {data?.total.toLocaleString() ?? '—'}
                  </span>
                </Button>
                {visiblePlatforms.map((item) => (
                  <Button
                    key={item.platform}
                    type='button'
                    size='sm'
                    variant='outline'
                    className={cn(
                      'rounded-full',
                      platform === item.platform &&
                        'bg-foreground text-background hover:bg-foreground/90 hover:text-background'
                    )}
                    onClick={() => selectPlatform(item.platform)}
                  >
                    {item.platform}
                    <span className='bg-background/10 rounded-full px-1.5 font-mono text-[11px]'>
                      {item.count}
                    </span>
                  </Button>
                ))}
                {!showAllPlatforms && remainingPlatforms > 0 && (
                  <Button
                    type='button'
                    size='sm'
                    variant='ghost'
                    className='rounded-full'
                    onClick={() => setShowAllPlatforms(true)}
                  >
                    {t('+{{count}} more', { count: remainingPlatforms })}
                  </Button>
                )}
              </div>
            </div>
          </section>

          <div className='flex flex-wrap items-center justify-between gap-2 border-t pt-5'>
            <p className='text-muted-foreground text-sm'>
              {t('{{matched}} of {{total}} endpoints', {
                matched: data?.matched.toLocaleString() ?? '—',
                total: data?.total.toLocaleString() ?? '—',
              })}
            </p>
            <p className='text-muted-foreground font-mono text-sm'>
              {t('Page {{page}} / {{pages}}', { page, pages: totalPages })}
            </p>
          </div>

          <div className='grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]'>
            <div className='min-w-0'>
              {catalogContent}

              <div className='mt-5 flex items-center justify-end gap-2 border-t pt-4'>
                <Button
                  variant='outline'
                  disabled={page === 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  <ChevronLeft />
                  {t('Previous')}
                </Button>
                <Button
                  variant='outline'
                  disabled={!canGoNext}
                  onClick={() => setPage((current) => current + 1)}
                >
                  {t('Next')}
                  <ChevronRight />
                </Button>
              </div>
            </div>

            {isDesktop && (
              <DataToolInspectorPanel
                tool={selectedTool}
                onClose={() => setSelectedTool(null)}
              />
            )}
          </div>
        </div>

        {!isDesktop && (
          <DataToolRunDialog
            tool={selectedTool}
            onClose={() => setSelectedTool(null)}
          />
        )}
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
