import { type ColumnDef } from '@tanstack/react-table'
import { getLobeIcon } from '@/lib/lobe-icon'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DataTableColumnHeader } from '@/components/data-table/column-header'
import { StatusBadge } from '@/components/status-badge'
import { DEFAULT_TOKEN_UNIT } from '../constants'
import { parseTags } from '../lib/filters'
import { isTokenBasedModel } from '../lib/model-helpers'
import {
  formatPrice,
  formatRequestPrice,
  stripTrailingZeros,
} from '../lib/price'
import type { PricingModel, TokenUnit } from '../types'

// ----------------------------------------------------------------------------
// Pricing Table Columns
// ----------------------------------------------------------------------------

export interface PricingColumnsOptions {
  tokenUnit?: TokenUnit
  priceRate?: number
  usdExchangeRate?: number
}

/**
 * Render limited items with "and X more" indicator
 */
function renderLimitedItems(
  items: React.ReactNode[],
  maxDisplay: number = 2
): React.ReactNode {
  if (items.length === 0)
    return <span className='text-muted-foreground text-xs'>-</span>

  const displayed = items.slice(0, maxDisplay)
  const remaining = items.length - maxDisplay

  return (
    <div className='flex max-w-full items-center gap-1 overflow-x-auto'>
      {displayed}
      {remaining > 0 && (
        <StatusBadge
          label={`+${remaining}`}
          variant='neutral'
          size='sm'
          copyable={false}
          className='flex-shrink-0'
        />
      )}
    </div>
  )
}

/**
 * Generate pricing columns configuration
 */
export function getPricingColumns(
  options: PricingColumnsOptions = {}
): ColumnDef<PricingModel>[] {
  const {
    tokenUnit = DEFAULT_TOKEN_UNIT,
    priceRate = 1,
    usdExchangeRate = 1,
  } = options

  const tokenUnitLabel = tokenUnit === 'K' ? '1K' : '1M'

  return [
    // Model column (1st)
    {
      accessorKey: 'model_name',
      meta: { label: 'Model' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Model' />
      ),
      cell: ({ row }) => {
        const model = row.original
        const vendorIcon = model.vendor_icon
          ? getLobeIcon(model.vendor_icon, 14)
          : null

        return (
          <div className='flex min-w-[200px] items-center gap-2'>
            {vendorIcon}
            <StatusBadge
              label={model.model_name}
              variant='neutral'
              copyText={model.model_name}
              size='sm'
              className='font-mono'
            />
          </div>
        )
      },
      minSize: 200,
    },

    // Price column (2nd)
    {
      accessorKey: 'price',
      meta: { label: 'Price' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Price' />
      ),
      cell: ({ row }) => {
        const model = row.original
        const isTokenBased = isTokenBasedModel(model)

        if (isTokenBased) {
          const inputPrice = stripTrailingZeros(
            formatPrice(
              model,
              'input',
              tokenUnit,
              false,
              priceRate,
              usdExchangeRate
            )
          )
          const outputPrice = stripTrailingZeros(
            formatPrice(
              model,
              'output',
              tokenUnit,
              false,
              priceRate,
              usdExchangeRate
            )
          )

          return (
            <div className='flex min-w-[180px] flex-col gap-0.5'>
              <div className='font-mono text-sm font-medium tabular-nums'>
                {inputPrice} / {outputPrice}
              </div>
              <div className='text-muted-foreground text-xs'>
                per {tokenUnitLabel} tokens
              </div>
            </div>
          )
        } else {
          const price = stripTrailingZeros(
            formatRequestPrice(model, false, priceRate, usdExchangeRate)
          )

          return (
            <div className='flex min-w-[120px] flex-col gap-0.5'>
              <div className='font-mono text-sm font-medium tabular-nums'>
                {price}
              </div>
              <div className='text-muted-foreground text-xs'>per request</div>
            </div>
          )
        }
      },
      size: 180,
      enableSorting: false,
    },

    // Vendor column
    {
      accessorKey: 'vendor_name',
      meta: { label: 'Vendor' },
      header: 'Vendor',
      cell: ({ row }) => {
        const model = row.original
        const vendorIcon = model.vendor_icon
          ? getLobeIcon(model.vendor_icon, 14)
          : null

        if (!model.vendor_name) {
          return <span className='text-muted-foreground text-xs'>-</span>
        }

        return (
          <div className='flex items-center gap-1.5'>
            {vendorIcon}
            <StatusBadge
              label={model.vendor_name}
              autoColor={model.vendor_name}
              size='sm'
            />
          </div>
        )
      },
      size: 150,
      enableSorting: false,
    },

    // Tags column
    {
      accessorKey: 'tags',
      meta: { label: 'Tags' },
      header: 'Tags',
      cell: ({ row }) => {
        const model = row.original
        const tags = parseTags(model.tags)

        if (tags.length === 0) {
          return <span className='text-muted-foreground text-xs'>-</span>
        }

        const tagBadges = tags.map((tag) => (
          <StatusBadge key={tag} label={tag} autoColor={tag} size='sm' />
        ))

        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>{renderLimitedItems(tagBadges, 2)}</div>
              </TooltipTrigger>
              {tags.length > 2 && (
                <TooltipContent
                  side='top'
                  className='border-border bg-popover max-h-48 max-w-[320px] overflow-y-auto p-2'
                >
                  <div className='flex flex-wrap gap-1'>{tagBadges}</div>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        )
      },
      size: 150,
      enableSorting: false,
    },

    // Endpoints column
    {
      accessorKey: 'supported_endpoint_types',
      meta: { label: 'Endpoints' },
      header: 'Endpoints',
      cell: ({ row }) => {
        const model = row.original
        const endpoints = model.supported_endpoint_types || []

        if (endpoints.length === 0) {
          return <span className='text-muted-foreground text-xs'>-</span>
        }

        const endpointBadges = endpoints.map((ep) => (
          <StatusBadge key={ep} label={ep} autoColor={ep} size='sm' />
        ))

        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>{renderLimitedItems(endpointBadges, 2)}</div>
              </TooltipTrigger>
              {endpoints.length > 2 && (
                <TooltipContent
                  side='top'
                  className='border-border bg-popover max-h-48 max-w-[320px] overflow-y-auto p-2'
                >
                  <div className='flex flex-wrap gap-1'>{endpointBadges}</div>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        )
      },
      size: 150,
      enableSorting: false,
    },

    // Enable Groups column
    {
      accessorKey: 'enable_groups',
      meta: { label: 'Enable Groups' },
      header: 'Enable Groups',
      cell: ({ row }) => {
        const model = row.original
        const groups = model.enable_groups || []

        if (groups.length === 0) {
          return <span className='text-muted-foreground text-xs'>-</span>
        }

        const groupBadges = groups.map((g) => (
          <StatusBadge key={g} label={g} autoColor={g} size='sm' />
        ))

        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>{renderLimitedItems(groupBadges, 2)}</div>
              </TooltipTrigger>
              {groups.length > 2 && (
                <TooltipContent
                  side='top'
                  className='border-border bg-popover max-h-48 max-w-[320px] overflow-y-auto p-2'
                >
                  <div className='flex flex-wrap gap-1'>{groupBadges}</div>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        )
      },
      size: 150,
      enableSorting: false,
    },
  ]
}
