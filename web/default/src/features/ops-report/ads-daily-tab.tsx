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
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type {
  AdsDailyCreativeRow,
  AdsDailyDay,
  AdsDailyKeywordRow,
  AdsDailyLandingRow,
  AdsDailyReport,
} from './types'

const usd = (v: number): string => `$${v.toFixed(v >= 100 ? 0 : 2)}`

const cpc = (cost: number, clicks: number): string =>
  clicks > 0 ? usd(cost / clicks) : '-'

const MATCH_LABELS: Record<string, string> = {
  EXACT: 'Exact',
  PHRASE: 'Phrase',
  BROAD: 'Broad',
}

// Landing-page thumbnail, loaded through the app's same-origin proxy
// (/api/data/ops_report_landing_thumb) so the browser never talks to the
// screenshot service directly. Fetched as a blob because <img> cannot carry
// the console's auth header, then converted to a data URL inside the query —
// plain data with no object-URL lifecycle to leak, safe under concurrent
// rendering. While the screenshot service is still generating it returns a
// GIF placeholder — keep polling until the real image lands.
function LandingThumbImg(props: { url: string; className: string }) {
  const thumbQuery = useQuery({
    queryKey: ['ops-landing-thumb', props.url],
    queryFn: async () => {
      const res = await api.get('/api/data/ops_report_landing_thumb', {
        params: { url: props.url, width: 320 },
        responseType: 'blob',
      })
      const blob = res.data as Blob
      const src = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(blob)
      })
      return {
        src,
        placeholder: blob.type.toLowerCase().startsWith('image/gif'),
      }
    },
    staleTime: Infinity,
    retry: 1,
    refetchInterval: (query) => (query.state.data?.placeholder ? 8000 : false),
  })
  if (!thumbQuery.data) {
    return <div className={`bg-muted animate-pulse ${props.className}`} />
  }
  return <img src={thumbQuery.data.src} alt='' className={props.className} />
}

// row tinting per change type, readable in light and dark themes
const CHANGE_ROW_CLASS: Record<string, string> = {
  added: 'bg-green-50 dark:bg-green-950/40',
  removed: 'bg-red-50 dark:bg-red-950/40',
  bid_changed: 'bg-amber-50 dark:bg-amber-950/40',
  status_changed: 'bg-amber-50 dark:bg-amber-950/40',
  content_changed: 'bg-amber-50 dark:bg-amber-950/40',
}

function ChangeBadge(props: { change: string }) {
  const { t } = useTranslation()
  if (!props.change) return null
  const labels: Record<string, string> = {
    added: t('Added'),
    removed: t('Removed'),
    bid_changed: t('Bid changed'),
    status_changed: t('Status changed'),
    content_changed: t('Edited'),
  }
  const variant =
    props.change === 'removed'
      ? 'destructive'
      : props.change === 'added'
        ? 'default'
        : 'secondary'
  return <Badge variant={variant}>{labels[props.change] ?? props.change}</Badge>
}

function StatusBadge(props: { status: string }) {
  if (!props.status) return null
  return (
    <Badge
      variant={props.status === 'ENABLED' ? 'outline' : 'secondary'}
      className='text-xs'
    >
      {props.status.toLowerCase()}
    </Badge>
  )
}

