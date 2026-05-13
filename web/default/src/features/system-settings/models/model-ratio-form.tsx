import React, { memo, useCallback, useState, useRef } from 'react'
import { type UseFormReturn } from 'react-hook-form'
import { Code2, Eye, Layers, CheckCircle2, Undo2, AlertCircle } from 'lucide-react'
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

/** Convert 8 separate field JSONs → one merged-per-model object (filters empty entries) */
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
    // Filter: skip models with no configured fields
    if (Object.keys(entry).length > 0) {
      merged[model] = entry
    }
  }

  if (Object.keys(merged).length === 0) return ''
  return JSON.stringify(merged, null, 2)
}

/** Convert merged JSON → 8 separate field JSONs (full replace, not merge) */
function mergedToFields(
  mergedJson: string
): Partial<ModelFormValues> {
  let merged: Record<string, MergedModelEntry>
  try {
    merged = JSON.parse(mergedJson)
  } catch {
    return {}
  }

  const ratio: Record<string, number> = {}
  const price: Record<string, number> = {}
  const completion: Record<string, number> = {}
  const cache: Record<string, number> = {}
  const createCache: Record<string, number> = {}
  const image: Record<string, number> = {}
  const audio: Record<string, number> = {}
  const audioCompletion: Record<string, number> = {}

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

/** Validate JSON string, return error message or null */
function validateMergedJson(json: string): string | null {
  const trimmed = json.trim()
  if (!trimmed) return null // empty is valid (means no models)
  try {
    const parsed = JSON.parse(trimmed)
    if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
      return '顶层必须是对象 { "模型名": { ... } }'
    }
    const validFields = new Set([
      'ratio', 'price', 'completion_ratio', 'cache_ratio',
      'create_cache_ratio', 'image_ratio', 'audio_ratio', 'audio_completion_ratio',
    ])
    for (const [model, entry] of Object.entries(parsed)) {
      if (typeof entry !== 'object' || Array.isArray(entry) || entry === null) {
        return `"${model}" 的值必须是对象，例如 { "ratio": 1.0 }`
      }
      for (const [field, val] of Object.entries(entry as Record<string, unknown>)) {
        if (!validFields.has(field)) {
          return `"${model}" 包含未知字段 "${field}"，可用字段：${[...validFields].join(', ')}`
        }
        if (typeof val !== 'number') {
          return `"${model}.${field}" 的值必须是数字，当前为 ${typeof val}`
        }
      }
    }
    return null
  } catch (e) {
    return 'JSON 格式错误：' + (e instanceof Error ? e.message : String(e))
  }
}

