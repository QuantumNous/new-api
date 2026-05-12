import { memo, useCallback, useState } from 'react'
import { type UseFormReturn } from 'react-hook-form'
import { Code2, Eye, Layers } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Switch } from '@/components/ui/switch'
import { ModelRatioVisualEditor } from './model-ratio-visual-editor'

// ---------------------------------------------------------------------------
// Merged JSON helpers
// ---------------------------------------------------------------------------

type MergedModelEntry = {
  ratio?: number
  price?: number
  completion_ratio?: number
  cache_ratio?: number
  create_cache_ratio?: number
  image_ratio?: number
  audio_ratio?: number
  audio_completion_ratio?: number
}

function safeParseJson(s: string): Record<string, number> {
  try {
    if (!s.trim()) return {}
    return JSON.parse(s) as Record<string, number>
  } catch {
    return {}
  }
}

/** Convert 8 separate field JSONs → one merged-per-model object */
function fieldsToMerged(values: ModelFormValues): string {
  const ratio = safeParseJson(values.ModelRatio)
  const price = safeParseJson(values.ModelPrice)
  const completion = safeParseJson(values.CompletionRatio)
  const cache = safeParseJson(values.CacheRatio)
  const createCache = safeParseJson(values.CreateCacheRatio)
  const image = safeParseJson(values.ImageRatio)
  const audio = safeParseJson(values.AudioRatio)
  const audioCompletion = safeParseJson(values.AudioCompletionRatio)

  const models = new Set([
    ...Object.keys(ratio),
    ...Object.keys(price),
    ...Object.keys(completion),
    ...Object.keys(cache),
    ...Object.keys(createCache),
    ...Object.keys(image),
    ...Object.keys(audio),
    ...Object.keys(audioCompletion),
  ])

  const merged: Record<string, MergedModelEntry> = {}
  for (const model of models) {
    const entry: MergedModelEntry = {}
    if (ratio[model] !== undefined) entry.ratio = ratio[model]
    if (price[model] !== undefined) entry.price = price[model]
    if (completion[model] !== undefined) entry.completion_ratio = completion[model]
    if (cache[model] !== undefined) entry.cache_ratio = cache[model]
    if (createCache[model] !== undefined) entry.create_cache_ratio = createCache[model]
    if (image[model] !== undefined) entry.image_ratio = image[model]
    if (audio[model] !== undefined) entry.audio_ratio = audio[model]
    if (audioCompletion[model] !== undefined) entry.audio_completion_ratio = audioCompletion[model]
    merged[model] = entry
  }
  return JSON.stringify(merged, null, 2)
}

/** Convert merged-per-model object → 8 separate field JSONs, merged with existing */
function mergedToFields(
  mergedJson: string,
  current: ModelFormValues
): Partial<ModelFormValues> {
  let merged: Record<string, MergedModelEntry>
  try {
    merged = JSON.parse(mergedJson)
  } catch {
    return {}
  }

  const ratio = safeParseJson(current.ModelRatio)
  const price = safeParseJson(current.ModelPrice)
  const completion = safeParseJson(current.CompletionRatio)
  const cache = safeParseJson(current.CacheRatio)
  const createCache = safeParseJson(current.CreateCacheRatio)
  const image = safeParseJson(current.ImageRatio)
  const audio = safeParseJson(current.AudioRatio)
  const audioCompletion = safeParseJson(current.AudioCompletionRatio)

  for (const [model, entry] of Object.entries(merged)) {
    if (entry.ratio !== undefined) ratio[model] = entry.ratio
    if (entry.price !== undefined) price[model] = entry.price
    if (entry.completion_ratio !== undefined) completion[model] = entry.completion_ratio
    if (entry.cache_ratio !== undefined) cache[model] = entry.cache_ratio
    if (entry.create_cache_ratio !== undefined) createCache[model] = entry.create_cache_ratio
    if (entry.image_ratio !== undefined) image[model] = entry.image_ratio
    if (entry.audio_ratio !== undefined) audio[model] = entry.audio_ratio
    if (entry.audio_completion_ratio !== undefined) audioCompletion[model] = entry.audio_completion_ratio
  }

  const s = (o: Record<string, number>) =>
    Object.keys(o).length ? JSON.stringify(o, null, 2) : ''

  return {
    ModelRatio: s(ratio),
    ModelPrice: s(price),
    CompletionRatio: s(completion),
    CacheRatio: s(cache),
    CreateCacheRatio: s(createCache),
    ImageRatio: s(image),
    AudioRatio: s(audio),
    AudioCompletionRatio: s(audioCompletion),
  }
}

type ModelFormValues = {
  ModelPrice: string
  ModelRatio: string
  CacheRatio: string
  CreateCacheRatio: string
  CompletionRatio: string
  ImageRatio: string
  AudioRatio: string
  AudioCompletionRatio: string
  ExposeRatioEnabled: boolean
  BillingMode: string
  BillingExpr: string
}

