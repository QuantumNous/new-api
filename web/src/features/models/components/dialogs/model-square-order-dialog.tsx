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
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { Reorder } from 'motion/react'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { AutoGroupOrderItem } from '@/components/auto-group-order-item'
import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { compareModelUsage } from '@/features/pricing/lib/filters'
import { updateSystemOption } from '@/features/system-settings/api'
import {
  getOptionValue,
  useSystemOptions,
} from '@/features/system-settings/hooks/use-system-options'
import type { UpdateOptionRequest } from '@/features/system-settings/types'
import {
  SEGMENTED_SWITCH_CLASS,
  SEGMENTED_SWITCH_ITEM_CLASS,
} from '@/features/task-plugins/components/plugin-kind-switch'
import { toIntlLocale } from '@/i18n/languages'
import { formatCompactNumber } from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'
import { getLobeIcon } from '@/lib/lobe-icon'
import { requireServerSuccess } from '@/lib/server-error-message'

import { getModelSquareUsage } from '../../api'
import { modelsQueryKeys } from '../../lib'
import type { ModelSquareUsage } from '../../types'

const MODE_KEY = 'model_square_setting.sort_mode'
const METRIC_KEY = 'model_square_setting.sort_metric'
const DAYS_KEY = 'model_square_setting.sort_days'
const MODELS_KEY = 'model_square_setting.sort_models'

// The saved settings; with no setting the square stays in name order.
const DEFAULT_ORDER = {
  [MODE_KEY]: 'manual',
  [METRIC_KEY]: 'tokens',
  [DAYS_KEY]: 7,
  [MODELS_KEY]: [] as string[],
}

type OrderOptions = typeof DEFAULT_ORDER

const PREVIEW_LIMIT = 10

function modelIcon(name: string, model?: ModelSquareUsage): ReactNode {
  return getLobeIcon(model?.icon || model?.vendor_icon || name, 18)
}

function ModelIconTile(props: { children: ReactNode }) {
  return (
    <span
      aria-hidden='true'
      className='bg-muted/50 flex size-8 shrink-0 items-center justify-center rounded-md'
    >
      {props.children}
    </span>
  )
}

type ModelSquareOrderDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Lets the root admin choose the Recommended order of the model square. */
export function ModelSquareOrderDialog(props: ModelSquareOrderDialogProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const queryClient = useQueryClient()
  const optionsQuery = useSystemOptions(props.open)
  const [draft, setDraft] = useState<OrderOptions | null>(null)

  const saved = getOptionValue(optionsQuery.data?.data, DEFAULT_ORDER)
  const order = draft ?? saved
  const mode = order[MODE_KEY]
  const metric = order[METRIC_KEY]
  const days = order[DAYS_KEY]
  const listed = order[MODELS_KEY]
  const usesUsage = mode !== 'manual'

  // Every square model, whichever group can see it, with its usage
  const usageQuery = useQuery({
    queryKey: modelsQueryKeys.squareUsage(days),
    queryFn: async () => requireServerSuccess(await getModelSquareUsage(days)),
    enabled: props.open,
    placeholderData: keepPreviousData,
  })
  const squareModels = useMemo(
    () => usageQuery.data?.data ?? [],
    [usageQuery.data]
  )

  const modelByName = useMemo(
    () => new Map(squareModels.map((model) => [model.model_name, model])),
    [squareModels]
  )

  const ranked = useMemo(() => {
    const pinned = mode === 'mixed' ? listed : []
    return squareModels
      .filter((model) => !pinned.includes(model.model_name))
      .map((model) => ({
        model,
        name: model.model_name,
        usage: metric === 'requests' ? model.requests : model.tokens,
      }))
      .sort(compareModelUsage)
  }, [metric, mode, listed, squareModels])
  const hasUsage = ranked.some((row) => row.usage > 0)

  const update = (changes: Partial<OrderOptions>) =>
    setDraft({ ...order, ...changes })

  const moveModel = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= listed.length) return
    const next = [...listed]
    ;[next[index], next[target]] = [next[target], next[index]]
    update({ [MODELS_KEY]: next })
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) setDraft(null)
    props.onOpenChange(open)
  }

  // One toast for the whole order, however many settings changed
  const saveOrder = useMutation({
    mutationFn: async (changes: UpdateOptionRequest[]) => {
      for (const change of changes) {
        requireServerSuccess(await updateSystemOption(change))
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing'] })
      toast.success(t('Setting updated successfully'))
      handleOpenChange(false)
    },
    onError: (error) => handleServerError(error, t('Failed to update setting')),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ['system-options'] }),
  })

  const handleSave = () => {
    const keys = Object.keys(order) as (keyof OrderOptions)[]
    saveOrder.mutate(
      keys
        .filter(
          (key) => JSON.stringify(order[key]) !== JSON.stringify(saved[key])
        )
        .map((key) => {
          const value = order[key]
          return {
            key,
            value: Array.isArray(value) ? JSON.stringify(value) : value,
          }
        })
    )
  }

  const modes = [
    { value: 'manual', label: t('Manual order') },
    { value: 'usage', label: t('Most used') },
    { value: 'mixed', label: t('Pinned + most used') },
  ]
  const periods = [
    { value: '1', label: t('Last 1 day') },
    { value: '7', label: t('Last 7 days') },
    { value: '30', label: t('Last 30 days') },
  ]
  const metricLabel = metric === 'requests' ? t('Requests') : t('Tokens')
  const addLabel = mode === 'mixed' ? t('Add pinned model') : t('Add model')
  const candidates = squareModels
    .filter((model) => !listed.includes(model.model_name))
    .map((model) => ({
      value: model.model_name,
      label: model.model_name,
      description: model.vendor_name,
      icon: modelIcon(model.model_name, model),
    }))
  const previewRows = ranked.slice(0, PREVIEW_LIMIT)
  const hiddenCount = ranked.length - previewRows.length
  const rankOffset = mode === 'mixed' ? listed.length : 0

  return (
    <Dialog
      open={props.open}
      onOpenChange={handleOpenChange}
      title={t('Model square order')}
      description={t(
        'Choose the default order of the model square. Users can still pick another sort.'
      )}
      contentClassName='sm:max-w-xl'
      footer={
        <>
          <Button variant='outline' onClick={() => handleOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              draft === null || !optionsQuery.isSuccess || saveOrder.isPending
            }
          >
            {t('Save')}
          </Button>
        </>
      }
    >
      <div className='flex flex-col gap-5'>
        <div className='flex flex-col gap-2'>
          <div className='text-sm font-medium'>{t('Sort method')}</div>
          <ToggleGroup
            value={[mode]}
            onValueChange={(values) => {
              const next = values.find((value) => value !== mode)
              if (next) update({ [MODE_KEY]: next })
            }}
            aria-label={t('Sort method')}
            spacing={1}
            className={SEGMENTED_SWITCH_CLASS}
          >
            {modes.map((item) => (
              <ToggleGroupItem
                key={item.value}
                value={item.value}
                className={SEGMENTED_SWITCH_ITEM_CLASS}
              >
                {item.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {usesUsage && (
          <div className='flex flex-wrap items-start gap-6'>
            <div className='flex flex-col gap-2'>
              <div className='text-sm font-medium'>{t('Rank by')}</div>
              <ToggleGroup
                value={[metric]}
                onValueChange={(values) => {
                  const next = values.find((value) => value !== metric)
                  if (next) update({ [METRIC_KEY]: next })
                }}
                variant='outline'
                size='sm'
                aria-label={t('Rank by')}
              >
                <ToggleGroupItem value='requests'>
                  {t('Requests')}
                </ToggleGroupItem>
                <ToggleGroupItem value='tokens'>{t('Tokens')}</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className='flex flex-col gap-2'>
              <div className='text-sm font-medium'>{t('Period')}</div>
              <Select
                items={periods}
                value={String(days)}
                onValueChange={(value) => update({ [DAYS_KEY]: Number(value) })}
              >
                <SelectTrigger
                  size='sm'
                  className='w-36'
                  aria-label={t('Period')}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    {periods.map((period) => (
                      <SelectItem key={period.value} value={period.value}>
                        {period.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {mode !== 'usage' && (
          <div className='flex flex-col gap-2'>
            <div className='flex items-baseline justify-between gap-3'>
              <div className='text-sm font-medium'>
                {mode === 'mixed' ? t('Pinned models') : t('Model order')}
              </div>
              {listed.length > 1 && (
                <div className='text-muted-foreground text-xs'>
                  {t('Drag to reorder')}
                </div>
              )}
            </div>
            {listed.length > 0 && (
              <Reorder.Group
                axis='y'
                values={listed}
                onReorder={(next: string[]) => update({ [MODELS_KEY]: next })}
                className='flex flex-col gap-2'
              >
                {listed.map((name, index) => {
                  const model = modelByName.get(name)
                  return (
                    <AutoGroupOrderItem
                      key={name}
                      group={name}
                      index={index}
                      count={listed.length}
                      leading={
                        <ModelIconTile>{modelIcon(name, model)}</ModelIconTile>
                      }
                      onMove={moveModel}
                      onRemove={(removed) =>
                        update({
                          [MODELS_KEY]: listed.filter(
                            (item) => item !== removed
                          ),
                        })
                      }
                    >
                      {model?.vendor_name && (
                        <span className='text-muted-foreground text-xs'>
                          {model.vendor_name}
                        </span>
                      )}
                    </AutoGroupOrderItem>
                  )
                })}
              </Reorder.Group>
            )}
            <Combobox
              aria-label={addLabel}
              options={candidates}
              value=''
              onValueChange={(name) => {
                if (name && !listed.includes(name)) {
                  update({ [MODELS_KEY]: [...listed, name] })
                }
              }}
              placeholder={addLabel}
              className='sm:w-72'
            />
            {mode === 'manual' && (
              <p className='text-sm'>
                {t('Models not in the list follow by name.')}
              </p>
            )}
          </div>
        )}

        {usesUsage && usageQuery.isSuccess && (
          <div className='flex flex-col gap-2'>
            <div className='flex items-baseline justify-between gap-3'>
              <div className='text-sm font-medium'>
                {mode === 'mixed' ? t('Other models') : t('Current order')}
              </div>
              {hasUsage && (
                <div className='text-muted-foreground text-xs'>
                  {metricLabel}
                </div>
              )}
            </div>
            {!hasUsage && (
              <p className='text-sm'>
                {t('No usage data, so models are ordered by name.')}
              </p>
            )}
            {hasUsage && (
              <ol
                aria-label={
                  mode === 'mixed' ? t('Other models') : t('Current order')
                }
                className='flex flex-col gap-2'
              >
                {previewRows.map((row, index) => (
                  <li
                    key={row.model.model_name}
                    className='flex min-w-0 items-center gap-2 rounded-lg border p-2'
                  >
                    <span className='text-muted-foreground w-7 shrink-0 text-center text-sm tabular-nums'>
                      {rankOffset + index + 1}
                    </span>
                    <ModelIconTile>
                      {modelIcon(row.model.model_name, row.model)}
                    </ModelIconTile>
                    <div className='flex min-w-0 flex-1 flex-wrap items-center gap-2'>
                      <span className='min-w-0 truncate text-sm font-medium'>
                        {row.model.model_name}
                      </span>
                      {row.model.vendor_name && (
                        <span className='text-muted-foreground text-xs'>
                          {row.model.vendor_name}
                        </span>
                      )}
                    </div>
                    <span className='shrink-0 pe-1 text-sm tabular-nums'>
                      {formatCompactNumber(row.usage, locale)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {hasUsage && hiddenCount > 0 && (
              <p className='text-muted-foreground text-sm'>
                {t('And {{count}} more models', { count: hiddenCount })}
              </p>
            )}
          </div>
        )}
      </div>
    </Dialog>
  )
}
