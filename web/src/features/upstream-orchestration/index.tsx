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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  Link2,
  Pause,
  Play,
  RefreshCw,
  Route as RouteIcon,
  Unplug,
} from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ErrorState } from '@/components/error-state'
import { SectionPageLayout } from '@/components/layout'
import { LoadingState } from '@/components/loading-state'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TitledCard } from '@/components/ui/titled-card'
import { getServerErrorMessage } from '@/lib/server-error-message'

import {
  createPairingCode,
  getUpstreamMetrics,
  getUpstreamOverview,
  getUpstreamPrices,
  reconcileUpstreams,
  requestUpstreamSync,
  updateUpstreamRoute,
} from './api'
import {
  getUnroutedUpstreamGroups,
  getUpstreamGroupModels,
} from './group-routing'
import { calculateUpstreamHA } from './ha-status'
import { PolicySettingsForm } from './policy-settings-form'
import type {
  UpstreamGroup,
  UpstreamMetric,
  UpstreamRoute,
  UpstreamSource,
} from './types'

const queryKey = ['upstream-orchestration']

function formatTime(timestamp?: number) {
  if (!timestamp) return 'N/A'
  return new Date(timestamp * 1000).toLocaleString()
}

function formatNumber(value?: number, digits = 2) {
  if (value == null || !Number.isFinite(value)) return 'N/A'
  return value.toLocaleString(undefined, { maximumFractionDigits: digits })
}

function statusVariant(status: string) {
  if (['active', 'operational', 'degraded'].includes(status)) return 'default'
  if (['shadow', 'unknown', 'pending'].includes(status)) return 'secondary'
  return 'destructive'
}

function QueryContent(props: {
  children: ReactNode
  error: unknown
  hasData: boolean
  isPending: boolean
  onRetry: () => void
}) {
  if (props.isPending) return <LoadingState />
  if (props.error != null && !props.hasData) {
    return (
      <ErrorState
        description={getServerErrorMessage(props.error)}
        onRetry={props.onRetry}
      />
    )
  }
  return (
    <>
      {props.error != null ? (
        <ErrorState
          description={getServerErrorMessage(props.error)}
          onRetry={props.onRetry}
        />
      ) : null}
      {props.children}
    </>
  )
}

function SourceCard({
  source,
  nowSeconds,
}: {
  source: UpstreamSource
  nowSeconds: number
}) {
  const staleHours = source.last_snapshot_at
    ? (nowSeconds - source.last_snapshot_at) / 3600
    : Number.POSITIVE_INFINITY
  const balanceRatio =
    source.balance == null
      ? 0
      : Math.min(
          100,
          (source.balance / Math.max(source.low_balance_threshold, 1)) * 20
        )

  return (
    <TitledCard
      title={source.name || source.key}
      description={source.selected_endpoint || source.console_url}
      icon={<Activity className='size-4' />}
      action={
        <Badge variant={statusVariant(source.status)}>
          {staleHours > 5 ? 'stale' : source.status}
        </Badge>
      }
      disableHoverEffect
      className='min-w-0'
      titleClassName='text-base'
      contentClassName='space-y-3'
    >
      <div className='grid grid-cols-2 gap-3 text-sm'>
        <div>
          <div className='text-muted-foreground text-xs'>Balance</div>
          <div className='font-mono font-medium'>
            {source.balance == null
              ? 'N/A'
              : `$${formatNumber(source.balance)}`}
          </div>
        </div>
        <div>
          <div className='text-muted-foreground text-xs'>Last snapshot</div>
          <div className='truncate font-mono text-xs'>
            {formatTime(source.last_snapshot_at)}
          </div>
        </div>
      </div>
      <Progress value={balanceRatio} aria-label='Balance level' />
      {source.last_error ? (
        <div className='text-destructive line-clamp-2 text-xs'>
          {source.last_error}
        </div>
      ) : null}
    </TitledCard>
  )
}

