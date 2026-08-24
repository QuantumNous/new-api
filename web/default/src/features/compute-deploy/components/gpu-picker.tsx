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
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { GPU_OPTIONS, type GpuOption } from '../catalog'

function AvailabilityBadge(props: { availability: GpuOption['availability'] }) {
  const { t } = useTranslation()
  return props.availability === 'high' ? (
    <Badge variant='secondary' className='text-success'>
      {t('In stock')}
    </Badge>
  ) : (
    <Badge variant='secondary' className='text-warning'>
      {t('Limited')}
    </Badge>
  )
}

function SpecRow(props: { label: string; value: string }) {
  return (
    <div className='flex items-center justify-between border-b py-1.5 text-xs last:border-b-0'>
      <span className='text-muted-foreground'>{props.label}</span>
      <span className='font-medium'>{props.value}</span>
    </div>
  )
}

function GpuCard(props: {
  gpu: GpuOption
  selected: boolean
  onSelect: (gpu: GpuOption) => void
}) {
  const { t } = useTranslation()
  const { gpu, selected } = props
  return (
    <button
      type='button'
      onClick={() => props.onSelect(gpu)}
      className={cn(
        'bg-card hover:border-primary/50 relative flex flex-col rounded-lg border p-4 text-left transition',
        selected && 'border-primary ring-primary/20 ring-2'
      )}
    >
      {gpu.recommended && (
        <Badge
          variant='default'
          className='absolute -top-2.5 left-4 shadow-sm'
        >
          {t('Recommended')}
        </Badge>
      )}
      <div className='flex items-center justify-between'>
        <span className='font-semibold'>{gpu.name}</span>
        <AvailabilityBadge availability={gpu.availability} />
      </div>
      <p className='text-muted-foreground mt-0.5 mb-2 text-xs'>
        {gpu.vram} · {t(gpu.goodForKey)}
      </p>
      <SpecRow label={t('Throughput')} value={gpu.throughput} />
      <SpecRow label={t('Context')} value={gpu.context} />
      <SpecRow label={t('Cold start')} value={t(gpu.coldStartKey)} />
      <div className='mt-3 text-lg font-bold'>
        {gpu.price}
        <span className='text-muted-foreground ml-1 text-xs font-normal'>
          {t(gpu.priceUnitKey)}
        </span>
      </div>
    </button>
  )
}

export function GpuPicker(props: {
  selected: GpuOption
  onSelect: (gpu: GpuOption) => void
}) {
  return (
    <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
      {GPU_OPTIONS.map((g) => (
        <GpuCard
          key={g.id}
          gpu={g}
          selected={props.selected.id === g.id}
          onSelect={props.onSelect}
        />
      ))}
    </div>
  )
}
