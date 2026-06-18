import { useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Edit3, Save, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GroupBadge } from '@/components/group-badge'
import {
  updateModelGroupPricing,
  updateModelGroupPricingByName,
  updateModelPricing,
  updateModelPricingByName,
  type UpdateModelPricingPayload,
} from '@/features/models/api'
import { combineBillingExpr } from '@/features/pricing/lib/billing-expr'
import {
  ModelPricingEditorPanel,
  type ModelPricingEditorPanelHandle,
  type ModelRatioData,
} from '@/features/system-settings/models/model-pricing-sheet'
import { getAvailableGroups, isTokenBasedModel } from '../lib/model-helpers'
import { getEffectiveGroupRatio } from '../lib/price'
import type {
  ModelGroupPricingItem,
  ModelGroupPricingOverride,
  PricingModel,
} from '../types'

type ModelPricingAdminPanelProps = {
  model: PricingModel
  groupRatio: Record<string, number>
  usableGroup: Record<string, { desc: string; ratio: number }>
  onSaved?: () => void
}

function formatDraft(value: number | null | undefined): string {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return ''
  }
  return Number(value).toString()
}

function ratioToPrice(ratio: number | null | undefined): string {
  if (
    ratio === null ||
    ratio === undefined ||
    !Number.isFinite(Number(ratio))
  ) {
    return ''
  }
  return formatDraft(Number(ratio) * 2)
}

function ratioToLanePrice(
  baseRatio: number | null | undefined,
  laneRatio: number | null | undefined
): string {
  if (
    baseRatio === null ||
    baseRatio === undefined ||
    laneRatio === null ||
    laneRatio === undefined
  ) {
    return ''
  }
  const basePrice = Number(baseRatio) * 2
  if (!Number.isFinite(basePrice) || !Number.isFinite(Number(laneRatio))) {
    return ''
  }
  return formatDraft(basePrice * Number(laneRatio))
}

