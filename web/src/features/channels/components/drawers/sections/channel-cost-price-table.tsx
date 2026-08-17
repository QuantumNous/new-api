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
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ChannelModelCost } from '@/features/channels/types'

type ChannelCostPriceTableProps = {
  prices?: Record<string, ChannelModelCost>
  onChange?: (prices: Record<string, ChannelModelCost>) => void
}

function formatRatio(value: number | undefined): string {
  if (value == null || value === 0) return ''
  return String(Number(value.toFixed(6)))
}

/**
 * Editable per-model cost price table used by the channel cost settings.
 * Models whose pricing is left empty fall back to the global model price,
 * so the entry can be kept as a placeholder without a configured value.
 */
export function ChannelCostPriceTable(props: ChannelCostPriceTableProps) {
  const { t } = useTranslation()
  const { prices, onChange } = props
  const pricesMap = prices ?? {}
  const entries = Object.entries(pricesMap)

  const [newModel, setNewModel] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newRatio, setNewRatio] = useState('')
  const [newCompletion, setNewCompletion] = useState('')

  const updateEntry = (model: string, patch: Partial<ChannelModelCost>) => {
    onChange?.({
      ...pricesMap,
      [model]: { ...pricesMap[model], ...patch },
    })
  }

  const removeEntry = (model: string) => {
    const next = { ...pricesMap }
    delete next[model]
    onChange?.(next)
  }

  const addEntry = () => {
    const model = newModel.trim()
    if (!model) return
    const price = Number(newPrice)
    const ratio = Number(newRatio)
    if (!(price > 0) && !(ratio > 0)) return
    onChange?.({
      ...pricesMap,
      [model]: {
        ...(price > 0 ? { model_price: price } : {}),
        ...(ratio > 0 ? { model_ratio: ratio } : {}),
        ...(Number(newCompletion) > 0
          ? { completion_ratio: Number(newCompletion) }
          : {}),
      },
    })
    setNewModel('')
    setNewPrice('')
    setNewRatio('')
    setNewCompletion('')
  }

  const renderPriceValue = (mc: ChannelModelCost) => {
    if (Number(mc.model_price) > 0) {
      return `$${formatRatio(mc.model_price)}`
    }
    if (Number(mc.model_ratio) > 0) {
      return formatRatio(mc.model_ratio)
    }
    return t('Fallback to global price')
  }

  const renderTypeBadge = (mc: ChannelModelCost) => {
    if (Number(mc.model_price) > 0) {
      return <Badge variant='secondary'>{t('Per Call')}</Badge>
    }
    if (Number(mc.model_ratio) > 0) {
      return <Badge variant='outline'>{t('Per Token')}</Badge>
    }
    return <Badge variant='ghost'>{t('Fallback')}</Badge>
  }

  return (
    <div className='space-y-3'>
      <div className='overflow-x-auto rounded-md border'>
        {entries.length === 0 ? (
          <div className='text-muted-foreground rounded-md border border-dashed p-3 text-center text-xs'>
            {t('No model cost prices configured. Empty entries fall back to the global model price.')}
          </div>
        ) : (
          <table className='w-full text-sm'>
            <thead>
              <tr className='bg-muted/50 text-muted-foreground border-b text-left text-xs'>
                <th className='px-3 py-2 font-medium'>{t('Model')}</th>
                <th className='px-3 py-2 font-medium'>{t('Type')}</th>
                <th className='px-3 py-2 font-medium'>{t('Price')}</th>
                <th className='px-3 py-2 font-medium'>
                  {t('Completion Ratio')}
                </th>
                <th className='px-3 py-2' />
              </tr>
            </thead>
            <tbody>
              {entries.map(([model, mc]) => (
                <tr key={model} className='border-b last:border-0'>
                  <td className='px-3 py-1.5 font-mono text-xs'>{model}</td>
                  <td className='px-3 py-1.5'>{renderTypeBadge(mc)}</td>
                  <td className='px-3 py-1.5 font-mono text-xs'>
                    {renderPriceValue(mc)}
                  </td>
                  <td className='px-3 py-1.5'>
                    <Input
                      type='number'
                      step='0.0001'
                      min='0'
                      value={formatRatio(mc.completion_ratio)}
                      onChange={(e) =>
                        updateEntry(model, {
                          completion_ratio: Number(e.target.value) || 0,
                        })
                      }
                      className='h-7 w-24 px-2 text-xs'
                      aria-label={`${model} ${t('Completion Ratio')}`}
                    />
                  </td>
                  <td className='px-3 py-1.5'>
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon'
                      className='text-muted-foreground hover:text-destructive size-7'
                      onClick={() => removeEntry(model)}
                      aria-label={t('Remove')}
                    >
                      <Trash2 className='size-3.5' />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className='border-border/60 bg-muted/10 rounded-md border p-3'>
        <p className='text-sm font-medium'>{t('Add Model Cost Price')}</p>
        <div className='mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5'>
          <Input
            value={newModel}
            onChange={(e) => setNewModel(e.target.value)}
            placeholder={t('Model name')}
            className='h-8 text-xs sm:col-span-1'
          />
          <Input
            type='number'
            step='0.0001'
            min='0'
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            placeholder={t('Price $/call')}
            className='h-8 text-xs'
          />
          <Input
            type='number'
            step='0.0001'
            min='0'
            value={newRatio}
            onChange={(e) => setNewRatio(e.target.value)}
            placeholder={t('Model Ratio')}
            className='h-8 text-xs'
          />
          <Input
            type='number'
            step='0.0001'
            min='0'
            value={newCompletion}
            onChange={(e) => setNewCompletion(e.target.value)}
            placeholder={t('Completion')}
            className='h-8 text-xs'
          />
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='h-8'
            onClick={addEntry}
            disabled={!newModel.trim()}
          >
            <Plus className='mr-1 size-3.5' />
            {t('Add')}
          </Button>
        </div>
        <p className='text-muted-foreground mt-2 text-xs'>
          {t(
            'Fill either the per-call price or the model ratio. Leave both empty to keep the global model price.'
          )}
        </p>
      </div>
    </div>
  )
}
