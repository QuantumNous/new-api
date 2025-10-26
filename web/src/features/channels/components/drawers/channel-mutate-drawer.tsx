import { useEffect, useState, useMemo, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Loader2,
  Sparkles,
  Trash2,
  Copy,
  FileText,
  Eraser,
  Plus,
} from 'lucide-react'
import { toast } from 'sonner'
import { getLobeIcon } from '@/lib/lobe-icon'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { JsonEditor } from '@/components/json-editor'
import { MultiSelect } from '@/components/multi-select'
import {
  createChannel,
  fetchModels,
  getAllModels,
  getChannel,
  getGroups,
  getPrefillGroups,
  updateChannel,
} from '../../api'
import {
  ADD_MODE_OPTIONS,
  CHANNEL_TYPE_OPTIONS,
  CHANNEL_TYPE_WARNINGS,
  ERROR_MESSAGES,
  FIELD_DESCRIPTIONS,
  FIELD_PLACEHOLDERS,
  MODEL_FETCHABLE_TYPES,
  SUCCESS_MESSAGES,
} from '../../constants'
import {
  CHANNEL_FORM_DEFAULT_VALUES,
  channelFormSchema,
  channelsQueryKeys,
  transformChannelToFormDefaults,
  transformFormDataToCreatePayload,
  transformFormDataToUpdatePayload,
  type ChannelFormValues,
} from '../../lib'
import {
  deduplicateKeys,
  getChannelTypeIcon,
  getKeyPromptForType,
} from '../../lib/channel-utils'
import type { Channel } from '../../types'
import { useChannels } from '../channels-provider'
import { FetchModelsDialog } from '../dialogs/fetch-models-dialog'
import { ModelMappingEditor } from '../model-mapping-editor'

type ChannelMutateDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: Channel | null
}

// Helper functions for model operations
const parseModelsString = (modelsStr: string): string[] => {
  return modelsStr
    ? modelsStr
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean)
    : []
}

const formatModelsArray = (models: string[]): string => {
  return Array.from(new Set(models)).join(',')
}