function modelToPricingData(model: PricingModel): ModelRatioData {
  if (model.billing_mode === 'tiered_expr') {
    return {
      name: model.model_name,
      billingMode: 'tiered_expr',
      billingExpr: model.billing_expr || '',
    }
  }

  if (!isTokenBasedModel(model)) {
    return {
      name: model.model_name,
      billingMode: 'per-request',
      price: formatDraft(model.model_price),
    }
  }

  return {
    name: model.model_name,
    billingMode: 'per-token',
    ratio: formatDraft(model.model_ratio),
    completionRatio: formatDraft(model.completion_ratio),
    cacheRatio: formatDraft(model.cache_ratio),
    createCacheRatio: formatDraft(model.create_cache_ratio),
    imageRatio: formatDraft(model.image_ratio),
    audioRatio: formatDraft(model.audio_ratio),
    audioCompletionRatio: formatDraft(model.audio_completion_ratio),
    minFee: formatDraft(model.model_min_fee),
  }
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

type GroupPricingDraft = {
  billing_mode: string
  billing_expr: string
  ratio: string
  model_price: string
  prompt_price: string
  completion_price: string
  cache_price: string
  create_cache_price: string
  image_price: string
  audio_price: string
  audio_completion_price: string
  min_fee: string
}

const emptyGroupDraft = (): GroupPricingDraft => ({
  billing_mode: '',
  billing_expr: '',
  ratio: '',
  model_price: '',
  prompt_price: '',
  completion_price: '',
  cache_price: '',
  create_cache_price: '',
  image_price: '',
  audio_price: '',
  audio_completion_price: '',
  min_fee: '',
})

function groupPricingItemToDraft(
  item?: ModelGroupPricingItem
): GroupPricingDraft {
  const draft = emptyGroupDraft()
  if (typeof item === 'number') {
    draft.ratio = formatDraft(item)
    return draft
  }
  if (!item || typeof item !== 'object') {
    return draft
  }
  draft.ratio = formatDraft(item.ratio)
  draft.model_price = formatDraft(item.model_price)
  draft.prompt_price = formatDraft(item.prompt_price)
  draft.completion_price = formatDraft(item.completion_price)
  draft.cache_price = formatDraft(item.cache_price)
  draft.create_cache_price = formatDraft(item.create_cache_price)
  draft.image_price = formatDraft(item.image_price)
  draft.audio_price = formatDraft(item.audio_price)
  draft.audio_completion_price = formatDraft(item.audio_completion_price)
  draft.min_fee = formatDraft(item.min_fee)
  draft.billing_mode =
    typeof item.billing_mode === 'string' ? item.billing_mode : ''
  draft.billing_expr =
    typeof item.billing_expr === 'string' ? item.billing_expr : ''
  return draft
}

const NUMERIC_GROUP_FIELDS: Array<keyof GroupPricingDraft> = [
  'ratio',
  'model_price',
  'prompt_price',
  'completion_price',
  'cache_price',
  'create_cache_price',
  'image_price',
  'audio_price',
  'audio_completion_price',
  'min_fee',
]

function draftToGroupPricingItem(
  draft: GroupPricingDraft
): ModelGroupPricingItem | undefined {
  const item: Record<string, number | string> = {}
  for (const key of NUMERIC_GROUP_FIELDS) {
    const parsed = parseOptionalNumber(draft[key])
    if (parsed === undefined) {
      continue
    }
    if (parsed < 0) {
      throw new Error('分组价格必须是不小于 0 的有效数字')
    }
    item[key] = parsed
  }
  const mode = draft.billing_mode.trim()
  if (mode) {
    item.billing_mode = mode
    if (mode === 'tiered_expr') {
      const expr = draft.billing_expr.trim()
      if (!expr) {
        throw new Error('分组表达式计费需要填写计费表达式')
      }
      item.billing_expr = expr
    }
  }
  if (Object.keys(item).length === 0) {
    return undefined
  }
  return item as ModelGroupPricingOverride
}

type GroupFieldDef = {
  key: keyof GroupPricingDraft
  label: string
  placeholder?: string
}

function effectiveGroupMode(
  draft: GroupPricingDraft,
  model: PricingModel
): string {
  if (draft.billing_mode) {
    return draft.billing_mode
  }
  if (model.billing_mode === 'tiered_expr') {
    return 'tiered_expr'
  }
  return isTokenBasedModel(model) ? 'per-token' : 'per-request'
}

function fieldsForGroupMode(mode: string): GroupFieldDef[] {
  if (mode === 'per-request') {
    return [{ key: 'model_price', label: 'Model price' }]
  }
  if (mode === 'tiered_expr') {
    return []
  }
  return [
    { key: 'ratio', label: 'Ratio', placeholder: 'x' },
    { key: 'prompt_price', label: 'Input price' },
    { key: 'completion_price', label: 'Output price' },
    { key: 'cache_price', label: 'Cache price' },
    { key: 'create_cache_price', label: 'Cache Write' },
    { key: 'image_price', label: 'Image price' },
    { key: 'audio_price', label: 'Audio input' },
    { key: 'audio_completion_price', label: 'Audio output' },
    { key: 'min_fee', label: 'Min fee', placeholder: '$/request' },
  ]
}

const GROUP_MODE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Inherit model default' },
  { value: 'per-token', label: 'Per-token billing' },
  { value: 'per-request', label: 'Per-request billing' },
  { value: 'tiered_expr', label: 'Expression billing' },
]

function pricingDataToPayload(data: ModelRatioData): UpdateModelPricingPayload {
  if (data.billingMode === 'tiered_expr') {
    return {
      billing_mode: 'tiered_expr',
      billing_expr: combineBillingExpr(
        data.billingExpr || '',
        data.requestRuleExpr || ''
      ),
    }
  }

  if (data.billingMode === 'per-request') {
    return {
      billing_mode: 'per-request',
      model_price: parseOptionalNumber(data.price),
    }
  }

  return {
    billing_mode: 'per-token',
    model_ratio: parseOptionalNumber(data.ratio),
    completion_ratio: parseOptionalNumber(data.completionRatio),
    cache_ratio: parseOptionalNumber(data.cacheRatio),
    create_cache_ratio: parseOptionalNumber(data.createCacheRatio),
    image_ratio: parseOptionalNumber(data.imageRatio),
    audio_ratio: parseOptionalNumber(data.audioRatio),
    audio_completion_ratio: parseOptionalNumber(data.audioCompletionRatio),
    min_fee: parseOptionalNumber(data.minFee),
  }
}

