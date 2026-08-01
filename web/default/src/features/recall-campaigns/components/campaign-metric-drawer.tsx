import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  exportRecallCampaignMetricUsers,
  getRecallCampaignMetricUsers,
} from '../api'
import { formatRecallCurrencyAmount } from '../helpers'
import type {
  RecallMetricCard,
  RecallMetricFilters,
  RecallMetricKey,
  RecallMetricRow,
} from '../types'

const METRIC_PAGE_SIZE = 50

const metricOrder: RecallMetricKey[] = [
  'candidates',
  'enrolled',
  'excluded',
  'opened_recipients',
  'observed_clicks',
  'messages_accepted',
  'messages_failed',
  'direct_conversions',
  'assisted_conversions',
  'no_coupon_conversions',
  'attributed_spend',
  'new_external_cash',
  'direct_topup',
  'balance_subscription',
  'online_subscription',
]

const metricLabels: Record<RecallMetricKey, string> = {
  candidates: 'Candidates',
  enrolled: 'Enrolled',
  excluded: 'Excluded',
  opened_recipients: 'Users who opened',
  observed_clicks: 'Observed clicks',
  messages_accepted: 'Accepted messages',
  messages_failed: 'Failed messages',
  direct_conversions: 'Direct conversions',
  assisted_conversions: 'Assisted conversions',
  no_coupon_conversions: 'No-coupon conversions',
  attributed_spend: 'Attributed spend',
  new_external_cash: 'New external cash',
  direct_topup: 'Direct top-up',
  balance_subscription: 'Balance-paid subscription',
  online_subscription: 'Online-paid subscription',
}

const grainLabels: Record<string, string> = {
  conversion: 'Conversion rows',
  identity: 'User rows',
  message: 'Message rows',
}

type DrawerFilters = Pick<
  RecallMetricFilters,
  | 'q'
  | 'stage_no'
  | 'state'
  | 'conversion_kind'
  | 'payment_category'
  | 'currency'
>

interface CampaignMetricCardSectionProps {
  campaignId: number
  metricCards?: Record<string, RecallMetricCard>
}

interface CampaignMetricDrawerProps {
  campaignId: number
  card: RecallMetricCard | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function orderedCards(
  metricCards?: Record<string, RecallMetricCard>
): RecallMetricCard[] {
  if (!metricCards) return []
  const known = metricOrder
    .map((key) => metricCards[key])
    .filter((card): card is RecallMetricCard => Boolean(card))
  const knownKeys = new Set(known.map((card) => card.key))
  const unknown = Object.values(metricCards).filter(
    (card) => !knownKeys.has(card.key)
  )
  return [...known, ...unknown]
}

function getMetricLabel(key: RecallMetricKey | string): string {
  return metricLabels[key as RecallMetricKey] ?? key
}

function displayCardValue(card: RecallMetricCard): string {
  if (card.amounts.length === 0) return String(card.total)
  return card.amounts
    .map((amount) =>
      [
        formatMetricAmount(amount.currency, amount.amount_minor),
        amount.user_count,
      ]
        .filter((value) => value !== '' && value != null)
        .join(' / ')
    )
    .filter(Boolean)
    .join(' / ')
}

function formatMetricAmount(currency: string, amountMinor: number): string {
  const formatted = formatRecallCurrencyAmount(currency, amountMinor)
  if (formatted) return formatted
  return `${currency.toUpperCase()} ${amountMinor} minor units`
}

function supported(card: RecallMetricCard, filter: string): boolean {
  return card.supported_filters[filter] === true
}

function compactFilters(filters: RecallMetricFilters): RecallMetricFilters {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== '' && value != null)
  )
}

function filtersForCard(
  card: RecallMetricCard,
  filters: DrawerFilters
): DrawerFilters {
  return compactFilters({
    q: supported(card, 'search') ? filters.q : undefined,
    stage_no: supported(card, 'stage_no') ? filters.stage_no : undefined,
    state: supported(card, 'state') ? filters.state : undefined,
    conversion_kind: supported(card, 'conversion_kind')
      ? filters.conversion_kind
      : undefined,
    payment_category: supported(card, 'payment_category')
      ? filters.payment_category
      : undefined,
    currency: supported(card, 'currency') ? filters.currency : undefined,
  }) as DrawerFilters
}

