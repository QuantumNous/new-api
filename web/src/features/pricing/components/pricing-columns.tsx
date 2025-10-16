import { type ColumnDef } from '@tanstack/react-table'
import { getLobeIcon } from '@/lib/lobe-icon'
import { DataTableColumnHeader } from '@/components/data-table/column-header'
import { StatusBadge } from '@/components/status-badge'
import type { PricingModel } from '../api'
import { formatPrice } from '../utils/price-calculator'

type PricingColumnsProps = {
  currency: 'USD' | 'CNY'
  tokenUnit: 'M' | 'K'
  showWithRecharge: boolean
  priceRate: number
  usdExchangeRate: number
}

const getBillingTypeLabel = (quotaType: number | undefined) => {
  if (quotaType === undefined || quotaType === null) return '-'
  return quotaType === 0 ? 'Pay Per Token' : 'Pay Per Request'
}

const getBillingTypeVariant = (quotaType: number | undefined) => {
  if (quotaType === undefined || quotaType === null) return 'neutral'
  return quotaType === 0 ? 'info' : 'purple'
}

export function getPricingColumns(
  props: PricingColumnsProps
): ColumnDef<PricingModel>[] {
  const { currency, tokenUnit, showWithRecharge, priceRate, usdExchangeRate } =
    props

  return [
    {
      accessorKey: 'model_name',
      meta: { label: 'Model' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Model' />
      ),
      cell: ({ row }) => {
        const model = row.original
        return (
          <StatusBadge
            label={model.model_name || ''}
            autoColor={model.model_name || ''}
            copyText={model.model_name || ''}
            size='sm'
            className='font-medium'
          />
        )
      },
      filterFn: (row, _id, filterValue) => {
        const searchTerm = String(filterValue).toLowerCase()
        const model = row.original
        return (
          model.model_name?.toLowerCase().includes(searchTerm) ||
          model.description?.toLowerCase().includes(searchTerm) ||
          model.tags?.toLowerCase().includes(searchTerm) ||
          model.vendor_name?.toLowerCase().includes(searchTerm) ||
          false
        )
      },
    },
    {
      accessorKey: 'vendor_name',
      meta: { label: 'Vendor' },
      header: 'Vendor',
      cell: ({ row }) => {
        const model = row.original
        if (!model.vendor_name) return null

        return (
          <div className='flex items-center gap-2'>
            <div className='flex-shrink-0'>
              {getLobeIcon(model.vendor_icon || 'Layers', 20)}
            </div>
            <span>{model.vendor_name}</span>
          </div>
        )
      },
      enableSorting: false,
    },
    {
      accessorKey: 'quota_type',
      meta: { label: 'Billing Type' },
      header: 'Billing Type',
      cell: ({ row }) => {
        const quotaType = row.original.quota_type
        return (
          <StatusBadge
            label={getBillingTypeLabel(quotaType)}
            variant={getBillingTypeVariant(quotaType)}
            copyable={false}
          />
        )
      },
      filterFn: (row, id, value) => {
        return value.includes(String(row.getValue(id)))
      },
      enableSorting: false,
    },
    {
      accessorKey: 'supported_endpoint_types',
      meta: { label: 'Endpoint Type' },
      header: 'Endpoint Type',
      cell: ({ row }) => {
        const raw = row.original.supported_endpoint_types
        const types = Array.isArray(raw) ? raw : []
        if (types.length === 0) {
          return <span className='text-muted-foreground text-xs'>-</span>
        }

        return (
          <div className='flex flex-wrap gap-1'>
            {types.slice(0, 2).map((type, idx) => (
              <StatusBadge
                key={idx}
                label={type}
                variant='neutral'
                copyable={false}
              />
            ))}
            {types.length > 2 && (
              <span className='text-muted-foreground text-xs'>
                +{types.length - 2}
              </span>
            )}
          </div>
        )
      },
      enableSorting: false,
    },
    {
      id: 'input_price',
      meta: { label: 'Input Price' },
      accessorFn: (row) =>
        formatPrice(
          row,
          'input',
          currency,
          tokenUnit,
          showWithRecharge,
          priceRate,
          usdExchangeRate
        ),
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={`Input (/${tokenUnit} tokens)`}
          className='justify-end'
        />
      ),
      cell: ({ row }) => {
        const price = formatPrice(
          row.original,
          'input',
          currency,
          tokenUnit,
          showWithRecharge,
          priceRate,
          usdExchangeRate
        )
        return <div className='text-right font-mono'>{price}</div>
      },
    },
    {
      id: 'output_price',
      meta: { label: 'Output Price' },
      accessorFn: (row) =>
        formatPrice(
          row,
          'output',
          currency,
          tokenUnit,
          showWithRecharge,
          priceRate,
          usdExchangeRate
        ),
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={`Output (/${tokenUnit} tokens)`}
          className='justify-end'
        />
      ),
      cell: ({ row }) => {
        const price = formatPrice(
          row.original,
          'output',
          currency,
          tokenUnit,
          showWithRecharge,
          priceRate,
          usdExchangeRate
        )
        return <div className='text-right font-mono'>{price}</div>
      },
    },
    {
      accessorKey: 'tags',
      meta: { label: 'Tags' },
      header: 'Tags',
      cell: ({ row }) => {
        const tags = row.original.tags
        if (!tags || !tags.trim()) return null

        return (
          <div className='flex flex-wrap gap-1'>
            {tags
              .split(/[,;|\s]+/)
              .map((tag) => tag.trim())
              .filter(Boolean)
              .slice(0, 3)
              .map((tag, idx) => (
                <StatusBadge
                  key={idx}
                  label={tag}
                  autoColor={tag}
                  copyable={false}
                />
              ))}
          </div>
        )
      },
      enableSorting: false,
    },
  ]
}
