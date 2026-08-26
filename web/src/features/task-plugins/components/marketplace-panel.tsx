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
import { useQueries, useQuery } from '@tanstack/react-query'
import { RefreshCw, Settings2, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'

import { listMarketplaceSources, listTaskPlugins } from '../api'
import {
  deriveInstallState,
  indexHasIntegrityHashes,
  isDefaultMarketplaceSource,
  parseMarketplaceIndex,
} from '../lib/marketplace'
import type { MarketplaceIndex, MarketplaceSource } from '../types'
import {
  MarketplaceInstallDialog,
  type MarketplaceInstallTarget,
} from './marketplace-install-dialog'
import { MarketplacePluginCard } from './marketplace-plugin-card'
import { MarketplaceSourcesDialog } from './marketplace-sources-dialog'

export function MarketplacePanel() {
  const { t } = useTranslation()
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [installTarget, setInstallTarget] =
    useState<MarketplaceInstallTarget | null>(null)

  const sourcesQuery = useQuery({
    queryKey: ['task-plugin-marketplace-sources'],
    queryFn: listMarketplaceSources,
  })
  const installedQuery = useQuery({
    queryKey: ['task-plugins'],
    queryFn: listTaskPlugins,
  })
  const sources = sourcesQuery.data ?? []

  // One query per source so a broken or offline index degrades on its own card
  // instead of blanking the panel. Every fetch happens in the browser.
  const indexQueries = useQueries({
    queries: sources.map((source) => ({
      queryKey: ['task-plugin-marketplace', source.index_url],
      retry: false,
      queryFn: async (): Promise<MarketplaceIndex> => {
        const response = await fetch(source.index_url)
        if (!response.ok) {
          throw new Error(
            t('Index request failed with HTTP {{status}}', {
              status: response.status,
            })
          )
        }
        return parseMarketplaceIndex(await response.json())
      },
    })),
  })

  return (
    <>
      <div className='h-full space-y-4 overflow-y-auto'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <p className='text-muted-foreground text-sm'>
            {t(
              'Plugin indexes are fetched by your browser. Installing runs the same review and admission pipeline as a manual upload.'
            )}
          </p>
          <div className='flex shrink-0 gap-2'>
            <Button
              variant='outline'
              size='sm'
              disabled={indexQueries.some((query) => query.isFetching)}
              onClick={() => {
                for (const query of indexQueries) void query.refetch()
              }}
            >
              <RefreshCw />
              {t('Refresh')}
            </Button>
            <Button
              variant='outline'
              size='sm'
              onClick={() => setSourcesOpen(true)}
            >
              <Settings2 />
              {t('Manage sources')}
            </Button>
          </div>
        </div>

        {sourcesQuery.isLoading && <Skeleton className='h-24 w-full' />}

        {!sourcesQuery.isLoading && sources.length === 0 && (
          <Empty className='border'>
            <EmptyHeader>
              <EmptyTitle>{t('No marketplace sources configured.')}</EmptyTitle>
              <EmptyDescription>
                {t('Add an index URL to browse installable plugins.')}
              </EmptyDescription>
            </EmptyHeader>
            <Button onClick={() => setSourcesOpen(true)}>
              {t('Manage sources')}
            </Button>
          </Empty>
        )}

        {sources.map((source, index) => (
          <MarketplaceSourceSection
            key={`${source.index_url}|${source.name}`}
            source={source}
            index={indexQueries[index]?.data}
            isLoading={indexQueries[index]?.isLoading ?? false}
            error={indexQueries[index]?.error ?? null}
            installed={installedQuery.data ?? []}
            onInstall={setInstallTarget}
          />
        ))}
      </div>

      <MarketplaceSourcesDialog
        open={sourcesOpen}
        onOpenChange={setSourcesOpen}
      />
      <MarketplaceInstallDialog
        key={`${installTarget?.plugin.key ?? ''}-${installTarget?.version ?? ''}`}
        target={installTarget}
        onOpenChange={(open) => {
          if (!open) setInstallTarget(null)
        }}
      />
    </>
  )
}

type MarketplaceSourceSectionProps = {
  source: MarketplaceSource
  index?: MarketplaceIndex
  isLoading: boolean
  error: Error | null
  installed: Awaited<ReturnType<typeof listTaskPlugins>>
  onInstall: (target: MarketplaceInstallTarget) => void
}

function MarketplaceSourceSection(props: MarketplaceSourceSectionProps) {
  const { t } = useTranslation()
  const isOfficial = isDefaultMarketplaceSource(props.source.index_url)
  const missingHashes = props.index
    ? !indexHasIntegrityHashes(props.index)
    : false

  return (
    <section className='space-y-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <h3 className='text-sm font-semibold'>
          {props.index?.name || props.source.name}
        </h3>
        {isOfficial ? (
          <Badge variant='secondary'>{t('Official')}</Badge>
        ) : (
          <Badge variant='destructive'>
            {t('Third-party — use at your own risk')}
          </Badge>
        )}
        {missingHashes && (
          <Badge variant='destructive'>
            <TriangleAlert aria-hidden='true' />
            {t('No integrity verification')}
          </Badge>
        )}
        <span className='text-muted-foreground truncate font-mono text-xs'>
          {props.source.index_url}
        </span>
      </div>

      {props.isLoading && (
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3'>
          <Skeleton className='h-40 w-full' />
          <Skeleton className='h-40 w-full' />
          <Skeleton className='h-40 w-full' />
        </div>
      )}

      {props.error && (
        <Alert variant='destructive'>
          <TriangleAlert />
          <AlertTitle>{t('Could not load this source')}</AlertTitle>
          <AlertDescription>
            {t(
              'The index could not be fetched or parsed: {{message}}. The host may block cross-origin requests.',
              { message: props.error.message }
            )}
          </AlertDescription>
        </Alert>
      )}

      {props.index && props.index.plugins.length === 0 && (
        <p className='text-muted-foreground text-sm'>
          {t('This source lists no installable task plugins.')}
        </p>
      )}

      {props.index && props.index.plugins.length > 0 && (
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3'>
          {props.index.plugins.map((plugin) => {
            const installState = deriveInstallState(plugin, props.installed)
            return (
              <MarketplacePluginCard
                key={plugin.key}
                plugin={plugin}
                installState={installState}
                installed={props.installed.find(
                  (item) => item.meta.key === plugin.key
                )}
                onInstall={() =>
                  props.onInstall({
                    source: props.source,
                    plugin,
                    version: plugin.latest,
                    installState,
                  })
                }
              />
            )
          })}
        </div>
      )}
    </section>
  )
}