export function ChannelMutateDrawer({
  open,
  onOpenChange,
  currentRow,
}: ChannelMutateDrawerProps) {
  const queryClient = useQueryClient()
  const { setOpen } = useChannels()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [customModel, setCustomModel] = useState('')
  const [isFetchingModels, setIsFetchingModels] = useState(false)
  const [fetchModelsDialogOpen, setFetchModelsDialogOpen] = useState(false)

  const isEditing = Boolean(currentRow)

  // Fetch channel details if editing
  const { data: channelData } = useQuery({
    queryKey: channelsQueryKeys.detail(currentRow?.id || 0),
    queryFn: () => getChannel(currentRow!.id),
    enabled: isEditing && Boolean(currentRow?.id),
  })

  // Fetch available groups
  const { data: groupsData, isLoading: isLoadingGroups } = useQuery({
    queryKey: ['groups'],
    queryFn: getGroups,
  })

  // Fetch all available models
  const { data: allModelsData } = useQuery({
    queryKey: ['channel_models'],
    queryFn: getAllModels,
  })

  // Fetch prefill model groups
  const { data: prefillGroupsData } = useQuery({
    queryKey: ['prefill_groups', 'model'],
    queryFn: () => getPrefillGroups('model'),
  })

  // Check if this is a multi-key channel
  const isMultiKeyChannel =
    isEditing && channelData?.data?.channel_info?.is_multi_key === true

  // Form setup
  const form = useForm<ChannelFormValues>({
    resolver: zodResolver(channelFormSchema),
    defaultValues: CHANNEL_FORM_DEFAULT_VALUES,
  })

  // Watch form values for conditional rendering
  const multiKeyMode = form.watch('multi_key_mode')
  const multiKeyType = form.watch('multi_key_type')
  const keyMode = form.watch('key_mode')
  const currentGroups = form.watch('group')
  const currentType = form.watch('type')
  const currentBaseUrl = form.watch('base_url')
  const currentModels = form.watch('models')

  // Helper computed values
  const isBatchMode =
    multiKeyMode === 'batch' || multiKeyMode === 'multi_to_single'

  // Get all models list
  const allModelsList = useMemo(
    () => allModelsData?.data?.map((model) => model.id).filter(Boolean) || [],
    [allModelsData]
  )

  // Get basic models for the current channel type
  const basicModels = useMemo(() => {
    if (!allModelsList.length) return []
    // Filter models based on common patterns for specific types
    if (currentType === 1) {
      return allModelsList.filter(
        (model) => model.startsWith('gpt-') || model.startsWith('text-')
      )
    }
    return allModelsList
  }, [allModelsList, currentType])

  // Get prefill groups
  const prefillGroups = useMemo(
    () => prefillGroupsData?.data || [],
    [prefillGroupsData]
  )

  // Transform groups to multi-select options
  const groupOptions = useMemo(() => {
    if (!groupsData?.data) return []
    const allGroups = new Set([...groupsData.data, ...(currentGroups || [])])
    return Array.from(allGroups).map((group) => ({
      value: group,
      label: group,
    }))
  }, [groupsData, currentGroups])

  // Parse current models as array
  const currentModelsArray = useMemo(
    () => parseModelsString(currentModels),
    [currentModels]
  )

  // Transform models to multi-select options
  const modelOptions = useMemo(() => {
    const allModels = new Set([...allModelsList, ...currentModelsArray])
    return Array.from(allModels).map((model) => ({
      value: model,
      label: model,
    }))
  }, [allModelsList, currentModelsArray])

  // Load channel data into form when editing
  useEffect(() => {
    if (isEditing && channelData?.data) {
      const defaults = transformChannelToFormDefaults(channelData.data)
      form.reset(defaults)
    } else if (!isEditing) {
      form.reset(CHANNEL_FORM_DEFAULT_VALUES)
    }
  }, [isEditing, channelData, form])

  // Handle type change - set default values for specific types
  useEffect(() => {
    if (isEditing) return // Don't auto-set defaults when editing

    // Type 45 (VolcEngine) - set default base_url
    if (currentType === 45) {
      const currentBaseUrlValue = form.getValues('base_url')
      if (!currentBaseUrlValue || currentBaseUrlValue === '') {
        form.setValue('base_url', 'https://ark.cn-beijing.volces.com')
      }
    }

    // Type 18 (Xunfei) - set default other (version)
    if (currentType === 18) {
      const currentOther = form.getValues('other')
      if (!currentOther || currentOther === '') {
        form.setValue('other', 'v2.1')
      }
    }
  }, [currentType, isEditing, form])

  // Validate base_url - warn if it ends with /v1
  useEffect(() => {
    if (!currentBaseUrl || !currentBaseUrl.endsWith('/v1')) return

    // Show warning toast
    const timer = setTimeout(() => {
      toast.warning(
        'Warning: Base URL should not end with /v1. New API will handle it automatically. This may cause request failures.',
        { duration: 5000 }
      )
    }, 500)

    return () => clearTimeout(timer)
  }, [currentBaseUrl])

  // Handle key deduplication
  const handleDeduplicateKeys = () => {
    const currentKey = form.getValues('key')
    if (!currentKey || currentKey.trim() === '') {
      toast.info('Please enter keys first')
      return
    }

    const result = deduplicateKeys(currentKey)

    if (result.removedCount === 0) {
      toast.info('No duplicate keys found')
    } else {
      form.setValue('key', result.deduplicatedText)
      toast.success(
        `Removed ${result.removedCount} duplicate key(s). Before: ${result.beforeCount}, After: ${result.afterCount}`
      )
    }
  }

  // Unified function to update models
  const updateModels = useCallback(
    (newModels: string[], merge: boolean = false) => {
      const finalModels = merge
        ? formatModelsArray([...currentModelsArray, ...newModels])
        : formatModelsArray(newModels)
      form.setValue('models', finalModels)
      return newModels.length
    },
    [currentModelsArray, form]
  )

  // Handle fetching models from upstream
  const handleFetchModels = useCallback(async () => {
    const type = form.getValues('type')

    if (!MODEL_FETCHABLE_TYPES.has(type)) {
      toast.error('This channel type does not support fetching models')
      return
    }

    // For editing mode, open FetchModelsDialog to let user select
    if (isEditing && currentRow) {
      setFetchModelsDialogOpen(true)
      return
    }

    // For creation mode, fetch and fill all models
    const key = form.getValues('key')
    if (!key?.trim()) {
      toast.error('Please enter API key first')
      return
    }

    setIsFetchingModels(true)
    try {
      const response = await fetchModels({
        type,
        key,
        base_url: form.getValues('base_url') || '',
      })

      if (response.success && response.data) {
        updateModels(response.data, true)
        toast.success(`Fetched ${response.data.length} model(s) from upstream`)
      } else {
        toast.error('No models fetched from upstream')
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to fetch models')
    } finally {
      setIsFetchingModels(false)
    }
  }, [isEditing, currentRow, form, updateModels])

  // Handle adding custom models
  const handleAddCustomModels = useCallback(() => {
    if (!customModel?.trim()) return

    const modelArray = parseModelsString(customModel)
    const count = updateModels(modelArray, true)
    setCustomModel('')
    toast.success(`Added ${count} custom model(s)`)
  }, [customModel, updateModels])

  // Handle model operations
  const handleFillRelatedModels = useCallback(() => {
    if (!basicModels.length) {
      toast.info('No related models available for this channel type')
      return
    }
    updateModels(basicModels)
    toast.success(`Filled ${basicModels.length} related model(s)`)
  }, [basicModels, updateModels])

  const handleFillAllModels = useCallback(() => {
    if (!allModelsList.length) {
      toast.info('No models available')
      return
    }
    updateModels(allModelsList)
    toast.success(`Filled ${allModelsList.length} model(s)`)
  }, [allModelsList, updateModels])

  const handleClearModels = useCallback(() => {
    form.setValue('models', '')
    toast.success('Cleared all models')
  }, [form])

  const handleCopyModels = useCallback(() => {
    const models = form.getValues('models')
    if (!models?.trim()) {
      toast.info('No models to copy')
      return
    }
    navigator.clipboard.writeText(models)
    toast.success('Models copied to clipboard')
  }, [form])

  // Handle adding prefill group models
  const handleAddPrefillGroup = useCallback(
    (group: { id: number; name: string; items: string | string[] }) => {
      try {
        const items = Array.isArray(group.items)
          ? group.items
          : JSON.parse(group.items)

        if (!Array.isArray(items)) {
          throw new Error('Invalid items format')
        }

        const count = updateModels(items, true)
        toast.success(`Added ${count} models from "${group.name}"`)
      } catch {
        toast.error('Failed to parse group items')
      }
    },
    [updateModels]
  )

  // Handle model selection change from MultiSelect
  const handleModelsChange = useCallback(
    (selected: string[]) => {
      form.setValue('models', selected.join(','))
    },
    [form]
  )

  // Handle successful submission
  const handleSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: channelsQueryKeys.lists() })
    onOpenChange(false)
    setOpen(null)
  }, [queryClient, onOpenChange, setOpen])

  // Submit handler
  const onSubmit = useCallback(
    async (data: ChannelFormValues) => {
      // Validate key is required when creating
      if (!isEditing && !data.key?.trim()) {
        form.setError('key', {
          type: 'manual',
          message: 'API key is required',
        })
        return
      }

      setIsSubmitting(true)
      try {
        if (isEditing && currentRow) {
          // Update existing channel
          let payload = transformFormDataToUpdatePayload(data, currentRow.id)

          // Add key_mode for multi-key channels
          if (isMultiKeyChannel && data.key_mode) {
            payload = { ...payload, key_mode: data.key_mode } as any
          }

          const response = await updateChannel(currentRow.id, payload)
          if (response.success) {
            toast.success(SUCCESS_MESSAGES.UPDATED)
            handleSuccess()
          }
        } else {
          // Create new channel(s)
          const payload = transformFormDataToCreatePayload(data)
          const response = await createChannel(payload)
          if (response.success) {
            toast.success(SUCCESS_MESSAGES.CREATED)
            handleSuccess()
          }
        }
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message || ERROR_MESSAGES.CREATE_FAILED
        )
      } finally {
        setIsSubmitting(false)
      }
    },
    [isEditing, currentRow, isMultiKeyChannel, form, handleSuccess]
  )

  // Handle drawer close
  const handleOpenChange = useCallback(
    (v: boolean) => {
      onOpenChange(v)
      if (!v) {
        form.reset(CHANNEL_FORM_DEFAULT_VALUES)
      }
    },
    [onOpenChange, form]
  )

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent className='flex w-full flex-col sm:max-w-2xl'>
          <SheetHeader className='text-start'>
            <SheetTitle>
              {isEditing ? 'Edit Channel' : 'Create Channel'}
            </SheetTitle>
            <SheetDescription>
              {isEditing
                ? 'Update channel configuration and click save when you&apos;re done.'
                : 'Add a new channel by providing the necessary information.'}
            </SheetDescription>
          </SheetHeader>

          <Form {...form}>
            <form
              id='channel-form'
              onSubmit={form.handleSubmit(onSubmit)}
              className='flex-1 space-y-6 overflow-y-auto px-4'
            >
              {/* Basic Info Section */}
              <div className='space-y-4'>
                <h3 className='text-sm font-semibold'>Basic Information</h3>

                <FormField
                  control={form.control}
                  name='name'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={FIELD_PLACEHOLDERS.NAME}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {FIELD_DESCRIPTIONS.NAME}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='type'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type *</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(Number(value))}
                        value={String(field.value)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder='Select channel type' />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CHANNEL_TYPE_OPTIONS.map((option) => (
                            <SelectItem
                              key={option.value}
                              value={String(option.value)}
                            >
                              <div className='flex items-center gap-2'>
                                {getLobeIcon(
                                  `${getChannelTypeIcon(option.value)}.Color`,
                                  16
                                )}
                                <span>{option.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {FIELD_DESCRIPTIONS.TYPE}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='status'
                  render={({ field }) => (
                    <FormItem className='flex items-center justify-between rounded-lg border p-4'>
                      <div className='space-y-0.5'>
                        <FormLabel className='text-base'>Enabled</FormLabel>
                        <FormDescription>
                          Enable or disable this channel
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value === 1}
                          onCheckedChange={(checked) =>
                            field.onChange(checked ? 1 : 2)
                          }
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* OpenAI Organization - only for type 1 */}
                {currentType === 1 && (
                  <FormField
                    control={form.control}
                    name='openai_organization'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>OpenAI Organization</FormLabel>
                        <FormControl>
                          <Input placeholder='org-...' {...field} />
                        </FormControl>
                        <FormDescription>
                          {FIELD_DESCRIPTIONS.OPENAI_ORG}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <Separator />

              {/* Type-Specific Settings Section - Moved up for better UX */}
              <div className='space-y-4'>
                <h3 className='text-sm font-semibold'>
                  Type-Specific Settings
                </h3>

                {/* Show warning if applicable */}
                {CHANNEL_TYPE_WARNINGS[currentType] && (
                  <Alert>
                    <AlertDescription>
                      {CHANNEL_TYPE_WARNINGS[currentType]}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Azure (type 3) */}
                {currentType === 3 && (
                  <>
                    <FormField
                      control={form.control}
                      name='base_url'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>AZURE_OPENAI_ENDPOINT *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder='e.g., https://docs-test-001.openai.azure.com'
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Your Azure OpenAI endpoint URL
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name='other'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Default API Version *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder='e.g., 2025-04-01-preview'
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Default API version for this channel
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name='azure_responses_version'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Responses API Version</FormLabel>
                          <FormControl>
                            <Input placeholder='e.g., preview' {...field} />
                          </FormControl>
                          <FormDescription>
                            Default Responses API version, if empty, will use
                            the API version above
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                {/* Custom (type 8) */}
                {currentType === 8 && (
                  <FormField
                    control={form.control}
                    name='base_url'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Full Base URL (supports {'{'}model{'}'} variable) *
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder='e.g., https://api.openai.com/v1/chat/completions'
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Enter the complete URL, supports {'{'}model{'}'}{' '}
                          variable
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Xunfei/Spark (type 18) */}
                {currentType === 18 && (
                  <FormField
                    control={form.control}
                    name='other'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Model Version *</FormLabel>
                        <FormControl>
                          <Input placeholder='e.g., v2.1' {...field} />
                        </FormControl>
                        <FormDescription>
                          Spark model version, e.g., v2.1 (version number in API
                          URL)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* OpenRouter (type 20) */}
                {currentType === 20 && (
                  <FormField
                    control={form.control}
                    name='is_enterprise_account'
                    render={({ field }) => (
                      <FormItem className='flex items-center justify-between rounded-lg border p-4'>
                        <div className='space-y-0.5'>
                          <FormLabel className='text-base'>
                            Enterprise Account
                          </FormLabel>
                          <FormDescription>
                            Enable if this is an OpenRouter enterprise account
                            with special response format
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
                )}

                {/* AI Proxy Library (type 21) */}
                {currentType === 21 && (
                  <FormField
                    control={form.control}
                    name='other'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Knowledge Base ID *</FormLabel>
                        <FormControl>
                          <Input placeholder='e.g., 123456' {...field} />
                        </FormControl>
                        <FormDescription>
                          Enter the knowledge base ID
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* FastGPT (type 22) */}
                {currentType === 22 && (
                  <FormField
                    control={form.control}
                    name='base_url'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Private Deployment URL</FormLabel>
                        <FormControl>
                          <Input
                            placeholder='e.g., https://fastgpt.run/api/openapi'
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          For private deployments, format:
                          https://fastgpt.run/api/openapi
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* SunoAPI (type 36) */}
                {currentType === 36 && (
                  <FormField
                    control={form.control}
                    name='base_url'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          API Base URL (Important: Not Chat API) *
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder='e.g., https://api.example.com (path before /suno)'
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Enter the path before /suno, usually just the domain
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Cloudflare Workers AI (type 39) */}
                {currentType === 39 && (
                  <FormField
                    control={form.control}
                    name='other'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account ID *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder='e.g., d6b5da8hk1awo8nap34ube6gh'
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Your Cloudflare Account ID
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* SiliconFlow (type 40) */}
                {currentType === 40 && (
                  <Alert>
                    <AlertDescription>
                      Referral link:{' '}
                      <a
                        href='https://cloud.siliconflow.cn/i/hij0YNTZ'
                        target='_blank'
                        rel='noopener noreferrer'
                        className='text-primary underline'
                      >
                        https://cloud.siliconflow.cn/i/hij0YNTZ
                      </a>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Vertex AI (type 41) */}
                {currentType === 41 && (
                  <>
                    <FormField
                      control={form.control}
                      name='vertex_key_type'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vertex AI Key Format</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value='json'>JSON</SelectItem>
                              <SelectItem value='api_key'>API Key</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            {field.value === 'json'
                              ? 'JSON format supports service account JSON files'
                              : 'API Key mode (does not support batch creation)'}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name='other'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Deployment Region *</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder='e.g., us-central1 or JSON format for model-specific regions'
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Enter deployment region or JSON mapping: {'{'}
                            "default": "us-central1",
                            "claude-3-5-sonnet-20240620": "europe-west1"{'}'}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                {/* VolcEngine (type 45) */}
                {currentType === 45 && (
                  <FormField
                    control={form.control}
                    name='base_url'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>API Base URL *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={
                            field.value || 'https://ark.cn-beijing.volces.com'
                          }
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value='https://ark.cn-beijing.volces.com'>
                              https://ark.cn-beijing.volces.com
                            </SelectItem>
                            <SelectItem value='https://ark.ap-southeast.bytepluses.com'>
                              https://ark.ap-southeast.bytepluses.com
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Select the API endpoint region
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Coze (type 49) */}
                {currentType === 49 && (
                  <FormField
                    control={form.control}
                    name='other'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Agent ID *</FormLabel>
                        <FormControl>
                          <Input placeholder='e.g., 7342866812345' {...field} />
                        </FormControl>
                        <FormDescription>
                          Enter the Coze agent ID
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* General base_url for other types */}
                {![3, 8, 22, 36, 45].includes(currentType) && (
                  <FormField
                    control={form.control}
                    name='base_url'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Base URL</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={FIELD_PLACEHOLDERS.BASE_URL}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Custom API base URL. For official channels, New API
                          has built-in addresses. Only fill this for third-party
                          proxy sites or special endpoints. Do not add /v1 or
                          trailing slash.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Show message if no type-specific settings */}
                {![3, 8, 18, 20, 21, 22, 36, 39, 40, 41, 45, 49].includes(
                  currentType
                ) && (
                  <p className='text-muted-foreground text-sm'>
                    No additional type-specific settings for this channel type.
                  </p>
                )}
              </div>

              <Separator />

              {/* Authentication Section */}
              <div className='space-y-4'>
                <h3 className='text-sm font-semibold'>Authentication</h3>

                {!isEditing && (
                  <FormField
                    control={form.control}
                    name='multi_key_mode'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Add Mode</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ADD_MODE_OPTIONS.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          {FIELD_DESCRIPTIONS.BATCH_ADD}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name='key'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>API Key *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={
                            isEditing
                              ? 'Leave empty to keep existing key'
                              : isBatchMode
                                ? 'Enter one key per line for batch creation'
                                : getKeyPromptForType(currentType)
                          }
                          rows={isBatchMode ? 8 : 4}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        <div className='flex flex-col gap-2'>
                          <span>
                            {isEditing ? (
                              <>
                                Enter new key to update, or leave empty to keep
                                current key
                                {isMultiKeyChannel && (
                                  <span className='text-warning mt-1 block'>
                                    Multi-key channel: Keys will be{' '}
                                    {keyMode === 'replace'
                                      ? 'replaced'
                                      : 'appended'}
                                  </span>
                                )}
                              </>
                            ) : isBatchMode ? (
                              'Enter one API key per line for batch creation'
                            ) : (
                              FIELD_DESCRIPTIONS.KEY
                            )}
                          </span>
                          {isBatchMode && (
                            <Button
                              type='button'
                              variant='outline'
                              size='sm'
                              onClick={handleDeduplicateKeys}
                              className='w-fit'
                            >
                              <Trash2 className='mr-2 h-4 w-4' />
                              Remove Duplicates
                            </Button>
                          )}
                        </div>
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {isEditing && isMultiKeyChannel && (
                  <FormField
                    control={form.control}
                    name='key_mode'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Key Update Mode</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value='append'>
                              Append to existing keys
                            </SelectItem>
                            <SelectItem value='replace'>
                              Replace all existing keys
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          {field.value === 'replace'
                            ? 'Replace mode: Will completely replace all existing keys'
                            : 'Append mode: New keys will be added to the end of the existing key list'}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {!isEditing && multiKeyMode === 'multi_to_single' && (
                  <FormField
                    control={form.control}
                    name='multi_key_type'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Multi-Key Strategy</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value='random'>Random</SelectItem>
                            <SelectItem value='polling'>Polling</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          {multiKeyType === 'polling' ? (
                            <span className='text-warning'>
                              Polling mode requires Redis and memory cache,
                              otherwise performance will be significantly
                              degraded
                            </span>
                          ) : (
                            'Randomly select a key from the pool for each request'
                          )}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <Separator />

              {/* Models & Groups Section */}
              <div className='space-y-4'>
                <h3 className='text-sm font-semibold'>Models & Groups</h3>

                <FormField
                  control={form.control}
                  name='models'
                  render={() => (
                    <FormItem>
                      <FormLabel>Models *</FormLabel>
                      <FormControl>
                        <MultiSelect
                          options={modelOptions}
                          selected={currentModelsArray}
                          onChange={handleModelsChange}
                          placeholder='Select models or add custom ones'
                        />
                      </FormControl>
                      <FormDescription>
                        <div className='flex flex-col gap-2'>
                          <span>{FIELD_DESCRIPTIONS.MODELS}</span>
                          <div className='flex flex-wrap gap-2'>
                            <Button
                              type='button'
                              variant='outline'
                              size='sm'
                              onClick={handleFillRelatedModels}
                              disabled={!basicModels.length}
                            >
                              <FileText className='mr-2 h-4 w-4' />
                              Fill Related Models
                            </Button>
                            <Button
                              type='button'
                              variant='outline'
                              size='sm'
                              onClick={handleFillAllModels}
                              disabled={!allModelsList.length}
                            >
                              <Plus className='mr-2 h-4 w-4' />
                              Fill All Models
                            </Button>
                            {MODEL_FETCHABLE_TYPES.has(currentType) && (
                              <Button
                                type='button'
                                variant='outline'
                                size='sm'
                                onClick={handleFetchModels}
                                disabled={isFetchingModels}
                              >
                                {isFetchingModels ? (
                                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                ) : (
                                  <Sparkles className='mr-2 h-4 w-4' />
                                )}
                                Fetch from Upstream
                              </Button>
                            )}
                            <Button
                              type='button'
                              variant='outline'
                              size='sm'
                              onClick={handleClearModels}
                            >
                              <Eraser className='mr-2 h-4 w-4' />
                              Clear All
                            </Button>
                            <Button
                              type='button'
                              variant='outline'
                              size='sm'
                              onClick={handleCopyModels}
                            >
                              <Copy className='mr-2 h-4 w-4' />
                              Copy All
                            </Button>
                            {prefillGroups.map((group) => (
                              <Button
                                key={group.id}
                                type='button'
                                variant='secondary'
                                size='sm'
                                onClick={() => handleAddPrefillGroup(group)}
                              >
                                {group.name}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Custom Model Input */}
                <div className='flex gap-2'>
                  <Input
                    placeholder='Add custom model(s), comma-separated'
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddCustomModels()
                      }
                    }}
                  />
                  <Button
                    type='button'
                    variant='secondary'
                    onClick={handleAddCustomModels}
                    disabled={!customModel}
                  >
                    Add
                  </Button>
                </div>

                <FormField
                  control={form.control}
                  name='model_mapping'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Model Mapping</FormLabel>
                      <FormControl>
                        <ModelMappingEditor
                          value={field.value || ''}
                          onChange={field.onChange}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormDescription>
                        {FIELD_DESCRIPTIONS.MODEL_MAPPING}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='group'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Groups *</FormLabel>
                      <FormControl>
                        {isLoadingGroups ? (
                          <Skeleton className='h-10 w-full' />
                        ) : (
                          <MultiSelect
                            options={groupOptions}
                            selected={field.value}
                            onChange={field.onChange}
                            placeholder={FIELD_PLACEHOLDERS.GROUP}
                          />
                        )}
                      </FormControl>
                      <FormDescription>
                        {FIELD_DESCRIPTIONS.GROUP}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* Advanced Settings Section */}
              <div className='space-y-4'>
                <h3 className='text-sm font-semibold'>Advanced Settings</h3>

                <FormField
                  control={form.control}
                  name='priority'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          placeholder='0'
                          {...field}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        {FIELD_DESCRIPTIONS.PRIORITY}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='weight'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Weight</FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          placeholder='0'
                          {...field}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        {FIELD_DESCRIPTIONS.WEIGHT}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='test_model'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Test Model</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={FIELD_PLACEHOLDERS.TEST_MODEL}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {FIELD_DESCRIPTIONS.TEST_MODEL}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='auto_ban'
                  render={({ field }) => (
                    <FormItem className='flex items-center justify-between rounded-lg border p-4'>
                      <div className='space-y-0.5'>
                        <FormLabel className='text-base'>Auto Ban</FormLabel>
                        <FormDescription>
                          {FIELD_DESCRIPTIONS.AUTO_BAN}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value === 1}
                          onCheckedChange={(checked) =>
                            field.onChange(checked ? 1 : 0)
                          }
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='tag'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tag</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={FIELD_PLACEHOLDERS.TAG}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {FIELD_DESCRIPTIONS.TAG}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='remark'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Remark</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={FIELD_PLACEHOLDERS.REMARK}
                          rows={2}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {FIELD_DESCRIPTIONS.REMARK}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='status_code_mapping'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status Code Mapping</FormLabel>
                      <FormControl>
                        <JsonEditor
                          value={field.value || ''}
                          onChange={field.onChange}
                          disabled={isSubmitting}
                          keyPlaceholder='400'
                          valuePlaceholder='500'
                          keyLabel='Original Code'
                          valueLabel='Mapped Code'
                          emptyMessage='No status code mappings configured.'
                          template={{ '400': '500', '429': '503' }}
                          valueType='string'
                        />
                      </FormControl>
                      <FormDescription>
                        Map upstream status codes to different codes
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='param_override'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parameter Override</FormLabel>
                      <FormControl>
                        <JsonEditor
                          value={field.value || ''}
                          onChange={field.onChange}
                          disabled={isSubmitting}
                          keyPlaceholder='temperature'
                          valuePlaceholder='0.7'
                          keyLabel='Parameter'
                          valueLabel='Value'
                          emptyMessage='No parameter overrides configured.'
                          template={{
                            temperature: 0.7,
                            max_tokens: 2000,
                            top_p: 1,
                          }}
                          valueType='any'
                        />
                      </FormControl>
                      <FormDescription>
                        <div className='flex flex-col gap-2'>
                          <span>
                            Override request parameters. Cannot override{' '}
                            <code>stream</code> parameter.
                          </span>
                          <div className='flex flex-wrap gap-2'>
                            <Button
                              type='button'
                              variant='ghost'
                              size='sm'
                              className='h-6 text-xs'
                              onClick={() => {
                                field.onChange(
                                  JSON.stringify({ temperature: 0 }, null, 2)
                                )
                              }}
                            >
                              Old Format Template
                            </Button>
                            <Button
                              type='button'
                              variant='ghost'
                              size='sm'
                              className='h-6 text-xs'
                              onClick={() => {
                                field.onChange(
                                  JSON.stringify(
                                    {
                                      operations: [
                                        {
                                          path: 'temperature',
                                          mode: 'set',
                                          value: 0.7,
                                          conditions: [
                                            {
                                              path: 'model',
                                              mode: 'prefix',
                                              value: 'gpt',
                                            },
                                          ],
                                          logic: 'AND',
                                        },
                                      ],
                                    },
                                    null,
                                    2
                                  )
                                )
                              }}
                            >
                              New Format Template
                            </Button>
                          </div>
                          <span className='text-muted-foreground text-xs'>
                            Old format: Direct override. New format: Supports
                            conditional judgment and custom JSON operations.
                          </span>
                        </div>
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='header_override'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Header Override</FormLabel>
                      <FormControl>
                        <JsonEditor
                          value={field.value || ''}
                          onChange={field.onChange}
                          disabled={isSubmitting}
                          keyPlaceholder='X-Custom-Header'
                          valuePlaceholder='value'
                          keyLabel='Header Name'
                          valueLabel='Header Value'
                          emptyMessage='No header overrides configured.'
                          template={{
                            'X-Custom-Header': 'custom-value',
                            'X-API-Version': '2024-01',
                          }}
                          valueType='string'
                        />
                      </FormControl>
                      <FormDescription>
                        Override request headers
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* Channel Extra Settings Section */}
              <div className='space-y-4'>
                <h3 className='text-sm font-semibold'>
                  Channel Extra Settings
                </h3>

                {currentType === 1 && (
                  <FormField
                    control={form.control}
                    name='force_format'
                    render={({ field }) => (
                      <FormItem className='flex items-center justify-between rounded-lg border p-4'>
                        <div className='space-y-0.5'>
                          <FormLabel className='text-base'>
                            Force Format
                          </FormLabel>
                          <FormDescription>
                            Force format response to OpenAI standard (OpenAI
                            channel only)
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
                )}

                <FormField
                  control={form.control}
                  name='thinking_to_content'
                  render={({ field }) => (
                    <FormItem className='flex items-center justify-between rounded-lg border p-4'>
                      <div className='space-y-0.5'>
                        <FormLabel className='text-base'>
                          Thinking to Content
                        </FormLabel>
                        <FormDescription>
                          Convert reasoning_content to &lt;think&gt; tag in
                          content
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
                  name='pass_through_body_enabled'
                  render={({ field }) => (
                    <FormItem className='flex items-center justify-between rounded-lg border p-4'>
                      <div className='space-y-0.5'>
                        <FormLabel className='text-base'>
                          Pass Through Body
                        </FormLabel>
                        <FormDescription>
                          Pass request body directly to upstream
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
                  name='proxy'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Proxy Address</FormLabel>
                      <FormControl>
                        <Input
                          placeholder='socks5://user:pass@host:port'
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Network proxy for this channel (supports socks5
                        protocol)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='system_prompt'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>System Prompt</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder='Enter system prompt (user prompt takes priority)'
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Default system prompt for this channel
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='system_prompt_override'
                  render={({ field }) => (
                    <FormItem className='flex items-center justify-between rounded-lg border p-4'>
                      <div className='space-y-0.5'>
                        <FormLabel className='text-base'>
                          System Prompt Concatenation
                        </FormLabel>
                        <FormDescription>
                          Concatenate channel system prompt with user&apos;s
                          prompt
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

          <SheetFooter className='gap-2'>
            <SheetClose asChild>
              <Button variant='outline' disabled={isSubmitting}>
                Cancel
              </Button>
            </SheetClose>
            <Button form='channel-form' type='submit' disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              )}
              {isEditing ? 'Update Channel' : 'Save changes'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Fetch Models Dialog (for editing mode) */}
      {isEditing && currentRow && (
        <FetchModelsDialog
          open={fetchModelsDialogOpen}
          onOpenChange={setFetchModelsDialogOpen}
          onModelsSelected={(models) => {
            // Fill selected models to form
            form.setValue('models', formatModelsArray(models))
          }}
        />
      )}
    </>
  )
}
