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
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  COMPUTE_CATEGORIES,
  COMPUTE_MODELS,
  type ComputeCategory,
  type ComputeModel,
} from '../catalog'

function ModelCard(props: {
  model: ComputeModel
  selected: boolean
  onSelect: (model: ComputeModel) => void
}) {
  const { t } = useTranslation()
  const { model, selected } = props
  const ready = model.status === 'ready'
  return (
    <button
      type='button'
      disabled={!ready}
      onClick={() => ready && props.onSelect(model)}
      className={cn(
        'bg-card flex flex-col rounded-lg border p-4 text-left transition',
        ready
          ? 'hover:border-primary/50 hover:shadow-sm'
          : 'cursor-not-allowed opacity-60',
        selected && 'border-primary ring-primary/20 ring-2'
      )}
    >
      <div className='mb-3 flex items-start justify-between'>
        <span className='bg-muted flex size-9 items-center justify-center rounded-md text-lg'>
          {model.icon}
        </span>
        {model.recommended ? (
          <Badge variant='default'>{t('Recommended')}</Badge>
        ) : !ready ? (
          <Badge variant='secondary'>{t('Coming soon')}</Badge>
        ) : null}
      </div>
      <div className='font-semibold'>{model.name}</div>
      <p className='text-muted-foreground mt-1 mb-3 line-clamp-2 min-h-[2.5rem] text-xs'>
        {t(model.descriptionKey)}
      </p>
      <div className='mt-auto flex items-center justify-between border-t pt-2.5'>
        {ready ? (
          <span className='text-success flex items-center gap-1.5 text-xs font-medium'>
            <span className='bg-success size-1.5 rounded-full' />
            {t('Ready')}
          </span>
        ) : (
          <span className='text-muted-foreground text-xs'>{t('Soon')}</span>
        )}
        <span className='text-sm font-semibold'>
          {model.price}
          <span className='text-muted-foreground ml-0.5 text-xs font-normal'>
            {t(model.priceUnitKey)}
          </span>
        </span>
      </div>
    </button>
  )
}

export function ModelPicker(props: {
  selected: ComputeModel
  onSelect: (model: ComputeModel) => void
}) {
  const { t } = useTranslation()
  const [category, setCategory] = useState<ComputeCategory | 'all'>('all')

  const models =
    category === 'all'
      ? COMPUTE_MODELS
      : COMPUTE_MODELS.filter((m) => m.category === category)

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-wrap gap-2'>
        {COMPUTE_CATEGORIES.map((c) => (
          <button
            key={c.value}
            type='button'
            onClick={() => setCategory(c.value)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-medium transition',
              category === c.value
                ? 'bg-foreground text-background border-foreground'
                : 'bg-card text-muted-foreground hover:border-foreground/30'
            )}
          >
            {c.icon ? `${c.icon} ` : ''}
            {t(c.labelKey)}
          </button>
        ))}
      </div>
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
        {models.map((m) => (
          <ModelCard
            key={m.id}
            model={m}
            selected={props.selected.id === m.id}
            onSelect={props.onSelect}
          />
        ))}
      </div>
    </div>
  )
}