function maskEmail(email: string): string {
  const trimmed = email.trim()
  const at = trimmed.indexOf('@')
  if (at <= 1) return trimmed ? '***' : '-'
  return `${trimmed[0]}***${trimmed.slice(at)}`
}

function metricDownloadName(campaignId: number, metric: string): string {
  return `recall-campaign-${campaignId}-${metric}.csv`
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
  } finally {
    URL.revokeObjectURL(url)
  }
}

function rowColumns(card: RecallMetricCard): Array<keyof RecallMetricRow> {
  const base: Array<keyof RecallMetricRow> = [
    'user_id',
    'email',
    'occurred_at',
    'state',
  ]
  if (card.row_grain === 'message') return [...base, 'stage_no', 'failure_code']
  if (card.row_grain === 'conversion') {
    return [
      ...base,
      'conversion_kind',
      'trade_no',
      'payment_category',
      'currency',
      'amount_minor',
    ]
  }
  return base
}

function formatCell(row: RecallMetricRow, column: keyof RecallMetricRow) {
  if (column === 'email') return maskEmail(row.email)
  if (column === 'occurred_at') {
    return row.occurred_at > 0
      ? new Date(row.occurred_at * 1000).toLocaleString()
      : '-'
  }
  if (column === 'amount_minor') {
    return row.currency
      ? formatMetricAmount(row.currency, row.amount_minor)
      : '-'
  }
  return String(row[column] || '-')
}

export function CampaignMetricCardSection(
  props: CampaignMetricCardSectionProps
): React.JSX.Element {
  const { t } = useTranslation()
  const [selectedCard, setSelectedCard] = useState<RecallMetricCard | null>(
    null
  )
  const cards = orderedCards(props.metricCards)

  if (cards.length === 0) {
    return (
      <p className='text-muted-foreground text-sm'>
        {t('Campaign metric cards are not available yet.')}
      </p>
    )
  }

  return (
    <>
      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        {cards.map((card) => (
          <div
            key={card.key}
            className='hover:bg-muted/50 rounded-lg border p-3 transition-colors'
          >
            <Button
              type='button'
              variant='ghost'
              className='text-muted-foreground h-auto p-0 text-xs hover:bg-transparent'
              onClick={() => setSelectedCard({ ...card })}
            >
              {t(getMetricLabel(card.key))}
            </Button>
            <div className='text-xl font-semibold'>
              {displayCardValue(card)}
            </div>
          </div>
        ))}
      </div>
      <CampaignMetricDrawer
        key={selectedCard?.key ?? 'closed'}
        campaignId={props.campaignId}
        card={selectedCard}
        open={selectedCard !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedCard(null)
        }}
      />
    </>
  )
}