// Google-search-style ad preview: display URL line, headlines, descriptions,
// image assets, plus campaign/metrics footer. Days before the first content
// snapshot have metrics-only rows — those render with the ad's most recent
// snapshot content as a stand-in (marked as such), since creatives rarely
// change day to day.
function CreativeCard(props: {
  row: AdsDailyCreativeRow
  fallback?: AdsDailyCreativeRow
}) {
  const { t } = useTranslation()
  const isStandIn = !(props.row.headlines ?? []).length && !!props.fallback
  const row =
    isStandIn && props.fallback
      ? {
          ...props.fallback,
          cost_usd: props.row.cost_usd,
          clicks: props.row.clicks,
          impressions: props.row.impressions,
          conversions: props.row.conversions,
          change: props.row.change,
          status: '',
        }
      : props.row
  const finalUrl = row.final_urls?.[0] ?? ''
  let host = ''
  try {
    host = new URL(finalUrl).hostname
  } catch {
    // no valid final URL — show paths only
  }
  const displayUrl = [host, row.path1, row.path2].filter(Boolean).join('/')
  const hasContent = (row.headlines ?? []).length > 0
  return (
    <div
      className={`min-w-0 overflow-hidden rounded-md border p-3 text-sm ${CHANGE_ROW_CLASS[row.change] ?? ''}`}
    >
      <div className='flex items-center justify-between gap-2'>
        <div className='text-muted-foreground truncate text-xs'>
          <span className='text-foreground font-semibold'>Ad</span>
          {displayUrl && <> · {displayUrl}</>}
        </div>
        <div className='flex shrink-0 gap-1'>
          {isStandIn && (
            <Badge variant='outline' className='text-muted-foreground text-xs'>
              {t('Latest version')}
            </Badge>
          )}
          <ChangeBadge change={row.change} />
          <StatusBadge status={row.status} />
        </div>
      </div>
      <div className='mt-2 flex items-start gap-3'>
        {finalUrl && (
          <a
            href={finalUrl}
            target='_blank'
            rel='noreferrer'
            className='shrink-0'
            title={finalUrl}
          >
            <LandingThumbImg
              url={finalUrl}
              className='h-24 w-28 rounded border object-cover object-top transition-opacity hover:opacity-80'
            />
          </a>
        )}
        <div className='min-w-0 flex-1'>
          {hasContent ? (
            <>
              <div className='font-medium break-words text-blue-700 dark:text-blue-400'>
                {finalUrl ? (
                  <a
                    href={finalUrl}
                    target='_blank'
                    rel='noreferrer'
                    className='hover:underline'
                  >
                    {(row.headlines ?? []).slice(0, 3).join(' | ')}
                  </a>
                ) : (
                  (row.headlines ?? []).slice(0, 3).join(' | ')
                )}
              </div>
              {(row.headlines ?? []).length > 3 && (
                <div className='text-muted-foreground mt-0.5 text-xs break-words'>
                  {(row.headlines ?? []).slice(3).join(' | ')}
                </div>
              )}
              <div className='mt-1 text-xs break-words'>
                {(row.descriptions ?? []).join(' ')}
              </div>
              {(row.image_urls ?? []).length > 0 && (
                <div className='mt-2 flex flex-wrap gap-1'>
                  {(row.image_urls ?? []).map((img) => (
                    <img
                      key={img}
                      src={img}
                      alt=''
                      loading='lazy'
                      className='h-16 rounded border object-cover'
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className='text-muted-foreground text-xs'>
              {t('Creative content is captured from the first sync onward.')} (#
              {row.ad_id})
            </div>
          )}
        </div>
      </div>
      <div className='text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs'>
        <span className='truncate'>
          {row.campaign_name}
          {row.ad_group_name && ` · ${row.ad_group_name}`}
        </span>
        <span className='whitespace-nowrap'>
          {usd(row.cost_usd)} · {row.clicks} {t('clicks')} · CPC{' '}
          {cpc(row.cost_usd, row.clicks)}
        </span>
      </div>
    </div>
  )
}

function KeywordsTable(props: { rows: AdsDailyKeywordRow[] }) {
  const { t } = useTranslation()
  return (
    <div className='overflow-x-auto'>
      <Table className='text-xs [&_td]:px-2 [&_td]:py-1.5 [&_th]:px-2'>
        <TableHeader>
          <TableRow>
            <TableHead>{t('Keyword')}</TableHead>
            <TableHead>{t('Match Types')}</TableHead>
            <TableHead>{t('Status')}</TableHead>
            <TableHead className='text-right'>{t('Max CPC Bid')}</TableHead>
            <TableHead className='text-right'>{t('Clicks')}</TableHead>
            <TableHead className='text-right'>CPC</TableHead>
            <TableHead className='text-right'>{t('Ad Spend')}</TableHead>
            <TableHead className='text-right'>{t('Conversions')}</TableHead>
            <TableHead>{t('Change')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.rows.map((row) => (
            <TableRow
              key={`${row.ad_group_id}-${row.criterion_id}`}
              className={CHANGE_ROW_CLASS[row.change] ?? ''}
            >
              <TableCell className='max-w-64'>
                <div className='truncate font-medium'>{row.keyword}</div>
                <div className='text-muted-foreground truncate text-xs'>
                  {row.campaign_name}
                  {row.ad_group_name && ` · ${row.ad_group_name}`}
                </div>
              </TableCell>
              <TableCell className='whitespace-nowrap'>
                {t(MATCH_LABELS[row.match_type] ?? row.match_type)}
              </TableCell>
              <TableCell>
                <StatusBadge status={row.status} />
                {row.change === 'status_changed' && row.prev_status && (
                  <div className='text-muted-foreground text-xs line-through'>
                    {row.prev_status.toLowerCase()}
                  </div>
                )}
              </TableCell>
              <TableCell className='text-right whitespace-nowrap'>
                {row.cpc_bid_usd > 0 ? usd(row.cpc_bid_usd) : '-'}
                {row.change === 'bid_changed' && (
                  <div className='text-muted-foreground text-xs line-through'>
                    {usd(row.prev_bid_usd)}
                  </div>
                )}
              </TableCell>
              <TableCell className='text-right'>{row.clicks}</TableCell>
              <TableCell className='text-right whitespace-nowrap'>
                {cpc(row.cost_usd, row.clicks)}
              </TableCell>
              <TableCell className='text-right whitespace-nowrap'>
                {row.cost_usd > 0 ? usd(row.cost_usd) : '-'}
              </TableCell>
              <TableCell className='text-right'>
                {row.conversions > 0 ? row.conversions.toFixed(1) : '-'}
              </TableCell>
              <TableCell>
                <ChangeBadge change={row.change} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function LandingsTable(props: { rows: AdsDailyLandingRow[] }) {
  const { t } = useTranslation()
  return (
    <div className='overflow-x-auto'>
      <Table className='text-xs [&_td]:px-2 [&_td]:py-1.5 [&_th]:px-2'>
        <TableHeader>
          <TableRow>
            <TableHead>{t('Landing Pages')}</TableHead>
            <TableHead className='text-right'>{t('Clicks')}</TableHead>
            <TableHead className='text-right'>CPC</TableHead>
            <TableHead className='text-right'>{t('Ad Spend')}</TableHead>
            <TableHead className='text-right'>{t('Conversions')}</TableHead>
            <TableHead>{t('Change')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.rows.map((row) => (
            <TableRow
              key={row.url}
              className={CHANGE_ROW_CLASS[row.change] ?? ''}
            >
              <TableCell className='max-w-96'>
                <a
                  href={row.url}
                  target='_blank'
                  rel='noreferrer'
                  className='flex items-center gap-2'
                  title={row.url}
                >
                  <LandingThumbImg
                    url={row.url}
                    className='h-10 w-16 shrink-0 rounded border object-cover object-top'
                  />
                  <span className='text-primary truncate hover:underline'>
                    {row.url}
                  </span>
                </a>
              </TableCell>
              <TableCell className='text-right'>{row.clicks}</TableCell>
              <TableCell className='text-right whitespace-nowrap'>
                {cpc(row.cost_usd, row.clicks)}
              </TableCell>
              <TableCell className='text-right whitespace-nowrap'>
                {row.cost_usd > 0 ? usd(row.cost_usd) : '-'}
              </TableCell>
              <TableCell className='text-right'>
                {row.conversions > 0 ? row.conversions.toFixed(1) : '-'}
              </TableCell>
              <TableCell>
                <ChangeBadge change={row.change} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function ChangeSummaryBadges(props: { day: AdsDailyDay }) {
  const { t } = useTranslation()
  const c = props.day.changes
  const items: { key: string; label: string; destructive?: boolean }[] = []
  if (c.keywords_added > 0)
    items.push({
      key: 'ka',
      label: t('+{{count}} keywords', { count: c.keywords_added }),
    })
  if (c.keywords_removed > 0)
    items.push({
      key: 'kr',
      label: t('-{{count}} keywords', { count: c.keywords_removed }),
      destructive: true,
    })
  if (c.bid_changes > 0)
    items.push({
      key: 'bid',
      label: t('{{count}} bid changes', { count: c.bid_changes }),
    })
  if (c.status_changes > 0)
    items.push({
      key: 'st',
      label: t('{{count}} status changes', { count: c.status_changes }),
    })
  if (c.creative_changes > 0)
    items.push({
      key: 'cr',
      label: t('{{count}} creative changes', { count: c.creative_changes }),
    })
  if (c.landing_changes > 0)
    items.push({
      key: 'lp',
      label: t('{{count}} landing page changes', { count: c.landing_changes }),
    })
  if (items.length === 0) {
    return (
      <Badge variant='outline' className='text-muted-foreground'>
        {props.day.snapshot ? t('No changes') : t('Metrics only')}
      </Badge>
    )
  }
  return (
    <>
      {items.map((item) => (
        <Badge
          key={item.key}
          variant={item.destructive ? 'destructive' : 'secondary'}
        >
          {item.label}
        </Badge>
      ))}
    </>
  )
}

// DayDetail is the drill-down content rendered inside the master table when a
// day row is expanded: creatives, keywords and landing pages of that day.
function DayDetail(props: {
  day: AdsDailyDay
  contentByAdId: Map<string, AdsDailyCreativeRow>
}) {
  const { t } = useTranslation()
  const day = props.day
  return (
    <div className='space-y-4 py-2'>
      {(day.creatives ?? []).length > 0 && (
        <div>
          <h4 className='mb-2 text-sm font-medium'>{t('Creatives')}</h4>
          <div className='grid gap-2 lg:grid-cols-2'>
            {(day.creatives ?? []).map((row) => (
              <CreativeCard
                key={`${row.ad_id}-${row.change}`}
                row={row}
                fallback={props.contentByAdId.get(row.ad_id)}
              />
            ))}
          </div>
        </div>
      )}
      {(day.keywords ?? []).length > 0 && (
        <div>
          <h4 className='mb-2 text-sm font-medium'>{t('Keywords')}</h4>
          <KeywordsTable rows={day.keywords ?? []} />
        </div>
      )}
      {(day.landings ?? []).length > 0 && (
        <div>
          <h4 className='mb-2 text-sm font-medium'>{t('Landing Pages')}</h4>
          <LandingsTable rows={day.landings ?? []} />
        </div>
      )}
    </div>
  )
}

// One row per day in the master table. The keywords cell shows the count plus
// the day's top-spend keyword with its CPC so trends read without expanding.
function DayRow(props: {
  day: AdsDailyDay
  expanded: boolean
  onToggle: () => void
  contentByAdId: Map<string, AdsDailyCreativeRow>
}) {
  const { i18n } = useTranslation()
  const day = props.day
  let weekday = ''
  try {
    weekday = new Date(`${day.date}T00:00:00`).toLocaleDateString(
      i18n.language,
      { weekday: 'short' }
    )
  } catch {
    // date label only
  }
  const keywords = day.keywords ?? []
  // active = same scope as the creatives/landings counts: spent, clicked or
  // currently enabled; diff-only "removed" rows are excluded. Top keyword is
  // the day's highest spend — the backend list puts changed rows first, so
  // "first with cost" would pick the wrong one.
  const activeKeywords = keywords.filter(
    (k) =>
      k.change !== 'removed' &&
      (k.clicks > 0 || k.cost_usd > 0 || k.status === 'ENABLED')
  )
  const topKw = activeKeywords.reduce<AdsDailyKeywordRow | undefined>(
    (best, k) => (!best || k.cost_usd > best.cost_usd ? k : best),
    undefined
  )
  const creatives = day.creatives ?? []
  const activeAds = creatives.filter(
    (c) => c.clicks > 0 || c.cost_usd > 0 || c.status === 'ENABLED'
  ).length
  const landings = (day.landings ?? []).filter(
    (l) => l.clicks > 0 || l.cost_usd > 0
  ).length
  return (
    <>
      <TableRow
        onClick={props.onToggle}
        aria-expanded={props.expanded}
        className='cursor-pointer'
      >
        <TableCell className='whitespace-nowrap'>
          <span className='inline-flex items-center gap-1 font-medium'>
            {props.expanded ? (
              <ChevronDown className='size-3.5 shrink-0' aria-hidden='true' />
            ) : (
              <ChevronRight className='size-3.5 shrink-0' aria-hidden='true' />
            )}
            {day.date}
            <span className='text-muted-foreground text-xs font-normal'>
              {weekday}
            </span>
          </span>
        </TableCell>
        <TableCell className='text-right whitespace-nowrap'>
          {day.cost_usd > 0 ? usd(day.cost_usd) : '-'}
        </TableCell>
        <TableCell className='text-right'>{day.clicks || '-'}</TableCell>
        <TableCell className='text-right whitespace-nowrap'>
          {cpc(day.cost_usd, day.clicks)}
        </TableCell>
        <TableCell className='text-right'>
          {day.conversions > 0 ? day.conversions.toFixed(1) : '-'}
        </TableCell>
        <TableCell className='max-w-56'>
          {activeKeywords.length > 0 ? (
            <span className='flex items-center gap-1 whitespace-nowrap'>
              <span className='text-muted-foreground text-xs'>
                {activeKeywords.length}
              </span>
              {topKw && (
                <span className='truncate'>
                  {topKw.keyword}
                  <span className='text-muted-foreground ml-1 text-xs'>
                    {cpc(topKw.cost_usd, topKw.clicks)}
                  </span>
                </span>
              )}
            </span>
          ) : (
            '-'
          )}
        </TableCell>
        <TableCell className='text-right'>{activeAds || '-'}</TableCell>
        <TableCell className='text-right'>{landings || '-'}</TableCell>
        <TableCell>
          <span className='flex flex-wrap gap-1'>
            <ChangeSummaryBadges day={day} />
          </span>
        </TableCell>
      </TableRow>
      {props.expanded && (
        <TableRow className='hover:bg-transparent'>
          <TableCell colSpan={9} className='bg-muted/20 p-3 whitespace-normal'>
            <DayDetail day={day} contentByAdId={props.contentByAdId} />
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

export function AdsDailyTab(props: { report: AdsDailyReport }) {
  const { t } = useTranslation()
  const days = props.report.days_list ?? []
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  // latest known content per ad, used as a stand-in on pre-snapshot days
  // (days_list is newest-first, so the first hit wins)
  const contentByAdId = new Map<string, AdsDailyCreativeRow>()
  for (const day of days) {
    for (const row of day.creatives ?? []) {
      if ((row.headlines ?? []).length > 0 && !contentByAdId.has(row.ad_id)) {
        contentByAdId.set(row.ad_id, row)
      }
    }
  }
  const toggle = (date: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(date)) {
        next.delete(date)
      } else {
        next.add(date)
      }
      return next
    })
  }

  if (days.length === 0) {
    return (
      <Card>
        <CardContent className='text-muted-foreground pt-6 text-sm'>
          {props.report.configured
            ? t('No ads data yet — the first sync runs when this tab loads.')
            : t(
                'Google Ads sync is not configured (GOOGLE_ADS_* environment variables).'
              )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className='space-y-3 pt-4'>
        <p className='text-muted-foreground text-sm'>
          {t(
            'One row per day: spend, clicks, CPC and conversions, plus counts of active keywords, creatives and landing pages. Click a row to drill into that day’s creatives, keyword CPCs and landing pages. Change badges compare against the previous synced day — bid, keyword, creative and landing page adjustments are tracked from the first sync onward.'
          )}{' '}
          {props.report.last_sync_at > 0 && (
            <>
              {t('Last synced')}:{' '}
              {new Date(props.report.last_sync_at * 1000).toLocaleString()}
            </>
          )}
        </p>
        <div className='overflow-x-auto'>
          <Table className='[&_td]:border-border/60 [&_th]:border-border/70 [&_th]:bg-muted/50 [&_td]:border [&_th]:border'>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Date')}</TableHead>
                <TableHead className='text-right'>{t('Ad Spend')}</TableHead>
                <TableHead className='text-right'>{t('Clicks')}</TableHead>
                <TableHead className='text-right'>CPC</TableHead>
                <TableHead className='text-right'>{t('Conversions')}</TableHead>
                <TableHead>{t('Keywords')}</TableHead>
                <TableHead className='text-right'>{t('Creatives')}</TableHead>
                <TableHead className='text-right'>
                  {t('Landing Pages')}
                </TableHead>
                <TableHead>{t('Change')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {days.map((day) => (
                <DayRow
                  key={day.date}
                  day={day}
                  expanded={expanded.has(day.date)}
                  onToggle={() => toggle(day.date)}
                  contentByAdId={contentByAdId}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
