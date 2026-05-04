import { useEffect, useState, useCallback, useMemo } from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { JsonEditor } from '@/components/json-editor'
import { TagInput } from '@/components/tag-input'
import {
  useSystemOptions,
  getOptionValue,
} from '@/features/system-settings/hooks/use-system-options'
import { useUpdateOption } from '@/features/system-settings/hooks/use-update-option'
import { normalizeJsonString } from '@/features/system-settings/models/utils'
import type { ModelSettings } from '@/features/system-settings/types'
import { safeJsonParse } from '@/features/system-settings/utils/json-parser'
import { createModel, updateModel, getModel, getVendors } from '../../api'
import { getNameRuleOptions, ENDPOINT_TEMPLATES } from '../../constants'
import { modelsQueryKeys, vendorsQueryKeys, parseModelTags } from '../../lib'
import type { Model } from '../../types'

// Extended schema for ratio configuration (internal form state only)
const extendedModelFormSchema = z.object({
  id: z.number().optional(),
  model_name: z.string().min(1, 'Model name is required'),
  description: z.string(),
  icon: z.string(),
  tags: z.array(z.string()),
  vendor_id: z.number().optional(),
  endpoints: z.string(),
  name_rule: z.number(),
  status: z.boolean(),
  sync_official: z.boolean(),
  price: z.string().optional(),
  ratio: z.string().optional(),
  cacheRatio: z.string().optional(),
  completionRatio: z.string().optional(),
  imageRatio: z.string().optional(),
  audioRatio: z.string().optional(),
  audioCompletionRatio: z.string().optional(),
})

type ExtendedModelFormValues = z.infer<typeof extendedModelFormSchema>

type PricingMode = 'per-token' | 'per-request'
type PricingSubMode = 'ratio' | 'price'

type ModelMutateDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: Model | null
}