export function CampaignMetricDrawer(
  props: CampaignMetricDrawerProps
): React.JSX.Element | null {
  const { t } = useTranslation()
  const [filters, setFilters] = useState<DrawerFilters>({})
  const [cursor, setCursor] = useState('')
  const [rows, setRows] = useState<RecallMetricRow[]>([])
  const pendingCursorRef = useRef('')
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const card = props.card
  const metric = card?.key
  const activeFilters = useMemo<RecallMetricFilters>(() => {
    if (!card) return {}
    return compactFilters({
      ...filtersForCard(card, filters),
      snapshot: card.snapshot,
      cursor,
      limit: METRIC_PAGE_SIZE,
    })
  }, [card, cursor, filters])
  const query = useQuery({
    queryKey: [
      'recall-campaigns',
      props.campaignId,
      'metric-users',
      metric,
      activeFilters,
    ],
    queryFn: () =>
      getRecallCampaignMetricUsers(
        props.campaignId,
        metric as RecallMetricKey,
        activeFilters
      ),
    enabled: props.open && Boolean(metric),
  })
  const page = query.data?.data

  if (!card) return null

  const changeFilters = (
    next: DrawerFilters | ((current: DrawerFilters) => DrawerFilters)
  ) => {
    setFilters((current) => (typeof next === 'function' ? next(current) : next))
    setCursor('')
    setRows([])
    pendingCursorRef.current = ''
    setDownloadError('')
  }
  const visibleRows = cursor
    ? [...rows, ...(page?.items ?? [])]
    : (page?.items ?? [])
  const nextCursor = page?.next_cursor ?? ''

  const exportCurrent = async () => {
    if (downloading) return
    setDownloading(true)
    setDownloadError('')
    try {
      const blob = await exportRecallCampaignMetricUsers(
        props.campaignId,
        card.key,
        compactFilters({
          ...filtersForCard(card, filters),
          snapshot: card.snapshot,
        })
      )
      downloadBlob(blob, metricDownloadName(props.campaignId, card.key))
    } catch (_error) {
      setDownloadError('Unable to download metric rows.')
    } finally {
      setDownloading(false)
    }
  }

  const retryRows = () => {
    void query.refetch()
  }

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent className='w-full sm:max-w-3xl'>
        <SheetHeader>
          <SheetTitle>{t(getMetricLabel(card.key))}</SheetTitle>
          <SheetDescription>
            {t(grainLabels[card.row_grain] ?? 'Metric rows')}
          </SheetDescription>
        </SheetHeader>
        <div className='min-h-0 flex-1 space-y-4 overflow-auto px-4 pb-4'>
          <div className='rounded-lg border p-3'>
            <div className='text-muted-foreground text-xs'>
              {t('Snapshot total')}
            </div>
            <div className='text-2xl font-semibold'>
              {displayCardValue(card)}
            </div>
          </div>
          {!card.drilldown_complete || card.legacy_unidentified_count > 0 ? (
            <p role='status' className='text-muted-foreground text-sm'>
              {t('Historical excluded identities were not recorded')}{' '}
              {card.legacy_unidentified_count}
            </p>
          ) : null}
          <div className='grid gap-3 md:grid-cols-4'>
            {supported(card, 'search') ? (
              <div className='space-y-1 md:col-span-2'>
                <Label htmlFor='recall-metric-search'>{t('Search')}</Label>
                <Input
                  id='recall-metric-search'
                  value={filters.q ?? ''}
                  onChange={(event) =>
                    changeFilters((current) => ({
                      ...current,
                      q: event.target.value,
                    }))
                  }
                />
              </div>
            ) : null}
            {supported(card, 'stage_no') ? (
              <div className='space-y-1'>
                <Label htmlFor='recall-metric-stage'>{t('Stage')}</Label>
                <Input
                  id='recall-metric-stage'
                  type='number'
                  min={1}
                  value={filters.stage_no ?? ''}
                  onChange={(event) =>
                    changeFilters((current) => ({
                      ...current,
                      stage_no: event.target.value
                        ? Number(event.target.value)
                        : undefined,
                    }))
                  }
                />
              </div>
            ) : null}
            {supported(card, 'currency') ? (
              <div className='space-y-1'>
                <Label htmlFor='recall-metric-currency'>{t('Currency')}</Label>
                <Input
                  id='recall-metric-currency'
                  value={filters.currency ?? ''}
                  onChange={(event) =>
                    changeFilters((current) => ({
                      ...current,
                      currency: event.target.value,
                    }))
                  }
                />
              </div>
            ) : null}
            {supported(card, 'state') ? (
              <div className='space-y-1'>
                <Label htmlFor='recall-metric-state'>{t('State')}</Label>
                <NativeSelect
                  id='recall-metric-state'
                  value={filters.state ?? ''}
                  onChange={(event) =>
                    changeFilters((current) => ({
                      ...current,
                      state: event.target.value,
                    }))
                  }
                >
                  <NativeSelectOption value=''>{t('All')}</NativeSelectOption>
                  <NativeSelectOption value='queued'>
                    {t('queued')}
                  </NativeSelectOption>
                  <NativeSelectOption value='converted'>
                    {t('converted')}
                  </NativeSelectOption>
                  <NativeSelectOption value='suppressed'>
                    {t('suppressed')}
                  </NativeSelectOption>
                  <NativeSelectOption value='failed'>
                    {t('failed')}
                  </NativeSelectOption>
                </NativeSelect>
              </div>
            ) : null}
            {supported(card, 'conversion_kind') ? (
              <div className='space-y-1'>
                <Label htmlFor='recall-metric-conversion-kind'>
                  {t('Conversion kind')}
                </Label>
                <NativeSelect
                  id='recall-metric-conversion-kind'
                  value={filters.conversion_kind ?? ''}
                  onChange={(event) =>
                    changeFilters((current) => ({
                      ...current,
                      conversion_kind: event.target
                        .value as DrawerFilters['conversion_kind'],
                    }))
                  }
                >
                  <NativeSelectOption value=''>{t('All')}</NativeSelectOption>
                  <NativeSelectOption value='direct'>
                    {t('direct')}
                  </NativeSelectOption>
                  <NativeSelectOption value='assisted'>
                    {t('assisted')}
                  </NativeSelectOption>
                  <NativeSelectOption value='no_coupon'>
                    {t('no_coupon')}
                  </NativeSelectOption>
                </NativeSelect>
              </div>
            ) : null}
            {supported(card, 'payment_category') ? (
              <div className='space-y-1'>
                <Label htmlFor='recall-metric-payment-category'>
                  {t('Payment category')}
                </Label>
                <NativeSelect
                  id='recall-metric-payment-category'
                  value={filters.payment_category ?? ''}
                  onChange={(event) =>
                    changeFilters((current) => ({
                      ...current,
                      payment_category: event.target
                        .value as DrawerFilters['payment_category'],
                    }))
                  }
                >
                  <NativeSelectOption value=''>{t('All')}</NativeSelectOption>
                  <NativeSelectOption value='direct_topup'>
                    {t('direct_topup')}
                  </NativeSelectOption>
                  <NativeSelectOption value='balance_subscription'>
                    {t('balance_subscription')}
                  </NativeSelectOption>
                  <NativeSelectOption value='online_subscription'>
                    {t('online_subscription')}
                  </NativeSelectOption>
                  <NativeSelectOption value='unclassified'>
                    {t('unclassified')}
                  </NativeSelectOption>
                </NativeSelect>
              </div>
            ) : null}
          </div>
          <div className='flex justify-end'>
            <Button disabled={downloading} onClick={() => void exportCurrent()}>
              {downloading ? t('Downloading') : t('Download current results')}
            </Button>
          </div>
          {downloadError ? (
            <p role='alert' className='text-destructive text-sm'>
              {t(downloadError)}
            </p>
          ) : null}
          <Table>
            <TableHeader>
              <TableRow>
                {rowColumns(card).map((column) => (
                  <TableHead key={column}>{t(column)}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row) => (
                <TableRow key={`${row.row_id}:${row.message_id}`}>
                  {rowColumns(card).map((column) => (
                    <TableCell key={column}>
                      {formatCell(row, column)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {query.isLoading ? (
            <p role='status' className='text-muted-foreground text-sm'>
              {t('Loading metric rows')}
            </p>
          ) : null}
          {query.isError ? (
            <div role='alert' className='text-destructive space-y-2 text-sm'>
              <p>{t('Unable to load metric rows.')}</p>
              <Button type='button' variant='outline' onClick={retryRows}>
                {t('Retry')}
              </Button>
            </div>
          ) : null}
          {!query.isLoading && !query.isError && visibleRows.length === 0 ? (
            <p role='status' className='text-muted-foreground text-sm'>
              {t('No metric rows found.')}
            </p>
          ) : null}
          {nextCursor ? (
            <Button
              variant='outline'
              disabled={query.isFetching}
              onClick={() => {
                if (query.isFetching || pendingCursorRef.current === nextCursor)
                  return
                setRows(visibleRows)
                pendingCursorRef.current = nextCursor
                setCursor(nextCursor)
              }}
            >
              {t('Load more')}
            </Button>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
