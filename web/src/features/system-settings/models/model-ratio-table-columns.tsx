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
import type { ColumnDef } from '@tanstack/react-table'
import { Undo2 } from 'lucide-react'

import { DataTableColumnHeader } from '@/components/data-table/core/column-header'
import { StaticRowActions } from '@/components/data-table/static/static-row-actions'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

import {
  getModeLabel,
  getPriceChangeKind,
  getPriceDetail,
  getPriceSummary,
  type ModelRow,
} from './model-pricing-snapshots'
import { PriceChangeBadge, PriceChangeSummary } from './price-change-diff'
import { PRICING_ISSUE_REASONS, type ModelPricingIssue } from './pricing-issues'

export const TASK_PRICING_MODE_FILTER = 'tiered_expr_task'
export const PRICE_ATTENTION_FILTER = 'needs-attention'

const filterBySelectedValues = (
  rowValue: unknown,
  filterValue: unknown
): boolean => {
  if (!Array.isArray(filterValue) || filterValue.length === 0) return true
  return filterValue.includes(String(rowValue))
}

type BuildModelRatioColumnsOptions = {
  onDelete: (name: string) => void
  /** Puts a pending deletion's saved price back into the draft. */
  onRestore: (name: string) => void
  onEdit: (model: ModelRow) => void
  deleteDisabled?: boolean
  taskModelNames?: Set<string>
  /** Task model prices the gateway reports a plugin cannot charge, by model. */
  pricingIssues?: Map<string, ModelPricingIssue[]>
  t: (key: string, options?: Record<string, unknown>) => string
}

export function buildModelRatioColumns({
  onDelete,
  onRestore,
  onEdit,
  deleteDisabled,
  taskModelNames,
  pricingIssues,
  t,
}: BuildModelRatioColumnsOptions): ColumnDef<ModelRow>[] {
  return [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label={t('Select all')}
          className='translate-y-[2px]'
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label={t('Select row')}
          className='translate-y-[2px]'
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Model name')} />
      ),
      cell: ({ row }) => {
        const issues = pricingIssues?.get(row.original.name)
        const isTaskModel = Boolean(taskModelNames?.has(row.original.name))
        const hasConfiguredTaskPricing =
          row.original.billingMode === 'tiered_expr' &&
          Boolean(row.original.billingExpr)
        // A price that needs attention must not look configured.
        const showTaskPricingBadge =
          !issues && isTaskModel && hasConfiguredTaskPricing
        const showTieredBadge =
          !issues && row.original.billingMode === 'tiered_expr' && !isTaskModel
        const issueText = issues
          ?.map((issue) =>
            t('{{name}}: {{reason}}', {
              name: issue.plugin_name,
              reason: t(PRICING_ISSUE_REASONS[issue.reason]),
            })
          )
          .join(' · ')
        const changeKind = getPriceChangeKind(row.original)

        return (
          <div className='flex min-w-0 flex-col gap-0.5'>
            <div className='flex min-w-0 items-center gap-2 font-medium'>
              <span
                className={cn(
                  'min-w-0 truncate',
                  row.original.isDraftDeleted && 'line-through'
                )}
              >
                {row.getValue('name')}
              </span>
              {changeKind && <PriceChangeBadge kind={changeKind} />}
              {showTieredBadge && !row.original.isDraftDeleted ? (
                <StatusBadge
                  label={t('Tiered')}
                  copyable={false}
                  className='bg-muted text-foreground shrink-0 px-2 font-normal'
                />
              ) : null}
              {showTaskPricingBadge && !row.original.isDraftDeleted ? (
                <StatusBadge
                  label={t('Task pricing')}
                  copyable={false}
                  className='bg-muted text-foreground shrink-0 px-2 font-normal'
                />
              ) : null}
              {row.original.hasConflict && (
                <StatusBadge
                  label={t('Conflict')}
                  variant='danger'
                  copyable={false}
                  className='shrink-0'
                />
              )}
              {issues ? (
                <StatusBadge
                  label={t('Price needs attention')}
                  variant='warning'
                  copyable={false}
                  className='shrink-0'
                />
              ) : null}
            </div>
            {changeKind === 'modified' ? (
              <PriceChangeSummary row={row.original} />
            ) : null}
            {issueText ? (
              <span
                className='text-muted-foreground truncate text-xs'
                title={issueText}
              >
                {issueText}
              </span>
            ) : null}
          </div>
        )
      },
      // The only option is PRICE_ATTENTION_FILTER.
      filterFn: (row) => Boolean(pricingIssues?.has(row.original.name)),
      enableHiding: false,
    },
    {
      accessorKey: 'billingMode',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Mode')} />
      ),
      cell: ({ row }) => (
        <span className='text-foreground block truncate'>
          {t(getModeLabel(row.original.billingMode))}
        </span>
      ),
      filterFn: (row, id, value) => {
        if (filterBySelectedValues(row.getValue(id), value)) return true
        if (
          !Array.isArray(value) ||
          !value.includes(TASK_PRICING_MODE_FILTER)
        ) {
          return false
        }
        return (
          Boolean(taskModelNames?.has(row.original.name)) &&
          row.original.billingMode === 'tiered_expr' &&
          Boolean(row.original.billingExpr)
        )
      },
      meta: { label: t('Mode') },
    },
    {
      id: 'priceSummary',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Price summary')} />
      ),
      cell: ({ row }) => (
        <div
          className={cn(
            'flex min-w-0 flex-col gap-1',
            row.original.isDraftDeleted && 'line-through'
          )}
        >
          <span className='truncate font-medium'>
            {getPriceSummary(row.original, t)}
          </span>
          <span className='text-muted-foreground truncate text-xs'>
            {getPriceDetail(row.original, t)}
          </span>
        </div>
      ),
      sortingFn: (rowA, rowB) =>
        getPriceSummary(rowA.original, t).localeCompare(
          getPriceSummary(rowB.original, t)
        ),
      meta: { label: t('Price summary') },
    },
    {
      id: 'actions',
      header: () => <div>{t('Actions')}</div>,
      cell: ({ row }) => {
        if (row.original.isDraftDeleted) {
          return (
            <div className='flex justify-end'>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => onRestore(row.original.name)}
              >
                <Undo2 data-icon='inline-start' />
                {t('Undo')}
              </Button>
            </div>
          )
        }
        return (
          <StaticRowActions
            editLabel={t('Edit')}
            deleteLabel={t('Delete')}
            menuLabel={t('Open menu')}
            onEdit={() => onEdit(row.original)}
            // Only a saved price can be removed; an unpriced row has none.
            onDelete={
              row.original.saved ? () => onDelete(row.original.name) : undefined
            }
            deleteDisabled={deleteDisabled}
          />
        )
      },
      enableHiding: false,
    },
  ]
}