function RouteTable({
  routes,
  sources,
  groups,
  onAction,
  busy,
}: {
  routes: UpstreamRoute[]
  sources: UpstreamSource[]
  groups: UpstreamGroup[]
  onAction: (
    routeId: number,
    action: 'probe' | 'pause' | 'resume' | 'detach'
  ) => void
  busy: boolean
}) {
  const sourceMap = useMemo(
    () => new Map(sources.map((source) => [source.id, source])),
    [sources]
  )
  const groupMap = useMemo(
    () =>
      new Map(
        groups.map((group) => [
          `${group.source_id}:${group.external_id}`,
          group,
        ])
      ),
    [groups]
  )

  return (
    <div className='overflow-x-auto rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rank</TableHead>
            <TableHead>Source / group</TableHead>
            <TableHead>Protocol</TableHead>
            <TableHead>Channel</TableHead>
            <TableHead>Multiplier</TableHead>
            <TableHead>Health</TableHead>
            <TableHead>Latency</TableHead>
            <TableHead className='text-right'>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {routes.map((route) => {
            const source = sourceMap.get(route.source_id)
            const group = groupMap.get(
              `${route.source_id}:${route.external_group_id}`
            )
            return (
              <TableRow key={route.id}>
                <TableCell className='font-mono'>{route.rank || '-'}</TableCell>
                <TableCell className='max-w-64'>
                  <div className='truncate font-medium'>
                    {source?.name || source?.key || route.source_id}
                  </div>
                  <div className='text-muted-foreground truncate text-xs'>
                    {group?.name || route.external_group_id}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant='outline'>{route.protocol}</Badge>
                </TableCell>
                <TableCell className='font-mono'>#{route.channel_id}</TableCell>
                <TableCell className='font-mono'>
                  {formatNumber(route.effective_multiplier, 4)}x
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(route.state)}>
                    {route.state}
                  </Badge>
                  {route.consecutive_failures > 0 ? (
                    <span className='text-muted-foreground ml-2 text-xs'>
                      {route.consecutive_failures}/2
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className='font-mono'>
                  {formatNumber(group?.latency_ms, 0)} ms
                </TableCell>
                <TableCell>
                  <div className='flex justify-end gap-1'>
                    <Button
                      size='icon'
                      variant='ghost'
                      title='Probe'
                      disabled={busy}
                      onClick={() => onAction(route.id, 'probe')}
                    >
                      <Activity />
                    </Button>
                    {route.state === 'manual_pause' ? (
                      <Button
                        size='icon'
                        variant='ghost'
                        title='Resume'
                        disabled={busy}
                        onClick={() => onAction(route.id, 'resume')}
                      >
                        <Play />
                      </Button>
                    ) : (
                      <Button
                        size='icon'
                        variant='ghost'
                        title='Pause for 24 hours'
                        disabled={busy}
                        onClick={() => onAction(route.id, 'pause')}
                      >
                        <Pause />
                      </Button>
                    )}
                    <Button
                      size='icon'
                      variant='ghost'
                      title='Detach'
                      disabled={busy}
                      onClick={() => onAction(route.id, 'detach')}
                    >
                      <Unplug />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
          {routes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className='h-24 text-center'>
                No managed routes
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  )
}

function UnroutedGroupsTable({
  groups,
  sources,
}: {
  groups: UpstreamGroup[]
  sources: UpstreamSource[]
}) {
  const { t } = useTranslation()
  const sourceMap = useMemo(
    () => new Map(sources.map((source) => [source.id, source])),
    [sources]
  )

  return (
    <TitledCard
      title={t('Unrouted groups')}
      description={t('Groups without an active attached route')}
      disableHoverEffect
      titleClassName='text-base'
      contentClassName='p-0 sm:p-0'
    >
      <div className='overflow-x-auto'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Source / group')}</TableHead>
              <TableHead>{t('Health')}</TableHead>
              <TableHead>{t('Models')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((group) => {
              const source = sourceMap.get(group.source_id)
              const models = getUpstreamGroupModels(group)
              return (
                <TableRow key={group.id}>
                  <TableCell className='max-w-72'>
                    <div className='truncate font-medium'>
                      {source?.name || source?.key || group.source_id} /{' '}
                      {group.name}
                    </div>
                    <div className='text-muted-foreground truncate font-mono text-xs'>
                      {source?.key || group.source_id} / {group.external_id}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(group.health_status)}>
                      {group.health_status}
                    </Badge>
                  </TableCell>
                  <TableCell className='max-w-96 text-sm break-words'>
                    {models.length > 0
                      ? models.join(', ')
                      : t('No models reported')}
                  </TableCell>
                </TableRow>
              )
            })}
            {groups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className='h-20 text-center'>
                  {t('All discovered groups are routed')}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </TitledCard>
  )
}

function UsageTable({
  metrics,
  sources,
}: {
  metrics: UpstreamMetric[]
  sources: UpstreamSource[]
}) {
  const sourceMap = new Map(sources.map((source) => [source.id, source.name]))
  return (
    <div className='overflow-x-auto rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Source</TableHead>
            <TableHead>Group</TableHead>
            <TableHead>Tokens</TableHead>
            <TableHead>5h</TableHead>
            <TableHead>7d</TableHead>
            <TableHead>30d</TableHead>
            <TableHead>Balance</TableHead>
            <TableHead>Quality</TableHead>
            <TableHead>Observed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {metrics.map((metric) => (
            <TableRow key={metric.id}>
              <TableCell>
                {sourceMap.get(metric.source_id) || metric.source_id}
              </TableCell>
              <TableCell className='max-w-52 truncate'>
                {metric.external_group_id || '-'}
              </TableCell>
              <TableCell className='font-mono'>
                {formatNumber(metric.total_tokens, 0)}
              </TableCell>
              <TableCell className='font-mono'>
                {formatNumber(metric.usage_5h)} /{' '}
                {formatNumber(metric.limit_5h)}
              </TableCell>
              <TableCell className='font-mono'>
                {formatNumber(metric.usage_7d)} /{' '}
                {formatNumber(metric.limit_7d)}
              </TableCell>
              <TableCell className='font-mono'>
                {formatNumber(metric.usage_30d)} /{' '}
                {formatNumber(metric.limit_30d)}
              </TableCell>
              <TableCell className='font-mono'>
                {metric.balance == null
                  ? 'N/A'
                  : `$${formatNumber(metric.balance)}`}
              </TableCell>
              <TableCell>
                <Badge variant='outline'>{metric.data_quality}</Badge>
              </TableCell>
              <TableCell className='text-xs whitespace-nowrap'>
                {formatTime(metric.observed_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function UpstreamOrchestration() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [pairingCode, setPairingCode] = useState<string>()
  const overviewQuery = useQuery({
    queryKey,
    queryFn: getUpstreamOverview,
    refetchInterval: 30_000,
  })
  const metricsQuery = useQuery({
    queryKey: [...queryKey, 'metrics'],
    queryFn: getUpstreamMetrics,
    refetchInterval: 60_000,
  })
  const pricesQuery = useQuery({
    queryKey: [...queryKey, 'prices'],
    queryFn: getUpstreamPrices,
    refetchInterval: 60_000,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey })
  const haStatus = useMemo(
    () => calculateUpstreamHA(overviewQuery.data?.routes ?? []),
    [overviewQuery.data?.routes]
  )
  const unroutedGroups = useMemo(
    () =>
      getUnroutedUpstreamGroups(
        overviewQuery.data?.groups ?? [],
        overviewQuery.data?.routes ?? []
      ),
    [overviewQuery.data?.groups, overviewQuery.data?.routes]
  )
  const operation = useMutation({
    mutationFn: async (action: string) => {
      if (action === 'sync') return requestUpstreamSync()
      if (action === 'reconcile') return reconcileUpstreams()
      if (action === 'pair') return createPairingCode()
      const [routeId, routeAction] = action.split(':')
      return updateUpstreamRoute(
        Number(routeId),
        routeAction as 'probe' | 'pause' | 'resume' | 'detach'
      )
    },
    onSuccess: (data, action) => {
      if (action === 'pair' && data && 'pairing_code' in data) {
        setPairingCode(String(data.pairing_code))
      }
      toast.success(t('Operation submitted'))
      refresh()
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : String(error)),
  })
  const overview = overviewQuery.data

  return (
    <SectionPageLayout stackActionsOnMobile>
      <SectionPageLayout.Title>
        <span className='inline-flex min-w-0 items-center gap-2'>
          <span className='truncate'>{t('Upstream Orchestration')}</span>
          <Badge variant='outline'>Root</Badge>
        </span>
      </SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Button
          variant='outline'
          size='sm'
          disabled={operation.isPending}
          onClick={() => operation.mutate('pair')}
        >
          <Link2 />
          {t('Pair Chrome')}
        </Button>
        <Button
          variant='outline'
          size='sm'
          disabled={operation.isPending}
          onClick={() => operation.mutate('sync')}
        >
          <RefreshCw />
          {t('Sync')}
        </Button>
        <Button
          size='sm'
          disabled={operation.isPending}
          onClick={() => operation.mutate('reconcile')}
        >
          <RouteIcon />
          {t('Reconcile')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <QueryContent
          error={overviewQuery.error}
          hasData={overviewQuery.data !== undefined}
          isPending={overviewQuery.isPending}
          onRetry={() => void overviewQuery.refetch()}
        >
          <div className='space-y-4'>
            {pairingCode ? (
              <div className='bg-muted flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2'>
                <span className='text-sm font-medium'>
                  {t('Chrome pairing code')}
                </span>
                <code className='text-sm break-all select-all'>
                  {pairingCode}
                </code>
                <Button
                  size='sm'
                  variant='ghost'
                  onClick={() => navigator.clipboard.writeText(pairingCode)}
                >
                  {t('Copy')}
                </Button>
              </div>
            ) : null}
            {overview && !overview.bark_configured ? (
              <div className='border-destructive/40 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm'>
                {t('Root Bark notification is not configured')}
              </div>
            ) : null}
            {!haStatus.authoritative ? (
              <Alert variant='destructive'>
                <AlertTitle>HA</AlertTitle>
                <AlertDescription>
                  {t('Information unavailable')}
                </AlertDescription>
              </Alert>
            ) : null}
            {haStatus.nonHaModels.length > 0 ? (
              <div className='rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm'>
                <Badge variant='outline' className='mr-2'>
                  NON_HA
                </Badge>
                <span className='break-words'>
                  {haStatus.nonHaModels.join(', ')}
                </span>
              </div>
            ) : null}

            <div className='grid gap-3 lg:grid-cols-3'>
              {(overview?.sources ?? []).map((source) => (
                <SourceCard
                  key={source.id}
                  source={source}
                  nowSeconds={Math.floor(overviewQuery.dataUpdatedAt / 1000)}
                />
              ))}
            </div>

            <Tabs defaultValue='routes'>
              <TabsList>
                <TabsTrigger value='routes'>{t('Routes')}</TabsTrigger>
                <TabsTrigger value='usage'>{t('Usage')}</TabsTrigger>
                <TabsTrigger value='prices'>{t('Prices')}</TabsTrigger>
                <TabsTrigger value='automation'>{t('Automation')}</TabsTrigger>
              </TabsList>
              <TabsContent value='routes' className='pt-3'>
                <div className='flex flex-col gap-3'>
                  <RouteTable
                    routes={overview?.routes ?? []}
                    sources={overview?.sources ?? []}
                    groups={overview?.groups ?? []}
                    busy={operation.isPending}
                    onAction={(routeId, action) =>
                      operation.mutate(`${routeId}:${action}`)
                    }
                  />
                  <UnroutedGroupsTable
                    groups={unroutedGroups}
                    sources={overview?.sources ?? []}
                  />
                </div>
              </TabsContent>
              <TabsContent value='usage' className='pt-3'>
                <QueryContent
                  error={metricsQuery.error}
                  hasData={metricsQuery.data !== undefined}
                  isPending={metricsQuery.isPending}
                  onRetry={() => void metricsQuery.refetch()}
                >
                  <UsageTable
                    metrics={metricsQuery.data ?? []}
                    sources={overview?.sources ?? []}
                  />
                </QueryContent>
              </TabsContent>
              <TabsContent value='prices' className='pt-3'>
                <QueryContent
                  error={pricesQuery.error}
                  hasData={pricesQuery.data !== undefined}
                  isPending={pricesQuery.isPending}
                  onRetry={() => void pricesQuery.refetch()}
                >
                  <div className='overflow-x-auto rounded-md border'>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Vendor</TableHead>
                          <TableHead>Model</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Evidence SHA-256</TableHead>
                          <TableHead>Captured</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(pricesQuery.data ?? []).map((price) => (
                          <TableRow key={price.id}>
                            <TableCell>{price.vendor}</TableCell>
                            <TableCell className='font-mono'>
                              {price.model_name}
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusVariant(price.status)}>
                                {price.status}
                              </Badge>
                            </TableCell>
                            <TableCell className='max-w-80 truncate font-mono text-xs'>
                              {price.evidence_hash}
                            </TableCell>
                            <TableCell className='text-xs whitespace-nowrap'>
                              {formatTime(price.captured_at)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </QueryContent>
              </TabsContent>
              <TabsContent value='automation' className='pt-3'>
                <div className='grid gap-3 lg:grid-cols-2'>
                  <TitledCard
                    title={t('Sync devices')}
                    icon={<Link2 className='size-4' />}
                    disableHoverEffect
                    titleClassName='text-base'
                  >
                    <div className='space-y-2'>
                      {(overview?.devices ?? []).map((device) => (
                        <div
                          key={device.device_id}
                          className='flex items-center justify-between gap-3 border-b py-2 last:border-0'
                        >
                          <div className='min-w-0'>
                            <div className='truncate text-sm font-medium'>
                              {device.name}
                            </div>
                            <div className='text-muted-foreground text-xs'>
                              {formatTime(device.last_seen_at)}
                            </div>
                          </div>
                          <Badge variant={statusVariant(device.status)}>
                            {device.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </TitledCard>
                  {overview ? (
                    <PolicySettingsForm
                      settings={overview.settings}
                      onSaved={refresh}
                    />
                  ) : null}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </QueryContent>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
