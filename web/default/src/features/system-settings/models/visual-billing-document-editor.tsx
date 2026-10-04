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
import { ArrowDown, GitBranch, CornerDownRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { DataTableRowActionMenu } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import type { PricingCurrency } from '@/features/model-pricing/currency'
import { formatBillingCondition } from '@/features/pricing/lib/billing-expression/condition-display'
import {
  visualConditionExpression,
  visualNodeId,
  createEmptyVisualCondition,
  type VisualBillingDocument,
  type VisualBillingIssue,
  type VisualPricingNode,
} from '@/features/pricing/lib/billing-expression/visual'

import { TierPriceFields } from './tier-price-fields'
import { VisualConditionTree } from './visual-condition-tree'

function PricingBranch(props: {
  node: VisualPricingNode
  path: string
  source: string
  currency: PricingCurrency
  issues: VisualBillingIssue[]
  onChange: (node: VisualPricingNode) => void
}) {
  const { t, i18n } = useTranslation()
  const node = props.node
  if (node.kind === 'branch') {
    const condition = visualConditionExpression(node.condition, props.source)
    const description =
      condition && formatBillingCondition(condition, t, i18n.language)
    return (
      <div className='min-w-0 space-y-3'>
        <div className='flex items-center justify-between gap-2'>
          <div className='flex items-center gap-2'>
            <GitBranch
              aria-hidden='true'
              className='text-muted-foreground size-4'
            />
            <p className='text-sm font-medium'>{t('Tier conditions')}</p>
          </div>
          <DataTableRowActionMenu
            ariaLabel={t('Branch actions {{path}}', { path: props.path })}
          >
            <DropdownMenuItem
              variant='destructive'
              onClick={() => props.onChange(node.no)}
            >
              {t('Remove branch')}
            </DropdownMenuItem>
          </DataTableRowActionMenu>
        </div>
        {description && (
          <p className='text-muted-foreground text-sm'>{description}</p>
        )}
        <VisualConditionTree
          path={props.path}
          node={node.condition}
          issues={props.issues}
          onChange={(condition) => props.onChange({ ...node, condition })}
        />
        <div className='border-border ml-3 space-y-3 border-l pl-4 sm:pl-5'>
          <div className='flex flex-wrap items-center gap-2 text-sm font-medium'>
            <ArrowDown
              aria-hidden='true'
              className='size-4 text-blue-600 dark:text-blue-400'
            />
            <span>
              {node.yes.kind === 'tier'
                ? t('When conditions match → {{name}}', {
                    name: node.yes.label,
                  })
                : t('When conditions match')}
            </span>
          </div>
          <PricingBranch
            {...props}
            node={node.yes}
            path={`${props.path}A`}
            onChange={(yes) => props.onChange({ ...node, yes })}
          />
          <div className='flex flex-wrap items-center gap-2 text-sm font-medium'>
            <CornerDownRight
              aria-hidden='true'
              className='text-muted-foreground size-4'
            />
            <span>
              {node.no.kind === 'tier'
                ? t('Otherwise → {{name}}', { name: node.no.label })
                : t('Otherwise (the preceding conditions do not match)')}
            </span>
          </div>
          <PricingBranch
            {...props}
            node={node.no}
            path={`${props.path}B`}
            onChange={(no) => props.onChange({ ...node, no })}
          />
        </div>
      </div>
    )
  }
  const issues = props.issues.filter(
    (issue) => issue.id === node.id || issue.id.startsWith(`${node.id}:`)
  )
  return (
    <div
      role='group'
      aria-label={t('Pricing tier {{name}}', { name: node.label })}
      className='bg-background min-w-0 space-y-3 rounded-xl border p-3'
    >
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='flex min-w-0 items-center gap-2'>
          <Badge variant='secondary'>{t('Tier')}</Badge>
          <Input
            aria-label={t('Tier name')}
            value={node.label}
            onChange={(event) =>
              props.onChange({ ...node, label: event.target.value })
            }
            className='w-40 max-w-full'
          />
        </div>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() =>
            props.onChange({
              id: visualNodeId(),
              kind: 'branch',
              condition: createEmptyVisualCondition(),
              yes: {
                ...node,
                id: visualNodeId(),
                origin: undefined,
                prices: node.prices.map(({ variable, value }) => ({
                  variable,
                  value,
                })),
              },
              no: node,
            })
          }
        >
          {t('Add pricing branch')}
        </Button>
      </div>
      <TierPriceFields
        currency={props.currency}
        prices={Object.fromEntries(
          node.prices.map((price) => [price.variable, price.value])
        )}
        invalidVariables={issues.map((issue) =>
          issue.id.slice(node.id.length + 1)
        )}
        onChange={(variable, value) =>
          props.onChange({
            ...node,
            prices: node.prices.map((price) =>
              price.variable === variable ? { ...price, value } : price
            ),
          })
        }
        onInclude={(variable, included) =>
          props.onChange({
            ...node,
            prices: included
              ? [...node.prices, { variable, value: '0' }]
              : node.prices.filter((price) => price.variable !== variable),
          })
        }
      />
      {issues.map((issue) => (
        <p
          role='alert'
          key={`${issue.id}:${issue.message}`}
          className='text-destructive text-xs'
        >
          {t(issue.message)}
        </p>
      ))}
    </div>
  )
}

export function VisualBillingDocumentEditor(props: {
  document: VisualBillingDocument
  currency: PricingCurrency
  issues: VisualBillingIssue[]
  onChange: (document: VisualBillingDocument) => void
}) {
  return (
    <PricingBranch
      node={props.document.root}
      path='1'
      source={props.document.source}
      currency={props.currency}
      issues={props.issues}
      onChange={(root) => props.onChange({ ...props.document, root })}
    />
  )
}
