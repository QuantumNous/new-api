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
import { Undo2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { StaticDataTable } from '@/components/data-table'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { combineBillingExpr } from '@/features/pricing/lib/billing-expr'

import type { PricingSyncValues } from '../types'
import {
  getPriceChangeKind,
  hasPricingValue,
  type ModelPricingSnapshot,
  type ModelRow,
  type PriceChangeKind,
} from './model-pricing-snapshots'
import {
  getSyncExpressionPricing,
  getSyncPriceLines,
} from './upstream-ratio-sync-helpers'

type Translate = (key: string) => string

const CHANGE_LABELS = {
  added: 'Added',
  modified: 'Modified',
  deleted: 'Pending deletion',
} as const

// One readable pill for every kind, in the amber of the unsaved-changes pill.
export function PriceChangeBadge(props: { kind: PriceChangeKind }) {
  const { t } = useTranslation()
  return (
    <StatusBadge
      label={t(CHANGE_LABELS[props.kind])}
      copyable={false}
      className='shrink-0 bg-amber-500/10 px-2 text-amber-800 ring-1 ring-amber-500/25 ring-inset dark:text-amber-200'
    />
  )
}

const SYNC_FIELDS = [
  ['price', 'model_price'],
  ['ratio', 'model_ratio'],
  ['completionRatio', 'completion_ratio'],
  ['cacheRatio', 'cache_ratio'],
  ['createCacheRatio', 'create_cache_ratio'],
  ['imageRatio', 'image_ratio'],
  ['audioRatio', 'audio_ratio'],
  ['audioCompletionRatio', 'audio_completion_ratio'],
] as const

type PriceLine = { label: string; value: string }
type PriceGroup = { key: string; title?: string; lines: PriceLine[] }

// Expression tiers in the lines the upstream price sync shows. A provider's
// own expression is titled with its plugin key.
function getExpressionGroups(
  expression: string,
  t: Translate,
  provider = ''
): PriceGroup[] {
  const parsed = getSyncExpressionPricing(expression, t)
  if (!parsed || parsed.tiers.every((tier) => tier.lines.length === 0)) {
    return [
      {
        key: provider,
        title: provider || undefined,
        lines: [{ label: t('Expression pricing'), value: expression }],
      },
    ]
  }
  const groups = parsed.tiers.map((tier, index) => {
    const tierTitle =
      parsed.tiers.length > 1 ? tier.condition || tier.label : ''
    return {
      key: `${provider}:${tier.condition || tier.label || index}`,
      title: [provider, tierTitle].filter(Boolean).join(' · ') || undefined,
      lines: tier.lines,
    }
  })
  if (parsed.requestRuleExpr) {
    groups.push({
      key: `${provider}:rules`,
      title: provider || undefined,
      lines: [
        { label: t('Includes request rules'), value: parsed.requestRuleExpr },
      ],
    })
  }
  return groups
}

function getPriceGroups(
  snapshot: ModelPricingSnapshot | undefined,
  t: Translate
): PriceGroup[] {
  if (!snapshot) return []
  const groups: PriceGroup[] = []
  if (snapshot.billingMode === 'tiered_expr' && snapshot.billingExpr) {
    groups.push(
      ...getExpressionGroups(
        combineBillingExpr(
          snapshot.billingExpr,
          snapshot.requestRuleExpr ?? ''
        ),
        t
      )
    )
  } else {
    const values: PricingSyncValues = {}
    for (const [from, to] of SYNC_FIELDS) {
      if (hasPricingValue(snapshot[from])) values[to] = Number(snapshot[from])
    }
    const lines = getSyncPriceLines(values, t)
    if (lines.length > 0) groups.push({ key: '', lines })
  }
  const providers = Object.entries(snapshot.pluginBillingExpr ?? {}).sort(
    ([a], [b]) => a.localeCompare(b)
  )
  for (const [plugin, expression] of providers) {
    groups.push(...getExpressionGroups(expression, t, plugin))
  }
  return groups
}

const priceLineKey = (group: PriceGroup, line: PriceLine) =>
  `${group.key}\n${line.label}`

function getPriceLineValues(
  snapshot: ModelPricingSnapshot | undefined,
  t: Translate
) {
  return new Map(
    getPriceGroups(snapshot, t).flatMap((group) =>
      group.lines.map((line) => [priceLineKey(group, line), line.value])
    )
  )
}

/** The changed prices of a modified row as old → new, at most two. */
export function PriceChangeSummary(props: { row: ModelRow }) {
  const { t } = useTranslation()
  const before = getPriceLineValues(props.row.saved, t)
  const changes = getPriceGroups(props.row.draft, t).flatMap((group) =>
    group.lines.flatMap((line) => {
      const key = priceLineKey(group, line)
      const old = before.get(key)
      return old === line.value ? [] : [{ ...line, key, old }]
    })
  )
  if (changes.length === 0) return null
  const hidden = changes.length - 2
  // One change per line on phones, where the row actions cover the cell end.
  return (
    <ul
      aria-label={t('Unsaved price changes')}
      className='text-foreground flex min-w-0 flex-col items-start text-xs sm:flex-row sm:flex-wrap sm:gap-x-3'
    >
      {changes.slice(0, 2).map((change, index) => (
        <li key={change.key} className='max-w-full break-words'>
          {change.label}{' '}
          {change.old !== undefined && (
            <span className='tabular-nums'>{change.old} → </span>
          )}
          <span className='font-semibold tabular-nums'>{change.value}</span>
          {index === 1 && hidden > 0 && (
            <span> {t('+{{count}} more', { count: hidden })}</span>
          )}
        </li>
      ))}
    </ul>
  )
}

function PriceValues(props: {
  snapshot?: ModelPricingSnapshot
  compareTo?: ModelPricingSnapshot
}) {
  const { t } = useTranslation()
  const groups = getPriceGroups(props.snapshot, t)
  if (groups.length === 0) {
    return <span className='text-muted-foreground'>{t('Unset price')}</span>
  }
  const compared = props.compareTo
    ? getPriceLineValues(props.compareTo, t)
    : undefined
  return (
    <div className='space-y-2'>
      {groups.map((group) => (
        <div key={group.key} className='space-y-1'>
          {group.title && (
            <div className='text-muted-foreground text-xs'>{group.title}</div>
          )}
          <dl className='flex min-w-0 flex-wrap gap-x-4 gap-y-2'>
            {group.lines.map((line) => (
              <div key={line.label} className='min-w-0'>
                <dt className='text-muted-foreground text-xs leading-4'>
                  {line.label}
                </dt>
                <dd className='leading-5 font-medium break-all tabular-nums'>
                  {compared &&
                  compared.get(priceLineKey(group, line)) !== line.value ? (
                    <mark className='rounded-sm bg-amber-500/25 px-0.5 text-inherit'>
                      {line.value}
                    </mark>
                  ) : (
                    line.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  )
}

function PriceAfterSaving(props: { row: ModelRow }) {
  const { t } = useTranslation()
  if (props.row.isDraftDeleted) {
    return <span className='text-foreground'>{t('Remove saved price')}</span>
  }
  return (
    <PriceValues
      snapshot={props.row.draft}
      compareTo={props.row.isDraftNew ? undefined : props.row.saved}
    />
  )
}

/** Saved price next to the draft, shown above the editor of a changed model. */
export function PriceChangeCard(props: { row: ModelRow; onUndo: () => void }) {
  const { t } = useTranslation()
  return (
    <section
      aria-label={t('Unsaved price changes')}
      className='bg-muted/20 rounded-lg border'
    >
      <div className='flex items-center justify-between gap-3 border-b px-3 py-2'>
        <div className='flex items-center gap-2 text-sm font-medium'>
          <span
            aria-hidden='true'
            className='size-1.5 rounded-full bg-amber-500'
          />
          {t('Unsaved price changes')}
        </div>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          className='-my-1'
          onClick={props.onUndo}
        >
          <Undo2 data-icon='inline-start' />
          {t('Undo changes')}
        </Button>
      </div>
      <div className='grid gap-4 px-3 py-3 sm:grid-cols-2'>
        <div className='min-w-0 space-y-2'>
          <div className='text-muted-foreground text-xs'>
            {t('Saved price')}
          </div>
          <PriceValues snapshot={props.row.saved} />
        </div>
        <div className='min-w-0 space-y-2'>
          <div className='text-muted-foreground text-xs'>
            {t('Price after saving')}
          </div>
          <PriceAfterSaving row={props.row} />
        </div>
      </div>
    </section>
  )
}

export function PriceChangesDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  rows: ModelRow[]
  onConfirm: () => void
  isLoading?: boolean
}) {
  const { t } = useTranslation()
  return (
    <ConfirmDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Confirm price changes')}
      desc={t(
        'New prices apply to requests as soon as you save. {{count}} models change.',
        { count: props.rows.length }
      )}
      className='max-h-[min(90dvh,var(--dialog-available-height))] overflow-y-auto data-[size=default]:max-w-[calc(100%-2rem)] data-[size=default]:sm:max-w-4xl'
      confirmText={t('Confirm and save')}
      isLoading={props.isLoading}
      handleConfirm={props.onConfirm}
    >
      <ul className='max-h-[60dvh] divide-y overflow-y-auto rounded-lg border sm:hidden'>
        {props.rows.map((row) => {
          const kind = getPriceChangeKind(row)
          return (
            <li key={row.name} className='space-y-3 p-3'>
              <div className='flex min-w-0 items-center gap-2'>
                <span className='min-w-0 truncate font-medium'>{row.name}</span>
                {kind && <PriceChangeBadge kind={kind} />}
              </div>
              <div className='space-y-1'>
                <div className='text-muted-foreground text-xs'>
                  {t('Current Price')}
                </div>
                <PriceValues snapshot={row.saved} />
              </div>
              <div className='space-y-1'>
                <div className='text-muted-foreground text-xs'>
                  {t('Price after saving')}
                </div>
                <PriceAfterSaving row={row} />
              </div>
            </li>
          )
        })}
      </ul>
      <StaticDataTable
        className='hidden max-h-[60dvh] overflow-y-auto sm:block'
        tableClassName='min-w-[640px]'
        data={props.rows}
        getRowKey={(row) => row.name}
        columns={[
          {
            id: 'model',
            header: t('Model'),
            className: 'w-56',
            cellClassName: 'align-top',
            cell: (row) => {
              const kind = getPriceChangeKind(row)
              return (
                <div className='flex min-w-0 flex-col items-start gap-1.5'>
                  <span className='max-w-full truncate font-medium'>
                    {row.name}
                  </span>
                  {kind && <PriceChangeBadge kind={kind} />}
                </div>
              )
            },
          },
          {
            id: 'saved',
            header: t('Current Price'),
            cellClassName: 'align-top',
            cell: (row) => <PriceValues snapshot={row.saved} />,
          },
          {
            id: 'draft',
            header: t('Price after saving'),
            cellClassName: 'align-top',
            cell: (row) => <PriceAfterSaving row={row} />,
          },
        ]}
      />
    </ConfirmDialog>
  )
}