export function ModelMutateDrawer({
  open,
  onOpenChange,
  currentRow,
}: ModelMutateDrawerProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const isEditing = Boolean(currentRow?.id)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pricingMode, setPricingMode] = useState<PricingMode>('per-token')
  const [pricingSubMode, setPricingSubMode] = useState<PricingSubMode>('ratio')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [promptPrice, setPromptPrice] = useState('')
  const [completionPrice, setCompletionPrice] = useState('')
  const [oldModelName, setOldModelName] = useState<string>('')

  // Fetch vendors for dropdown
  const { data: vendorsData } = useQuery({
    queryKey: vendorsQueryKeys.list(),
    queryFn: () => getVendors({ page_size: 1000 }),
    enabled: open,
  })

  const vendors = vendorsData?.data?.items || []

  // Fetch model detail if editing
  const { data: modelData } = useQuery({
    queryKey: modelsQueryKeys.detail(currentRow?.id || 0),
    queryFn: () => getModel(currentRow!.id),
    enabled: open && isEditing,
  })

  // Fetch system options for ratio configuration
  const { data: systemOptionsData } = useSystemOptions()

  const updateOption = useUpdateOption()

  // Get model settings from system options
  const modelSettings = useMemo(() => {
    if (!systemOptionsData?.data) return null
    const defaultModelSettings: ModelSettings = {
      'global.pass_through_request_enabled': false,
      'global.thinking_model_blacklist': '[]',
      'global.chat_completions_to_responses_policy': '{}',
      'general_setting.ping_interval_enabled': false,
      'general_setting.ping_interval_seconds': 60,
      'gemini.safety_settings': '',
      'gemini.version_settings': '',
      'gemini.supported_imagine_models': '',
      'gemini.thinking_adapter_enabled': false,
      'gemini.thinking_adapter_budget_tokens_percentage': 0.6,
      'gemini.function_call_thought_signature_enabled': false,
      'gemini.remove_function_response_id_enabled': true,
      'claude.model_headers_settings': '',
      'claude.default_max_tokens': '',
      'claude.thinking_adapter_enabled': true,
      'claude.thinking_adapter_budget_tokens_percentage': 0.8,
      ModelPrice: '',
      ModelRatio: '',
      CacheRatio: '',
      CompletionRatio: '',
      ImageRatio: '',
      AudioRatio: '',
      AudioCompletionRatio: '',
      ExposeRatioEnabled: false,
      'billing_setting.billing_mode': '{}',
      'billing_setting.billing_expr': '{}',
      'tool_price_setting.prices': '{}',
      TopupGroupRatio: '',
      GroupRatio: '',
      UserUsableGroups: '',
      GroupGroupRatio: '',
      AutoGroups: '',
      DefaultUseAutoGroup: false,
      CreateCacheRatio: '',
      'group_ratio_setting.group_special_usable_group': '{}',
      'grok.violation_deduction_enabled': false,
      'grok.violation_deduction_amount': 0,
    }
    return getOptionValue(systemOptionsData.data, defaultModelSettings)
  }, [systemOptionsData])

  const form = useForm<ExtendedModelFormValues>({
    resolver: zodResolver(extendedModelFormSchema),
    defaultValues: {
      model_name: '',
      description: '',
      icon: '',
      tags: [],
      vendor_id: undefined,
      endpoints: '',
      name_rule: 0,
      status: true,
      sync_official: true,
      price: '',
      ratio: '',
      cacheRatio: '',
      completionRatio: '',
      imageRatio: '',
      audioRatio: '',
      audioCompletionRatio: '',
    },
  })

  const validateNumber = (value: string) => {
    if (value === '') return true
    return !isNaN(parseFloat(value))
  }

  const handlePromptPriceChange = (value: string) => {
    setPromptPrice(value)
    if (value && !isNaN(parseFloat(value))) {
      const ratio = parseFloat(value) / 2
      form.setValue('ratio', ratio.toString())
    } else {
      form.setValue('ratio', '')
    }
  }

  const handleCompletionPriceChange = (value: string) => {
    setCompletionPrice(value)
    if (
      value &&
      !isNaN(parseFloat(value)) &&
      promptPrice &&
      !isNaN(parseFloat(promptPrice)) &&
      parseFloat(promptPrice) > 0
    ) {
      const completionRatio = parseFloat(value) / parseFloat(promptPrice)
      form.setValue('completionRatio', completionRatio.toString())
    } else {
      form.setValue('completionRatio', '')
    }
  }

  // Load model data for editing and ratio configuration
  useEffect(() => {
    if (open && isEditing && modelData?.data) {
      const model = modelData.data
      setOldModelName(model.model_name)

      // Base model data reset
      const baseModelData = {
        id: model.id,
        model_name: model.model_name,
        description: model.description || '',
        icon: model.icon || '',
        tags: parseModelTags(model.tags),
        vendor_id: model.vendor_id,
        endpoints: model.endpoints || '',
        name_rule: model.name_rule || 0,
        status: model.status === 1,
        sync_official: model.sync_official === 1,
        price: '',
        ratio: '',
        cacheRatio: '',
        completionRatio: '',
        imageRatio: '',
        audioRatio: '',
        audioCompletionRatio: '',
      }

      // Parse ratio configurations from system settings if available
      if (modelSettings) {
        const priceMap = safeJsonParse<Record<string, number>>(
          modelSettings.ModelPrice,
          { fallback: {}, silent: true }
        )
        const ratioMap = safeJsonParse<Record<string, number>>(
          modelSettings.ModelRatio,
          { fallback: {}, silent: true }
        )
        const cacheMap = safeJsonParse<Record<string, number>>(
          modelSettings.CacheRatio,
          { fallback: {}, silent: true }
        )
        const completionMap = safeJsonParse<Record<string, number>>(
          modelSettings.CompletionRatio,
          { fallback: {}, silent: true }
        )
        const imageMap = safeJsonParse<Record<string, number>>(
          modelSettings.ImageRatio,
          { fallback: {}, silent: true }
        )
        const audioMap = safeJsonParse<Record<string, number>>(
          modelSettings.AudioRatio,
          { fallback: {}, silent: true }
        )
        const audioCompletionMap = safeJsonParse<Record<string, number>>(
          modelSettings.AudioCompletionRatio,
          { fallback: {}, silent: true }
        )

        // Extract ratio config for this model
        const modelName = model.model_name
        const price = priceMap[modelName]
        const ratio = ratioMap[modelName]
        const cacheRatio = cacheMap[modelName]
        const completionRatio = completionMap[modelName]
        const imageRatio = imageMap[modelName]
        const audioRatio = audioMap[modelName]
        const audioCompletionRatio = audioCompletionMap[modelName]

        // Determine pricing mode
        if (price !== undefined && price !== null) {
          setPricingMode('per-request')
          form.reset({
            ...baseModelData,
            price: price.toString(),
          })
        } else {
          setPricingMode('per-token')
          if (ratio !== undefined && ratio !== null) {
            const tokenPrice = ratio * 2
            setPromptPrice(tokenPrice.toString())
            if (completionRatio !== undefined && completionRatio !== null) {
              const compPrice = tokenPrice * completionRatio
              setCompletionPrice(compPrice.toString())
            }
          }
          form.reset({
            ...baseModelData,
            ratio: ratio?.toString() || '',
            cacheRatio: cacheRatio?.toString() || '',
            completionRatio: completionRatio?.toString() || '',
            imageRatio: imageRatio?.toString() || '',
            audioRatio: audioRatio?.toString() || '',
            audioCompletionRatio: audioCompletionRatio?.toString() || '',
          })
          setAdvancedOpen(
            !!(cacheRatio || imageRatio || audioRatio || audioCompletionRatio)
          )
        }
      } else {
        // If system settings not loaded yet, just load base model data
        setPricingMode('per-token')
        form.reset(baseModelData)
        setAdvancedOpen(false)
      }
    } else if (open && !isEditing) {
      // Pre-fill model name if passed from missing models
      setOldModelName('')
      setPricingMode('per-token')
      setPricingSubMode('ratio')
      setPromptPrice('')
      setCompletionPrice('')
      setAdvancedOpen(false)
      form.reset({
        model_name: currentRow?.model_name || '',
        description: '',
        icon: '',
        tags: [],
        vendor_id: undefined,
        endpoints: '',
        name_rule: 0,
        status: true,
        sync_official: true,
        price: '',
        ratio: '',
        cacheRatio: '',
        completionRatio: '',
        imageRatio: '',
        audioRatio: '',
        audioCompletionRatio: '',
      })
    }
  }, [open, isEditing, modelData, currentRow, form, modelSettings])

  const onSubmit = useCallback(
    async (values: ExtendedModelFormValues): Promise<void> => {
      setIsSubmitting(true)
      try {
        const submitData = {
          ...values,
          id: isEditing ? currentRow!.id : undefined,
          tags: Array.isArray(values.tags) ? values.tags.join(',') : '',
          status: values.status ? 1 : 0,
          sync_official: values.sync_official ? 1 : 0,
        }

        // Remove ratio fields from model data (they're stored in system settings)
        const {
          price,
          ratio,
          cacheRatio,
          completionRatio,
          imageRatio,
          audioRatio,
          audioCompletionRatio,
          ...modelData
        } = submitData

        const response = isEditing
          ? await updateModel({ ...modelData, id: currentRow!.id })
          : await createModel(modelData)

        if (response.success) {
          // Handle ratio configuration updates in system settings
          const finalModelName = values.model_name
          const hasRatioConfig =
            (pricingMode === 'per-request' &&
              values.price &&
              values.price !== '') ||
            (pricingMode === 'per-token' &&
              (values.ratio ||
                values.cacheRatio ||
                values.completionRatio ||
                values.imageRatio ||
                values.audioRatio ||
                values.audioCompletionRatio))

          // Always process system settings updates if we have modelSettings
          // This ensures we can remove stale entries even when clearing all pricing fields
          if (modelSettings) {
            // Read existing configurations
            const priceMap = safeJsonParse<Record<string, number>>(
              modelSettings.ModelPrice,
              { fallback: {}, silent: true }
            )
            const ratioMap = safeJsonParse<Record<string, number>>(
              modelSettings.ModelRatio,
              { fallback: {}, silent: true }
            )
            const cacheMap = safeJsonParse<Record<string, number>>(
              modelSettings.CacheRatio,
              { fallback: {}, silent: true }
            )
            const completionMap = safeJsonParse<Record<string, number>>(
              modelSettings.CompletionRatio,
              { fallback: {}, silent: true }
            )
            const imageMap = safeJsonParse<Record<string, number>>(
              modelSettings.ImageRatio,
              { fallback: {}, silent: true }
            )
            const audioMap = safeJsonParse<Record<string, number>>(
              modelSettings.AudioRatio,
              { fallback: {}, silent: true }
            )
            const audioCompletionMap = safeJsonParse<Record<string, number>>(
              modelSettings.AudioCompletionRatio,
              { fallback: {}, silent: true }
            )

            // Remove old model name entries if model name changed (always, even if no new config)
            if (isEditing && oldModelName && oldModelName !== finalModelName) {
              delete priceMap[oldModelName]
              delete ratioMap[oldModelName]
              delete cacheMap[oldModelName]
              delete completionMap[oldModelName]
              delete imageMap[oldModelName]
              delete audioMap[oldModelName]
              delete audioCompletionMap[oldModelName]
            }

            // Remove current model name from all maps first (always, to handle mode switches or clearing)
            // This ensures stale entries are removed even when user clears all fields
            delete priceMap[finalModelName]
            delete ratioMap[finalModelName]
            delete cacheMap[finalModelName]
            delete completionMap[finalModelName]
            delete imageMap[finalModelName]
            delete audioMap[finalModelName]
            delete audioCompletionMap[finalModelName]

            // Only add new entries if user provided new configuration
            if (hasRatioConfig) {
              if (
                pricingMode === 'per-request' &&
                values.price &&
                values.price !== ''
              ) {
                priceMap[finalModelName] = parseFloat(values.price)
              } else if (pricingMode === 'per-token') {
                if (values.ratio && values.ratio !== '') {
                  ratioMap[finalModelName] = parseFloat(values.ratio)
                }
                if (values.cacheRatio && values.cacheRatio !== '') {
                  cacheMap[finalModelName] = parseFloat(values.cacheRatio)
                }
                if (values.completionRatio && values.completionRatio !== '') {
                  completionMap[finalModelName] = parseFloat(
                    values.completionRatio
                  )
                }
                if (values.imageRatio && values.imageRatio !== '') {
                  imageMap[finalModelName] = parseFloat(values.imageRatio)
                }
                if (values.audioRatio && values.audioRatio !== '') {
                  audioMap[finalModelName] = parseFloat(values.audioRatio)
                }
                if (
                  values.audioCompletionRatio &&
                  values.audioCompletionRatio !== ''
                ) {
                  audioCompletionMap[finalModelName] = parseFloat(
                    values.audioCompletionRatio
                  )
                }
              }
            }

            // Update system options if there are changes
            const updates: Array<{ key: string; value: string }> = []

            const newModelPrice = normalizeJsonString(JSON.stringify(priceMap))
            if (
              newModelPrice !== normalizeJsonString(modelSettings.ModelPrice)
            ) {
              updates.push({ key: 'ModelPrice', value: newModelPrice })
            }

            const newModelRatio = normalizeJsonString(JSON.stringify(ratioMap))
            if (
              newModelRatio !== normalizeJsonString(modelSettings.ModelRatio)
            ) {
              updates.push({ key: 'ModelRatio', value: newModelRatio })
            }

            const newCacheRatio = normalizeJsonString(JSON.stringify(cacheMap))
            if (
              newCacheRatio !== normalizeJsonString(modelSettings.CacheRatio)
            ) {
              updates.push({ key: 'CacheRatio', value: newCacheRatio })
            }

            const newCompletionRatio = normalizeJsonString(
              JSON.stringify(completionMap)
            )
            if (
              newCompletionRatio !==
              normalizeJsonString(modelSettings.CompletionRatio)
            ) {
              updates.push({
                key: 'CompletionRatio',
                value: newCompletionRatio,
              })
            }

            const newImageRatio = normalizeJsonString(JSON.stringify(imageMap))
            if (
              newImageRatio !== normalizeJsonString(modelSettings.ImageRatio)
            ) {
              updates.push({ key: 'ImageRatio', value: newImageRatio })
            }

            const newAudioRatio = normalizeJsonString(JSON.stringify(audioMap))
            if (
              newAudioRatio !== normalizeJsonString(modelSettings.AudioRatio)
            ) {
              updates.push({ key: 'AudioRatio', value: newAudioRatio })
            }

            const newAudioCompletionRatio = normalizeJsonString(
              JSON.stringify(audioCompletionMap)
            )
            if (
              newAudioCompletionRatio !==
              normalizeJsonString(modelSettings.AudioCompletionRatio)
            ) {
              updates.push({
                key: 'AudioCompletionRatio',
                value: newAudioCompletionRatio,
              })
            }

            // Apply all updates (including deletions when clearing fields)
            for (const update of updates) {
              await updateOption.mutateAsync(update)
            }
          }

          toast.success(
            isEditing
              ? 'Model updated successfully'
              : 'Model created successfully'
          )
          queryClient.invalidateQueries({ queryKey: modelsQueryKeys.lists() })
          queryClient.invalidateQueries({ queryKey: ['system-options'] })
          onOpenChange(false)
        } else {
          toast.error(response.message || 'Operation failed')
        }
      } catch (error: unknown) {
        toast.error((error as Error)?.message || 'Operation failed')
      } finally {
        setIsSubmitting(false)
      }
    },
    [
      isEditing,
      currentRow,
      queryClient,
      onOpenChange,
      pricingMode,
      oldModelName,
      modelSettings,
      updateOption,
    ]
  )

  const handleFillEndpointTemplate = (templateKey: string) => {
    const template = ENDPOINT_TEMPLATES[templateKey]
    if (template) {
      const templateJson = JSON.stringify({ [templateKey]: template }, null, 2)
      form.setValue('endpoints', templateJson)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex h-dvh w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl'>
        <SheetHeader className='border-b px-4 py-3 text-start sm:px-6 sm:py-4'>
          <SheetTitle>
            {isEditing ? t('Edit Model') : t('Create Model')}
          </SheetTitle>
          <SheetDescription>
            {isEditing
              ? t("Update model configuration and click save when you're done.")
              : t(
                  'Add a new model to the system by providing the necessary information.'
                )}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            id='model-form'
            onSubmit={form.handleSubmit(
              onSubmit as Parameters<typeof form.handleSubmit>[0]
            )}
            className='flex-1 space-y-4 overflow-y-auto px-3 py-3 pb-4 sm:space-y-6 sm:px-4'
          >
            {/* Basic Information */}
            <div className='space-y-4'>
              <h3 className='text-sm font-semibold'>
                {t('Basic Information')}
              </h3>

              <FormField
                control={form.control}
                name='model_name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Model Name *')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('gpt-4, claude-3-opus, etc.')}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('The unique identifier for this model')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='description'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Description')}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t('Describe this model...')}
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='icon'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Icon')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('OpenAI, Anthropic, etc.')}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className='text-xs'>
                      {t('@lobehub/icons key')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='vendor_id'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Vendor')}</FormLabel>
                    <Select
                      onValueChange={(value) =>
                        field.onChange(value ? parseInt(value) : undefined)
                      }
                      value={field.value ? String(field.value) : undefined}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('Select vendor')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vendors.map((vendor) => (
                          <SelectItem key={vendor.id} value={String(vendor.id)}>
                            {vendor.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='tags'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Tags')}</FormLabel>
                    <FormControl>
                      <TagInput
                        value={field.value || []}
                        onChange={field.onChange}
                        placeholder={t('Add tags...')}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Press Enter or comma to add tags')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Matching Configuration */}
            <div className='space-y-4'>
              <h3 className='text-sm font-semibold'>{t('Matching Rules')}</h3>

              <FormField
                control={form.control}
                name='name_rule'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Name Rule')}</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={(value) =>
                          field.onChange(parseInt(value))
                        }
                        value={String(field.value)}
                        className='grid grid-cols-2 gap-4'
                      >
                        {getNameRuleOptions(t).map((option) => (
                          <div
                            key={option.value}
                            className='flex items-center space-x-2'
                          >
                            <RadioGroupItem
                              value={String(option.value)}
                              id={`rule-${option.value}`}
                            />
                            <Label
                              htmlFor={`rule-${option.value}`}
                              className='cursor-pointer font-normal'
                            >
                              {option.label}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormDescription>
                      {t('How this model name should match requests')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Endpoints Configuration */}
            <div className='space-y-4'>
              <div className='flex items-center justify-between'>
                <h3 className='text-sm font-semibold'>{t('Endpoints')}</h3>
                <Select onValueChange={handleFillEndpointTemplate}>
                  <SelectTrigger size='sm' className='w-[200px]'>
                    <SelectValue placeholder={t('Load template...')} />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(ENDPOINT_TEMPLATES).map((key) => (
                      <SelectItem key={key} value={key}>
                        {key}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <FormField
                control={form.control}
                name='endpoints'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Endpoint Configuration')}</FormLabel>
                    <FormControl>
                      <JsonEditor
                        value={field.value || ''}
                        onChange={field.onChange}
                        keyPlaceholder='endpoint_type'
                        valuePlaceholder='{"path": "/v1/...", "method": "POST"}'
                        keyLabel='Endpoint Type'
                        valueLabel='Configuration'
                        valueType='any'
                        emptyMessage={t(
                          'No endpoints configured. Switch to JSON mode or add rows to define endpoints.'
                        )}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Define API endpoints for this model (JSON format)')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Pricing Configuration */}
            <div className='space-y-4'>
              <h3 className='text-sm font-semibold'>
                {t('Pricing Configuration')}
              </h3>

              <div className='space-y-4'>
                <Label>{t('Pricing mode')}</Label>
                <RadioGroup
                  value={pricingMode}
                  onValueChange={(value) =>
                    setPricingMode(value as PricingMode)
                  }
                >
                  <div className='flex items-center space-x-2'>
                    <RadioGroupItem value='per-token' id='per-token' />
                    <Label htmlFor='per-token' className='font-normal'>
                      {t('Per-token (ratio based)')}
                    </Label>
                  </div>
                  <div className='flex items-center space-x-2'>
                    <RadioGroupItem value='per-request' id='per-request' />
                    <Label htmlFor='per-request' className='font-normal'>
                      {t('Per-request (fixed price)')}
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {pricingMode === 'per-request' ? (
                <FormField
                  control={form.control}
                  name='price'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Fixed price (USD)')}</FormLabel>
                      <FormControl>
                        <Input
                          type='text'
                          placeholder='0.01'
                          {...field}
                          onChange={(e) => {
                            const value = e.target.value
                            if (validateNumber(value)) {
                              field.onChange(value)
                            }
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          'Cost in USD per request, regardless of tokens used.'
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <>
                  <div className='space-y-4'>
                    <Label>{t('Input mode')}</Label>
                    <RadioGroup
                      value={pricingSubMode}
                      onValueChange={(value) =>
                        setPricingSubMode(value as PricingSubMode)
                      }
                    >
                      <div className='flex items-center space-x-2'>
                        <RadioGroupItem value='ratio' id='ratio' />
                        <Label htmlFor='ratio' className='font-normal'>
                          {t('Ratio mode')}
                        </Label>
                      </div>
                      <div className='flex items-center space-x-2'>
                        <RadioGroupItem value='price' id='price' />
                        <Label htmlFor='price' className='font-normal'>
                          {t('Price mode (USD per 1M tokens)')}
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {pricingSubMode === 'ratio' ? (
                    <>
                      <FormField
                        control={form.control}
                        name='ratio'
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('Model ratio')}</FormLabel>
                            <FormControl>
                              <Input
                                type='text'
                                placeholder='1.0'
                                {...field}
                                onChange={(e) => {
                                  const value = e.target.value
                                  if (validateNumber(value)) {
                                    field.onChange(value)
                                    if (value) {
                                      setPromptPrice(
                                        (parseFloat(value) * 2).toString()
                                      )
                                    } else {
                                      setPromptPrice('')
                                    }
                                  }
                                }}
                              />
                            </FormControl>
                            <FormDescription>
                              {field.value && !isNaN(parseFloat(field.value))
                                ? `Calculated price: $${(parseFloat(field.value) * 2).toFixed(4)} per 1M tokens`
                                : t('Multiplier for prompt tokens.')}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name='completionRatio'
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('Completion ratio')}</FormLabel>
                            <FormControl>
                              <Input
                                type='text'
                                placeholder='1.0'
                                {...field}
                                onChange={(e) => {
                                  const value = e.target.value
                                  if (validateNumber(value)) {
                                    field.onChange(value)
                                    const ratio = form.getValues('ratio')
                                    if (value && ratio) {
                                      const compPrice =
                                        parseFloat(ratio) *
                                        2 *
                                        parseFloat(value)
                                      setCompletionPrice(compPrice.toString())
                                    } else {
                                      setCompletionPrice('')
                                    }
                                  }
                                }}
                              />
                            </FormControl>
                            <FormDescription>
                              {field.value &&
                              !isNaN(parseFloat(field.value)) &&
                              promptPrice &&
                              !isNaN(parseFloat(promptPrice))
                                ? `Calculated price: $${(parseFloat(promptPrice) * parseFloat(field.value)).toFixed(4)} per 1M tokens`
                                : t('Multiplier for completion tokens.')}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  ) : (
                    <>
                      <div className='space-y-4'>
                        <div className='space-y-2'>
                          <Label>{t('Prompt price ($/1M tokens)')}</Label>
                          <Input
                            type='text'
                            placeholder='2.0'
                            value={promptPrice}
                            onChange={(e) =>
                              handlePromptPriceChange(e.target.value)
                            }
                          />
                          <p className='text-muted-foreground text-sm'>
                            {promptPrice && !isNaN(parseFloat(promptPrice))
                              ? `Calculated ratio: ${(parseFloat(promptPrice) / 2).toFixed(4)}`
                              : t('Enter Input price to calculate ratio')}
                          </p>
                        </div>

                        <div className='space-y-2'>
                          <Label>{t('Completion price ($/1M tokens)')}</Label>
                          <Input
                            type='text'
                            placeholder='4.0'
                            value={completionPrice}
                            onChange={(e) =>
                              handleCompletionPriceChange(e.target.value)
                            }
                          />
                          <p className='text-muted-foreground text-sm'>
                            {completionPrice &&
                            !isNaN(parseFloat(completionPrice)) &&
                            promptPrice &&
                            !isNaN(parseFloat(promptPrice)) &&
                            parseFloat(promptPrice) > 0
                              ? `Calculated ratio: ${(parseFloat(completionPrice) / parseFloat(promptPrice)).toFixed(4)}`
                              : t('Enter Completion price to calculate ratio')}
                          </p>
                        </div>
                      </div>
                    </>
                  )}

                  <Collapsible
                    open={advancedOpen}
                    onOpenChange={setAdvancedOpen}
                  >
                    <CollapsibleTrigger asChild>
                      <Button
                        type='button'
                        variant='outline'
                        className='flex w-full items-center justify-between'
                      >
                        {t('Advanced options')}
                        <ChevronDown
                          className={`h-4 w-4 transition-transform duration-200 ${
                            advancedOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className='space-y-6 pt-6'>
                      <FormField
                        control={form.control}
                        name='cacheRatio'
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('Cache ratio')}</FormLabel>
                            <FormControl>
                              <Input
                                type='text'
                                placeholder='0.1'
                                {...field}
                                onChange={(e) => {
                                  const value = e.target.value
                                  if (validateNumber(value)) {
                                    field.onChange(value)
                                  }
                                }}
                              />
                            </FormControl>
                            <FormDescription>
                              {t('Discount ratio for cache hits.')}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name='imageRatio'
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('Image ratio')}</FormLabel>
                            <FormControl>
                              <Input
                                type='text'
                                placeholder='1.0'
                                {...field}
                                onChange={(e) => {
                                  const value = e.target.value
                                  if (validateNumber(value)) {
                                    field.onChange(value)
                                  }
                                }}
                              />
                            </FormControl>
                            <FormDescription>
                              {t('Multiplier for image processing.')}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name='audioRatio'
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('Audio ratio')}</FormLabel>
                            <FormControl>
                              <Input
                                type='text'
                                placeholder='1.0'
                                {...field}
                                onChange={(e) => {
                                  const value = e.target.value
                                  if (validateNumber(value)) {
                                    field.onChange(value)
                                  }
                                }}
                              />
                            </FormControl>
                            <FormDescription>
                              {t('Multiplier for audio inputs.')}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name='audioCompletionRatio'
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('Audio completion ratio')}</FormLabel>
                            <FormControl>
                              <Input
                                type='text'
                                placeholder='1.0'
                                {...field}
                                onChange={(e) => {
                                  const value = e.target.value
                                  if (validateNumber(value)) {
                                    field.onChange(value)
                                  }
                                }}
                              />
                            </FormControl>
                            <FormDescription>
                              {t('Multiplier for audio outputs.')}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CollapsibleContent>
                  </Collapsible>
                </>
              )}
            </div>

            <Separator />

            {/* Status & Sync */}
            <div className='space-y-4'>
              <h3 className='text-sm font-semibold'>{t('Status & Sync')}</h3>

              <FormField
                control={form.control}
                name='status'
                render={({ field }) => (
                  <FormItem className='flex items-center justify-between rounded-lg border p-4'>
                    <div className='space-y-0.5'>
                      <FormLabel className='text-base'>
                        {t('Enabled')}
                      </FormLabel>
                      <FormDescription>
                        {t('Enable or disable this model')}
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

              <FormField
                control={form.control}
                name='sync_official'
                render={({ field }) => (
                  <FormItem className='flex items-center justify-between rounded-lg border p-4'>
                    <div className='space-y-0.5'>
                      <FormLabel className='text-base'>
                        {t('Official Sync')}
                      </FormLabel>
                      <FormDescription>
                        {t('Sync this model with official upstream')}
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
            </div>
          </form>
        </Form>

        <SheetFooter className='grid grid-cols-2 gap-2 border-t px-4 py-3 sm:flex sm:px-6 sm:py-4'>
          <SheetClose asChild>
            <Button variant='outline' disabled={isSubmitting}>
              {t('Cancel')}
            </Button>
          </SheetClose>
          <Button form='model-form' type='submit' disabled={isSubmitting}>
            {isSubmitting && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {isEditing ? t('Update Model') : t('Save changes')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