type ModelRatioFormProps = {
  form: UseFormReturn<ModelFormValues>
  onSave: (values: ModelFormValues) => Promise<void>
  onReset: () => void
  isSaving: boolean
  isResetting: boolean
}

export const ModelRatioForm = memo(function ModelRatioForm({
  form,
  onSave,
  onReset,
  isSaving,
  isResetting,
}: ModelRatioFormProps) {
  const { t } = useTranslation()
  const [editMode, setEditMode] = useState<'visual' | 'json' | 'merged'>('visual')
  const [mergedJson, setMergedJson] = useState('')

  const handleFieldChange = useCallback(
    (field: keyof ModelFormValues, value: string) => {
      form.setValue(field, value, {
        shouldValidate: true,
        shouldDirty: true,
      })
    },
    [form]
  )

  const switchMode = useCallback(
    (next: 'visual' | 'json' | 'merged') => {
      if (next === 'merged') {
        setMergedJson(fieldsToMerged(form.getValues()))
      }
      if (editMode === 'merged') {
        // flush merged → fields before leaving
        const patches = mergedToFields(mergedJson, form.getValues())
        for (const [k, v] of Object.entries(patches)) {
          form.setValue(k as keyof ModelFormValues, v as string, {
            shouldValidate: true,
            shouldDirty: true,
          })
        }
      }
      setEditMode(next)
    },
    [editMode, form, mergedJson]
  )

  const handleMergedChange = useCallback(
    (value: string) => {
      setMergedJson(value)
      // live-sync into form fields so save works at any time
      const patches = mergedToFields(value, form.getValues())
      for (const [k, v] of Object.entries(patches)) {
        form.setValue(k as keyof ModelFormValues, v as string, {
          shouldDirty: true,
        })
      }
    },
    [form]
  )

  return (
    <div className='space-y-6'>
      <div className='flex justify-end gap-2'>
        <Button
          variant={editMode === 'visual' ? 'default' : 'outline'}
          size='sm'
          onClick={() => switchMode('visual')}
        >
          <Eye className='mr-2 h-4 w-4' />
          {t('Visual')}
        </Button>
        <Button
          variant={editMode === 'merged' ? 'default' : 'outline'}
          size='sm'
          onClick={() => switchMode('merged')}
        >
          <Layers className='mr-2 h-4 w-4' />
          {t('Merged JSON')}
        </Button>
        <Button
          variant={editMode === 'json' ? 'default' : 'outline'}
          size='sm'
          onClick={() => switchMode('json')}
        >
          <Code2 className='mr-2 h-4 w-4' />
          {t('Field JSON')}
        </Button>
      </div>

      <Form {...form}>
        {editMode === 'merged' ? (
          <div className='space-y-4'>
            <div className='rounded-md border text-sm'>
              <table className='w-full text-left'>
                <thead>
                  <tr className='bg-muted/50 border-b'>
                    <th className='px-3 py-2 font-mono font-semibold'>字段</th>
                    <th className='px-3 py-2 font-semibold'>类型</th>
                    <th className='px-3 py-2 font-semibold'>说明</th>
                  </tr>
                </thead>
                <tbody className='text-muted-foreground divide-y'>
                  <tr>
                    <td className='px-3 py-2 font-mono'>ratio</td>
                    <td className='px-3 py-2'>number</td>
                    <td className='px-3 py-2'>输入 token 计费比率。1 = ¥0.002/1K tokens = ¥2/1M tokens</td>
                  </tr>
                  <tr>
                    <td className='px-3 py-2 font-mono'>price</td>
                    <td className='px-3 py-2'>number</td>
                    <td className='px-3 py-2'>每次请求固定价格（¥/次），优先于 ratio。适用于图像生成等按次计费的模型</td>
                  </tr>
                  <tr>
                    <td className='px-3 py-2 font-mono'>completion_ratio</td>
                    <td className='px-3 py-2'>number</td>
                    <td className='px-3 py-2'>输出 token 相对输入的价格倍数。例如填 3.0，表示输出价格 = 输入价格 × 3</td>
                  </tr>
                  <tr>
                    <td className='px-3 py-2 font-mono'>cache_ratio</td>
                    <td className='px-3 py-2'>number</td>
                    <td className='px-3 py-2'>缓存读取折扣倍数，上游命中缓存时使用。通常为 0.1～0.5</td>
                  </tr>
                  <tr>
                    <td className='px-3 py-2 font-mono'>create_cache_ratio</td>
                    <td className='px-3 py-2'>number</td>
                    <td className='px-3 py-2'>写入 Prompt Cache 时的额外费用倍数。通常为 1.25（如 Claude 系列）</td>
                  </tr>
                  <tr>
                    <td className='px-3 py-2 font-mono'>image_ratio</td>
                    <td className='px-3 py-2'>number</td>
                    <td className='px-3 py-2'>图像输入相对于 ratio 的倍数，适用于视觉多模态模型</td>
                  </tr>
                  <tr>
                    <td className='px-3 py-2 font-mono'>audio_ratio</td>
                    <td className='px-3 py-2'>number</td>
                    <td className='px-3 py-2'>音频输入相对于 ratio 的倍数，适用于语音识别/音频理解模型</td>
                  </tr>
                  <tr>
                    <td className='px-3 py-2 font-mono'>audio_completion_ratio</td>
                    <td className='px-3 py-2'>number</td>
                    <td className='px-3 py-2'>音频输出相对于 audio_ratio 的倍数，适用于语音合成/音频回复模型</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <Textarea
              rows={20}
              className='font-mono text-sm'
              placeholder={`{\n  "gpt-4o": {\n    "ratio": 0.5,\n    "completion_ratio": 3.0,\n    "cache_ratio": 0.1\n  }\n}`}
              value={mergedJson}
              onChange={(e) => handleMergedChange(e.target.value)}
            />
            <div className='flex flex-wrap gap-4'>
              <Button onClick={form.handleSubmit(onSave)} disabled={isSaving}>
                {isSaving ? t('Saving...') : t('Save model prices')}
              </Button>
              <Button type='button' variant='destructive' onClick={onReset} disabled={isResetting}>
                {t('Reset prices')}
              </Button>
            </div>
          </div>
        ) : editMode === 'visual' ? (
          <div className='space-y-6'>
            <ModelRatioVisualEditor
              modelPrice={form.watch('ModelPrice')}
              modelRatio={form.watch('ModelRatio')}
              cacheRatio={form.watch('CacheRatio')}
              createCacheRatio={form.watch('CreateCacheRatio')}
              completionRatio={form.watch('CompletionRatio')}
              imageRatio={form.watch('ImageRatio')}
              audioRatio={form.watch('AudioRatio')}
              audioCompletionRatio={form.watch('AudioCompletionRatio')}
              billingMode={form.watch('BillingMode')}
              billingExpr={form.watch('BillingExpr')}
              onChange={(field, value) => {
                const fieldMap: Record<string, keyof ModelFormValues> = {
                  'billing_setting.billing_mode': 'BillingMode',
                  'billing_setting.billing_expr': 'BillingExpr',
                }
                const formField =
                  fieldMap[field] || (field as keyof ModelFormValues)
                handleFieldChange(formField, value)
              }}
            />

            <FormField
              control={form.control}
              name='ExposeRatioEnabled'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>
                      {t('Expose ratio API')}
                    </FormLabel>
                    <FormDescription>
                      {t(
                        'Allow clients to query configured ratios via `/api/ratio`.'
                      )}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className='flex flex-wrap gap-4'>
              <Button onClick={form.handleSubmit(onSave)} disabled={isSaving}>
                {isSaving ? t('Saving...') : t('Save model prices')}
              </Button>
              <Button
                type='button'
                variant='destructive'
                onClick={onReset}
                disabled={isResetting}
              >
                {t('Reset prices')}
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSave)} className='space-y-6'>
            <FormField
              control={form.control}
              name='ModelPrice'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Model fixed pricing')}</FormLabel>
                  <FormControl>
                    <Textarea rows={8} {...field} />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'JSON map of model → cost per request. Takes precedence over ratio based billing.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='ModelRatio'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Model ratio')}</FormLabel>
                  <FormControl>
                    <Textarea rows={8} {...field} />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'JSON map of model → multiplier applied to quota billing.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='CacheRatio'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Prompt cache ratio')}</FormLabel>
                  <FormControl>
                    <Textarea rows={8} {...field} />
                  </FormControl>
                  <FormDescription>
                    {t('Optional ratio used when upstream cache hits occur.')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='CreateCacheRatio'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Create cache ratio')}</FormLabel>
                  <FormControl>
                    <Textarea rows={8} {...field} />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Ratio applied when creating cache entries for supported models.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='CompletionRatio'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Completion ratio')}</FormLabel>
                  <FormControl>
                    <Textarea rows={8} {...field} />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Applies to custom completion endpoints. JSON map of model → ratio.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='ImageRatio'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Image ratio')}</FormLabel>
                  <FormControl>
                    <Textarea rows={6} {...field} />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Configure per-model ratio for image inputs or outputs.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='AudioRatio'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Audio ratio')}</FormLabel>
                  <FormControl>
                    <Textarea rows={6} {...field} />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Ratio applied to audio inputs where supported by the upstream model.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='AudioCompletionRatio'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Audio completion ratio')}</FormLabel>
                  <FormControl>
                    <Textarea rows={6} {...field} />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Ratio applied to audio completions for streaming models.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='ExposeRatioEnabled'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>
                      {t('Expose ratio API')}
                    </FormLabel>
                    <FormDescription>
                      {t(
                        'Allow clients to query configured ratios via `/api/ratio`.'
                      )}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className='flex flex-wrap gap-4'>
              <Button type='submit' disabled={isSaving}>
                {isSaving ? t('Saving...') : t('Save model prices')}
              </Button>
              <Button
                type='button'
                variant='destructive'
                onClick={onReset}
                disabled={isResetting}
              >
                {t('Reset prices')}
              </Button>
            </div>
          </form>
        )}
      </Form>
    </div>
  )
})
