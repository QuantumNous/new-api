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
import { useTranslation } from 'react-i18next'
import { formatCurrencyUSD } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { DataToolSummary } from '../types'

type DataToolCardProps = {
  tool: DataToolSummary
  selected: boolean
  onOpen: (tool: DataToolSummary) => void
}

export function DataToolCard(props: DataToolCardProps) {
  const { t } = useTranslation()
  const price =
    props.tool.flatkey_price_usd === 0
      ? t('Free')
      : formatCurrencyUSD(props.tool.flatkey_price_usd)

  return (
    <button
      type='button'
      aria-pressed={props.selected}
      className={cn(
        'bg-card/70 hover:bg-card focus-visible:ring-ring group flex min-h-48 w-full flex-col rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:outline-none',
        props.selected && 'border-primary bg-primary/5 ring-primary/25 ring-1'
      )}
      onClick={() => props.onOpen(props.tool)}
    >
      <div className='flex w-full items-center justify-between gap-2'>
        <div className='flex min-w-0 items-center gap-2'>
          <span className='truncate text-xs font-semibold'>
            {props.tool.platform}
          </span>
          {props.tool.isNew && <Badge>{t('NEW')}</Badge>}
        </div>
        <Badge variant='outline'>MCP</Badge>
      </div>

      <p className='mt-4 line-clamp-2 font-mono text-sm leading-5 font-semibold'>
        {props.tool.id}
      </p>
      <p className='text-muted-foreground mt-2 line-clamp-2 text-sm leading-5'>
        {props.tool.description}
      </p>

      <div className='mt-auto flex w-full flex-wrap items-center gap-2 pt-4'>
        <span className='font-mono text-sm font-semibold'>{price}</span>
        {props.tool.categories.slice(0, 2).map((category) => (
          <Badge key={category} variant='secondary'>
            {category}
          </Badge>
        ))}
        {props.tool.quarantined && (
          <Badge variant='destructive'>{t('Unavailable')}</Badge>
        )}
      </div>
    </button>
  )
}