/** Max number of undo snapshots */
const MAX_HISTORY = 30

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

  // Merged JSON 编辑区
  const [mergedDraft, setMergedDraft] = useState('')
  const [mergedError, setMergedError] = useState<string | null>(null)
  const [applied, setApplied] = useState(false)
  // 回滚历史栈：每次"应用"前把当前 draft 快照入栈
  const historyRef = useRef<string[]>([])

  const handleFieldChange = useCallback(
    (field: keyof ModelFormValues, value: string) => {
      form.setValue(field, value, { shouldValidate: true, shouldDirty: true })
    },
    [form]
  )

  const switchMode = useCallback(
    (next: 'visual' | 'json' | 'merged') => {
      if (next === 'merged') {
        // 进入 Merged JSON：从表单生成当前已配置的模型 JSON
        const current = fieldsToMerged(form.getValues())
        setMergedDraft(current)
        setMergedError(null)
        setApplied(false)
        historyRef.current = [] // 清空历史
      }
      setEditMode(next)
    },
    [form]
  )

  /** 实时 JSON 校验 + 更新 draft */
  const handleDraftChange = useCallback((text: string) => {
    setMergedDraft(text)
    setApplied(false)
    // 实时校验
    const err = validateMergedJson(text)
    setMergedError(err)
  }, [])

  /**
   * Tab key handler for Merged JSON textarea.
   * Uses execCommand('insertText') so the insertion is recorded in the browser's
   * native undo stack — Ctrl+Z works out of the box.
   * execCommand also fires an `input` event which React picks up as onChange,
   * so no manual state update needed.
   */
  const handleMergedJsonTab = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key !== 'Tab') return
      e.preventDefault()
      // eslint-disable-next-line deprecation/deprecation
      document.execCommand('insertText', false, '  ')
    },
    []
  )

  /** 应用 JSON 到表单（完整覆盖） */
  const handleApply = useCallback(() => {
    const trimmed = mergedDraft.trim()
    // 空内容 → 清空所有模型价格
    if (!trimmed) {
      // 记录当前状态到历史
      const currentJson = fieldsToMerged(form.getValues())
      if (currentJson) {
        historyRef.current = [...historyRef.current, currentJson].slice(-MAX_HISTORY)
      }
      const emptyFields = mergedToFields('{}')
      for (const [k, v] of Object.entries(emptyFields)) {
        form.setValue(k as keyof ModelFormValues, v as string, { shouldDirty: true })
      }
      setApplied(true)
      setMergedError(null)
      return
    }
    // 校验
    const err = validateMergedJson(trimmed)
    if (err) {
      setMergedError(err)
      return
    }
    // 保存当前编辑器状态到历史（用于撤销）
    const currentJson = fieldsToMerged(form.getValues())
    historyRef.current = [...historyRef.current, currentJson || '{}'].slice(-MAX_HISTORY)
    // 应用到表单
    const patches = mergedToFields(trimmed)
    for (const [k, v] of Object.entries(patches)) {
      form.setValue(k as keyof ModelFormValues, v as string, { shouldDirty: true })
    }
    setApplied(true)
    setMergedError(null)
  }, [mergedDraft, form])

  /** 撤销：从历史栈恢复上一次状态 */
  const handleUndo = useCallback(() => {
    const history = historyRef.current
    if (history.length === 0) return
    const prev = history[history.length - 1]
    historyRef.current = history.slice(0, -1)
    // 恢复到编辑器
    setMergedDraft(prev)
    setMergedError(null)
    setApplied(false)
    // 同时恢复到表单
    if (prev.trim()) {
      const patches = mergedToFields(prev)
      for (const [k, v] of Object.entries(patches)) {
        form.setValue(k as keyof ModelFormValues, v as string, { shouldDirty: true })
      }
    } else {
      const emptyFields = mergedToFields('{}')
      for (const [k, v] of Object.entries(emptyFields)) {
        form.setValue(k as keyof ModelFormValues, v as string, { shouldDirty: true })
      }
    }
  }, [form])

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
            {/* 字段说明表（可折叠） */}
            <details className='rounded-md border'>
              <summary className='bg-muted/50 cursor-pointer px-3 py-2 text-sm font-semibold select-none'>
                字段说明（点击展开）
              </summary>
              <table className='w-full text-left text-sm'>
                <thead>
                  <tr className='border-b'>
                    <th className='px-3 py-2 font-mono font-semibold'>字段</th>
                    <th className='px-3 py-2 font-semibold'>类型</th>
                    <th className='px-3 py-2 font-semibold'>说明</th>
                  </tr>
                </thead>
                <tbody className='text-muted-foreground divide-y'>
                  <tr><td className='px-3 py-2 font-mono'>ratio</td><td className='px-3 py-2'>number</td><td className='px-3 py-2'>输入 token 计费比率。1 = ¥0.002/1K tokens = ¥2/1M tokens</td></tr>
                  <tr><td className='px-3 py-2 font-mono'>price</td><td className='px-3 py-2'>number</td><td className='px-3 py-2'>每次请求固定价格（¥/次），优先于 ratio</td></tr>
                  <tr><td className='px-3 py-2 font-mono'>completion_ratio</td><td className='px-3 py-2'>number</td><td className='px-3 py-2'>输出/输入价格倍数。如 3.0 表示输出价格 = 输入 × 3</td></tr>
                  <tr><td className='px-3 py-2 font-mono'>cache_ratio</td><td className='px-3 py-2'>number</td><td className='px-3 py-2'>缓存读取折扣，通常 0.1～0.5</td></tr>
                  <tr><td className='px-3 py-2 font-mono'>create_cache_ratio</td><td className='px-3 py-2'>number</td><td className='px-3 py-2'>写入缓存的费用倍数，通常 1.25</td></tr>
                  <tr><td className='px-3 py-2 font-mono'>image_ratio</td><td className='px-3 py-2'>number</td><td className='px-3 py-2'>图像输入倍数</td></tr>
                  <tr><td className='px-3 py-2 font-mono'>audio_ratio</td><td className='px-3 py-2'>number</td><td className='px-3 py-2'>音频输入倍数</td></tr>
                  <tr><td className='px-3 py-2 font-mono'>audio_completion_ratio</td><td className='px-3 py-2'>number</td><td className='px-3 py-2'>音频输出倍数</td></tr>
                </tbody>
              </table>
            </details>

            {/* 提示栏 */}
            <p className='text-muted-foreground text-xs'>
              直接编辑下方 JSON，修改后点击「应用到表单」同步，再点「保存」生效。每次应用前会自动记录快照，可随时撤销。
            </p>

            {/* 错误提示（实时校验） */}
            {mergedError && (
              <div className='flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400'>
                <AlertCircle className='h-4 w-4 shrink-0' />
                {mergedError}
              </div>
            )}

            {/* 已应用提示 */}
            {applied && !mergedError && (
              <div className='flex items-center gap-1.5 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400'>
                <CheckCircle2 className='h-4 w-4 shrink-0' />
                已应用到表单，点击「保存模型价格」写入后端
              </div>
            )}

            {/* JSON 编辑区 */}
            <Textarea
              rows={20}
              className={`font-mono text-sm ${mergedError ? 'border-red-300 focus-visible:ring-red-400' : ''}`}
              placeholder={`{\n  "模型名": { "ratio": 1.0 }\n}`}
              value={mergedDraft}
              onChange={(e) => handleDraftChange(e.target.value)}
              onKeyDown={handleMergedJsonTab}
            />

            {/* 操作按钮行 */}
            <div className='flex flex-wrap items-center gap-3'>
              <Button
                type='button'
                onClick={handleApply}
                disabled={!!mergedError}
              >
                应用到表单
              </Button>
              <Button
                type='button'
                variant='outline'
                onClick={handleUndo}
                disabled={historyRef.current.length === 0}
              >
                <Undo2 className='mr-2 h-4 w-4' />
                撤销{historyRef.current.length > 0 ? ` (${historyRef.current.length})` : ''}
              </Button>
              <div className='ml-auto flex gap-3'>
                <Button onClick={form.handleSubmit(onSave)} disabled={isSaving}>
                  {isSaving ? t('Saving...') : t('Save model prices')}
                </Button>
                <Button type='button' variant='destructive' onClick={onReset} disabled={isResetting}>
                  {t('Reset prices')}
                </Button>
              </div>
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
