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
import { RefreshCw, Settings2, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

import { listMarketplaceSources, listTaskPlugins } from '../api'
import {
  COMMUNITY_MARKETPLACE_INDEX_URL,
  deriveInstallState,
  fetchMarketplaceIndex,
  indexHasIntegrityHashes,
  marketplaceSourceKind,
} from '../lib/marketplace'
import {
  countPluginKinds,
  defaultPluginKind,
  type PluginKind,
} from '../lib/plugin-kinds'
import { resolvePluginParts } from '../lib/plugin-parts'
import type {
  MarketplaceIndex,
  MarketplacePlugin,
  MarketplaceSource,
} from '../types'
import {
  MarketplaceInstallDialog,
  type MarketplaceInstallTarget,
} from './marketplace-install-dialog'
import { MarketplacePluginCard } from './marketplace-plugin-card'
import { MarketplaceSourcesDialog } from './marketplace-sources-dialog'
import { PluginCodeLookup, type PluginCodeMatch } from './plugin-code-lookup'
import {
  PluginKindSwitch,
  SEGMENTED_SWITCH_CLASS,
  SEGMENTED_SWITCH_ITEM_CLASS,
} from './plugin-kind-switch'

type MarketplacePanelProps = {
  /** The kind the page URL names; without one the default kind is shown. */
  kind?: PluginKind
  onKindChange: (kind: PluginKind) => void
}

const marketplacePluginParts = (plugin: MarketplacePlugin) =>
  resolvePluginParts({ ...plugin, meta: plugin })

/** Official sources, and the community list beside any third-party source. */
type MarketplaceGroup = 'official' | 'community'

export function MarketplacePanel(props: MarketplacePanelProps) {
  const { t } = useTranslation()
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [group, setGroup] = useState<MarketplaceGroup | null>(null)
  const [selectedSourceUrl, setSelectedSourceUrl] = useState('')
  const [installTarget, setInstallTarget] =
    useState<MarketplaceInstallTarget | null>(null)
  const [codeMatch, setCodeMatch] = useState<PluginCodeMatch | null>(null)

  const sourcesQuery = useQuery({
    queryKey: ['task-plugin-marketplace-sources'],
    queryFn: listMarketplaceSources,
  })
  const installedQuery = useQuery({
    queryKey: ['task-plugins'],
    queryFn: listTaskPlugins,
  })
  const sources = sourcesQuery.data ?? []
  const officialSources = sources.filter(
    (source) => marketplaceSourceKind(source.index_url) === 'official'
  )
  const communitySources = sources.filter(
    (source) => marketplaceSourceKind(source.index_url) !== 'official'
  )
  const communitySource = communitySources.find(
    (source) => marketplaceSourceKind(source.index_url) === 'community'
  )
  let activeGroup: MarketplaceGroup = group ?? 'official'
  if (!group && officialSources.length === 0 && communitySources.length > 0) {
    activeGroup = 'community'
  }
  const groupSources =
    activeGroup === 'official' ? officialSources : communitySources
  const selectedSource =
    groupSources.find((source) => source.index_url === selectedSourceUrl) ??
    groupSources[0]

  // Only the selected source is requested. Alternate sources stay idle until
  // the administrator explicitly switches to them.
  const indexQuery = useQuery({
    queryKey: ['task-plugin-marketplace', selectedSource?.index_url],
    enabled: Boolean(selectedSource),
    retry: false,
    meta: { errorToast: false },
    queryFn: (): Promise<MarketplaceIndex> => {
      if (!selectedSource) throw new Error('marketplace source is not selected')
      return fetchMarketplaceIndex(selectedSource.index_url)
    },
  })
  const indexPlugins = indexQuery.data?.plugins
  const kindCounts = useMemo(
    () => countPluginKinds((indexPlugins ?? []).map(marketplacePluginParts)),
    [indexPlugins]
  )
  const kind = props.kind ?? defaultPluginKind(kindCounts)
  const showReviewWarning =
    activeGroup === 'community' && groupSources.length > 0
  // Codes are looked up in the official indexes and on the community site.
  const canLookUpCode = officialSources.length > 0 || Boolean(communitySource)

  return (
    <>
      <div className='h-full space-y-4 overflow-y-auto'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <div className='flex min-w-0 flex-wrap items-center gap-2'>
            <ToggleGroup
              value={[activeGroup]}
              onValueChange={(value) => {
                const next = (['official', 'community'] as const).find(
                  (item) => item !== activeGroup && value.includes(item)
                )
                if (next) setGroup(next)
              }}
              aria-label={t('Marketplace')}
              spacing={1}
              className={SEGMENTED_SWITCH_CLASS}
            >
              <ToggleGroupItem
                value='official'
                className={SEGMENTED_SWITCH_ITEM_CLASS}
              >
                {t('Official plugins')}
              </ToggleGroupItem>
              <ToggleGroupItem
                value='community'
                className={SEGMENTED_SWITCH_ITEM_CLASS}
              >
                {t('Community plugins')}
              </ToggleGroupItem>
            </ToggleGroup>
            <PluginKindSwitch
              value={kind}
              counts={kindCounts}
              onValueChange={props.onKindChange}
            />
          </div>
          <div className='flex shrink-0 gap-2'>
            <Button
              variant='outline'
              size='sm'
              disabled={!selectedSource || indexQuery.isFetching}
              onClick={() => void indexQuery.refetch()}
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

        {(showReviewWarning || canLookUpCode) && (
          // One row: the community review warning on the left, the plugin code lookup on the right.
          <div className='flex flex-wrap items-start gap-x-6 gap-y-3'>
            {showReviewWarning && (
              <p className='flex items-start gap-2 py-1.5 text-sm'>
                <TriangleAlert
                  className='mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400'
                  aria-hidden='true'
                />
                {t(
                  'Community plugins are published and maintained by their authors. Check the source before you install.'
                )}
              </p>
            )}
            {canLookUpCode && (
              <div className='ml-auto'>
                <PluginCodeLookup
                  officialSources={officialSources}
                  communitySource={communitySource}
                  onResult={setCodeMatch}
                />
              </div>
            )}
          </div>
        )}

        {codeMatch && (
          <PluginCodeResult
            match={codeMatch}
            kind={kind}
            installed={installedQuery.data ?? []}
            onInstall={setInstallTarget}
            onClear={() => setCodeMatch(null)}
          />
        )}

        {!sourcesQuery.isLoading && groupSources.length === 0 && (
          <Empty className='border'>
            <EmptyHeader>
              <EmptyTitle>{t('No marketplace sources configured.')}</EmptyTitle>
              <EmptyDescription>
                {activeGroup === 'community'
                  ? t('Add this address in Manage sources:')
                  : t('Add a source to browse its plugins.')}
              </EmptyDescription>
              {activeGroup === 'community' && (
                <code className='bg-muted rounded px-2 py-1 font-mono text-xs break-all'>
                  {COMMUNITY_MARKETPLACE_INDEX_URL}
                </code>
              )}
            </EmptyHeader>
            <Button onClick={() => setSourcesOpen(true)}>
              {t('Manage sources')}
            </Button>
          </Empty>
        )}

        {groupSources.length > 1 && selectedSource && (
          <ToggleGroup
            value={[selectedSource.index_url]}
            onValueChange={(value) => {
              const nextSourceUrl = value.find(
                (item) => item !== selectedSource.index_url
              )
              if (nextSourceUrl) setSelectedSourceUrl(nextSourceUrl)
            }}
            aria-label={t('Marketplace sources')}
            spacing={1}
            className={SEGMENTED_SWITCH_CLASS}
          >
            {groupSources.map((source) => (
              <ToggleGroupItem
                key={`${source.index_url}|${source.name}`}
                value={source.index_url}
                className={SEGMENTED_SWITCH_ITEM_CLASS}
              >
                {t(source.name)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}

        {selectedSource && (
          <MarketplaceSourceSection
            key={`${selectedSource.index_url}|${selectedSource.name}`}
            source={selectedSource}
            index={indexQuery.data}
            isLoading={indexQuery.isLoading}
            error={indexQuery.error}
            installed={installedQuery.data ?? []}
            kind={kind}
            onInstall={setInstallTarget}
          />
        )}
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

type PluginCodeResultProps = {
  match: PluginCodeMatch
  kind: PluginKind
  installed: Awaited<ReturnType<typeof listTaskPlugins>>
  onInstall: (target: MarketplaceInstallTarget) => void
  onClear: () => void
}

/** The plugin a code lookup found, as a card; installing starts from its button. */
function PluginCodeResult(props: PluginCodeResultProps) {
  const { t } = useTranslation()
  const { source, plugin } = props.match
  const sourceKind = marketplaceSourceKind(source.index_url)
  const installState = deriveInstallState(plugin, props.installed)
  return (
    <section className='space-y-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <h3 className='text-sm font-semibold'>
          {t('Result for plugin code {{code}}', { code: props.match.code })}
        </h3>
        <Badge variant='secondary'>
          {sourceKind === 'official' ? t('Official') : t('Community')}
        </Badge>
        <Button
          variant='ghost'
          size='sm'
          className='ml-auto'
          onClick={props.onClear}
        >
          {t('Clear')}
        </Button>
      </div>
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3'>
        <MarketplacePluginCard
          kind={props.kind}
          plugin={plugin}
          indexUrl={source.index_url}
          installState={installState}
          installed={props.installed.find(
            (item) => item.meta.key === plugin.key
          )}
          onInstall={() =>
            props.onInstall({
              source,
              plugin,
              version: plugin.latest,
              installState,
            })
          }
        />
      </div>
    </section>
  )
}

type MarketplaceSourceSectionProps = {
  source: MarketplaceSource
  index?: MarketplaceIndex
  isLoading: boolean
  error: Error | null
  installed: Awaited<ReturnType<typeof listTaskPlugins>>
  kind: PluginKind
  onInstall: (target: MarketplaceInstallTarget) => void
}

function MarketplaceSourceSection(props: MarketplaceSourceSectionProps) {
  const { t } = useTranslation()
  const sourceKind = marketplaceSourceKind(props.source.index_url)
  const missingHashes = props.index
    ? !indexHasIntegrityHashes(props.index)
    : false
  const kindPlugins = (props.index?.plugins ?? []).filter(
    (plugin) => marketplacePluginParts(plugin)[props.kind]
  )
  // Only the built-in community list decides what is recommended.
  const recommended =
    sourceKind === 'community'
      ? kindPlugins.filter((plugin) => plugin.recommended)
      : []
  const groups = [{ title: '', plugins: kindPlugins }]
  if (recommended.length > 0 && recommended.length < kindPlugins.length) {
    groups.splice(
      0,
      1,
      { title: t('Recommended'), plugins: recommended },
      {
        title: t('More plugins'),
        plugins: kindPlugins.filter((plugin) => !plugin.recommended),
      }
    )
  }
  const renderCard = (plugin: MarketplacePlugin) => {
    const installState = deriveInstallState(plugin, props.installed)
    return (
      <MarketplacePluginCard
        key={plugin.key}
        kind={props.kind}
        plugin={plugin}
        indexUrl={props.source.index_url}
        installState={installState}
        installed={props.installed.find((item) => item.meta.key === plugin.key)}
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
  }

  return (
    <section className='space-y-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <h3 className='text-sm font-semibold'>
          {props.index?.name || props.source.name}
        </h3>
        {sourceKind === 'official' && (
          <Badge variant='secondary'>{t('Official')}</Badge>
        )}
        {sourceKind === 'community' && (
          <Badge variant='secondary'>{t('Community')}</Badge>
        )}
        {sourceKind === 'third_party' && (
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
            {t('Check the source address and try again. Details: {{message}}', {
              message: props.error.message,
            })}
          </AlertDescription>
        </Alert>
      )}

      {props.index && props.index.plugins.length === 0 && (
        <p className='text-muted-foreground text-sm'>
          {t('This source lists no plugins.')}
        </p>
      )}

      {props.index &&
        props.index.plugins.length > 0 &&
        kindPlugins.length === 0 && (
          <p className='text-muted-foreground text-sm'>
            {t('This source lists no plugins of this kind.')}
          </p>
        )}

      {kindPlugins.length > 0 &&
        groups.map((item) => (
          <div key={item.title} className='space-y-2'>
            {item.title && (
              <h4 className='text-sm font-medium'>{item.title}</h4>
            )}
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3'>
              {item.plugins.map(renderCard)}
            </div>
          </div>
        ))}
    </section>
  )
}