export function ModelPricingAdminPanel(props: ModelPricingAdminPanelProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const editorPanelRef = useRef<ModelPricingEditorPanelHandle>(null)
  const [groupDrafts, setGroupDrafts] = useState<
    Record<string, GroupPricingDraft>
  >({})

  const availableGroups = useMemo(
    () => getAvailableGroups(props.model, props.usableGroup || {}),
    [props.model, props.usableGroup]
  )

  const basePricingData = useMemo(
    () => modelToPricingData(props.model),
    [props.model]
  )

  const saveModelPricing = useMutation({
    mutationFn: (data: ModelRatioData) => {
      const payload = pricingDataToPayload(data)
      if (props.model.id) {
        return updateModelPricing(props.model.id, payload)
      }
      return updateModelPricingByName({
        ...payload,
        model_name: props.model.model_name,
      })
    },
    onSuccess: async (res) => {
      if (!res.success) {
        toast.error(res.message || t('Failed to save'))
        return
      }
      await queryClient.invalidateQueries({ queryKey: ['pricing'] })
      props.onSaved?.()
      toast.success(t('Saved'))
      setEditing(false)
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('Failed to save'))
    },
  })

  const saveGroupPricing = useMutation({
    mutationFn: (data: Record<string, ModelGroupPricingItem>) => {
      if (props.model.id) {
        return updateModelGroupPricing(props.model.id, data)
      }
      return updateModelGroupPricingByName(props.model.model_name, data)
    },
    onSuccess: async (res) => {
      if (!res.success) {
        toast.error(res.message || t('Failed to save'))
        return
      }
      await queryClient.invalidateQueries({ queryKey: ['pricing'] })
      props.onSaved?.()
      toast.success(t('Saved'))
      setEditing(false)
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('Failed to save'))
    },
  })

  const handleStartEdit = () => {
    const nextDrafts: Record<string, GroupPricingDraft> = {}
    for (const group of availableGroups) {
      nextDrafts[group] = groupPricingItemToDraft(
        props.model.group_pricing?.[group]
      )
    }
    setGroupDrafts(nextDrafts)
    setEditing(true)
  }

  const handleSaveGroups = () => {
    const next: Record<string, ModelGroupPricingItem> = {}
    try {
      for (const [group, draft] of Object.entries(groupDrafts)) {
        const item = draftToGroupPricingItem(draft)
        if (item !== undefined) {
          next[group] = item
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('Failed to save'))
      return
    }
    saveGroupPricing.mutate(next)
  }

  const updateGroupDraft = (
    group: string,
    field: keyof GroupPricingDraft,
    value: string
  ) => {
    setGroupDrafts((current) => ({
      ...current,
      [group]: {
        ...(current[group] || emptyGroupDraft()),
        [field]: value,
      },
    }))
  }

  return (
    <section className='bg-muted/10 rounded-lg border'>
      <div className='flex items-center justify-between gap-3 border-b px-3 py-2'>
        <div>
          <div className='text-sm font-medium'>{t('Admin Pricing')}</div>
          <div className='text-muted-foreground text-xs'>
            {t('Edit this model base price and group overrides.')}
          </div>
        </div>
        {!editing && (
          <Button size='sm' variant='outline' onClick={handleStartEdit}>
            <Edit3 className='size-3.5' />
            {t('Edit')}
          </Button>
        )}
      </div>

      {editing ? (
        <Tabs defaultValue='base' className='p-3'>
          <TabsList className='grid w-full grid-cols-2'>
            <TabsTrigger value='base'>{t('Base Price')}</TabsTrigger>
            <TabsTrigger value='groups'>{t('Group Overrides')}</TabsTrigger>
          </TabsList>
          <TabsContent value='base' className='mt-3 space-y-3'>
            <ModelPricingEditorPanel
              ref={editorPanelRef}
              editData={basePricingData}
              isSaving={saveModelPricing.isPending}
              onSave={async () => {
                const data = await editorPanelRef.current?.commitDraft()
                if (data) saveModelPricing.mutate(data)
              }}
              className='max-h-[640px] min-h-[520px] rounded-lg'
            />
            <div className='flex justify-end'>
              <Button
                size='sm'
                variant='outline'
                onClick={() => setEditing(false)}
              >
                <X className='size-3.5' />
                {t('Cancel')}
              </Button>
            </div>
          </TabsContent>
          <TabsContent value='groups' className='mt-3 space-y-3'>
            <div className='text-muted-foreground bg-muted/20 rounded-md border p-2 text-xs'>
              {t(
                'Leave a field empty to use the normal multiplier-based price. Filled item prices are final USD prices for this model and group.'
              )}
            </div>
            <div className='space-y-3'>
              {availableGroups.map((group) => {
                const fallback = props.groupRatio[group] ?? 1
                const effective = getEffectiveGroupRatio(
                  props.model,
                  group,
                  props.groupRatio
                )
                const draft = groupDrafts[group] || emptyGroupDraft()
                return (
                  <div key={group} className='rounded-lg border p-3'>
                    <div className='mb-3 flex min-w-0 items-center justify-between gap-2'>
                      <div className='flex min-w-0 items-center gap-2'>
                        <GroupBadge group={group} size='sm' />
                        <span className='text-muted-foreground truncate text-xs'>
                          {t('Default')} {fallback}x
                        </span>
                      </div>
                      <div className='text-muted-foreground font-mono text-xs'>
                        {t('Current')} {effective}x
                      </div>
                    </div>
                    {(() => {
                      const mode = effectiveGroupMode(draft, props.model)
                      const fields = fieldsForGroupMode(mode)
                      return (
                        <div className='space-y-2'>
                          <label className='block space-y-1'>
                            <span className='text-muted-foreground text-xs'>
                              {t('Group billing mode')}
                            </span>
                            <select
                              className='border-input bg-background h-9 w-full rounded-md border px-2 text-sm'
                              value={draft.billing_mode}
                              onChange={(event) =>
                                updateGroupDraft(
                                  group,
                                  'billing_mode',
                                  event.target.value
                                )
                              }
                            >
                              {GROUP_MODE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {t(opt.label)}
                                </option>
                              ))}
                            </select>
                          </label>

                          {mode === 'tiered_expr' ? (
                            <label className='block space-y-1'>
                              <span className='text-muted-foreground text-xs'>
                                {t('Billing expression')}
                              </span>
                              <textarea
                                className='border-input bg-background min-h-[72px] w-full rounded-md border p-2 font-mono text-xs'
                                value={draft.billing_expr}
                                placeholder={'tier("base", p * 2 + c * 8)'}
                                onChange={(event) =>
                                  updateGroupDraft(
                                    group,
                                    'billing_expr',
                                    event.target.value
                                  )
                                }
                              />
                            </label>
                          ) : (
                            <div className='grid gap-2 sm:grid-cols-2'>
                              {fields.map((field) => (
                                <label key={field.key} className='space-y-1'>
                                  <span className='text-muted-foreground text-xs'>
                                    {t(field.label)}
                                  </span>
                                  <Input
                                    value={draft[field.key] ?? ''}
                                    placeholder={
                                      field.placeholder || '$/1M tokens'
                                    }
                                    inputMode='decimal'
                                    onChange={(event) =>
                                      updateGroupDraft(
                                        group,
                                        field.key,
                                        event.target.value
                                      )
                                    }
                                  />
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )
              })}
            </div>
            <div className='flex justify-end gap-2'>
              <Button
                variant='outline'
                onClick={() => setEditing(false)}
                disabled={saveGroupPricing.isPending}
              >
                <X className='size-3.5' />
                {t('Cancel')}
              </Button>
              <Button
                onClick={handleSaveGroups}
                disabled={saveGroupPricing.isPending}
              >
                <Save className='size-3.5' />
                {t('Save')}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        <div className='grid gap-2 p-3 sm:grid-cols-2'>
          <div className='bg-background/60 rounded-md border p-3'>
            <div className='text-muted-foreground text-xs'>
              {t('Input price')}
            </div>
            <div className='font-mono text-sm font-semibold'>
              {isTokenBasedModel(props.model)
                ? ratioToPrice(props.model.model_ratio) || '-'
                : formatDraft(props.model.model_price) || '-'}
            </div>
          </div>
          <div className='bg-background/60 rounded-md border p-3'>
            <div className='text-muted-foreground text-xs'>
              {t('Group overrides')}
            </div>
            <div className='font-mono text-sm font-semibold'>
              {Object.keys(props.model.group_pricing || {}).length}
            </div>
          </div>
          {isTokenBasedModel(props.model) && (
            <div className='bg-background/60 rounded-md border p-3 sm:col-span-2'>
              <div className='text-muted-foreground mb-1 text-xs'>
                {t('Extra prices')}
              </div>
              <div className='grid gap-1 font-mono text-xs sm:grid-cols-3'>
                <span className='min-w-0 break-words'>
                  {t('Output')}:{' '}
                  {ratioToLanePrice(
                    props.model.model_ratio,
                    props.model.completion_ratio
                  ) || '-'}
                </span>
                <span className='min-w-0 break-words'>
                  {t('Cache')}:{' '}
                  {ratioToLanePrice(
                    props.model.model_ratio,
                    props.model.cache_ratio
                  ) || '-'}
                </span>
                <span className='min-w-0 break-words'>
                  {t('Cache Write')}:{' '}
                  {ratioToLanePrice(
                    props.model.model_ratio,
                    props.model.create_cache_ratio
                  ) || '-'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
