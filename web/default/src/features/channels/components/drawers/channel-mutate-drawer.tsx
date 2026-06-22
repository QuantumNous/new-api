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
  type ReactNode,
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from 'react'
import { type SubmitErrorHandler, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  HelpCircle,
  Loader2,
  Sparkles,
  Trash2,
  Copy,
  FileText,
  Eraser,
  Plus,
  Eye,
  RefreshCw,
  Code,
  Route,
  Settings,
  SlidersHorizontal,
  Wand2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getLobeIcon } from '@/lib/lobe-icon'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { useHiddenClickUnlock } from '@/hooks/use-hidden-click-unlock'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
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
  SelectGroup,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  sideDrawerContentClassName,
  sideDrawerFooterClassName,
  sideDrawerFormClassName,
  sideDrawerHeaderClassName,
  sideDrawerSectionClassName,
  sideDrawerSwitchItemClassName,
} from '@/components/drawer-layout'
import { JsonEditor } from '@/components/json-editor'
import { MultiSelect } from '@/components/multi-select'
import {
  SecureVerificationDialog,
  useSecureVerification,
} from '@/features/auth/secure-verification'
import {
  fetchModels,
  getAllModels,
  getChannel,
  getChannelKey,
  getGroups,
  getPrefillGroups,
  refreshCodexCredential,
} from '../../api'
import {
  ADD_MODE_OPTIONS,
  CHANNEL_TYPE_OPTIONS,
  CHANNEL_TYPE_WARNINGS,
  ERROR_MESSAGES,
  FIELD_DESCRIPTIONS,
  FIELD_PLACEHOLDERS,
  MODEL_FETCHABLE_TYPES,
} from '../../constants'
import { useChannelMutateForm } from '../../hooks/use-channel-mutate-form'
import {
  CHANNEL_FORM_DEFAULT_VALUES,
  CHANNEL_TYPE_ADVANCED_CUSTOM,
  channelFormSchema,
  channelsQueryKeys,
  getAdvancedCustomStats,
  transformChannelToFormDefaults,
  type ChannelFormValues,
  deduplicateKeys,
  getChannelTypeIcon,
  getKeyPromptForType,
  parseModelsString,
  formatModelsArray,
  extractRedirectModels,
  extractMappingSourceModels,
  hasModelConfigChanged,
  findMissingModelsInMapping,
  validateModelMappingJson,
  hasAdvancedSettingsErrors,
} from '../../lib'
import {
  collectInvalidStatusCodeEntries,
  collectNewDisallowedStatusCodeRedirects,
} from '../../lib/status-code-risk-guard'
import type { Channel } from '../../types'
import { useChannels } from '../channels-provider'
import { AdvancedCustomEditorDialog } from '../dialogs/advanced-custom-editor-dialog'
import { FetchModelsDialog } from '../dialogs/fetch-models-dialog'
import {
  MissingModelsConfirmationDialog,
  type MissingModelsAction,
} from '../dialogs/missing-models-confirmation-dialog'
import { ParamOverrideEditorDialog } from '../dialogs/param-override-editor-dialog'
import { StatusCodeRiskDialog } from '../dialogs/status-code-risk-dialog'
import { ModelMappingEditor } from '../model-mapping-editor'
import {
  ChannelAdvancedSection,
  ChannelApiAccessSection,
  ChannelAuthSection,
  ChannelBasicSection,
  ChannelEditorLoadingState,
  ChannelModelsSection,
} from './sections'

type ChannelMutateDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: Channel | null
}

type ModelMappingGuardrail = {
  invalidJson: boolean
  entries: Array<{ source: string; target: string }>
  missingSourceModels: string[]
  exposedTargetModels: string[]
}

// Helper functions
const createEmptyModelMappingGuardrail = (): ModelMappingGuardrail => ({
  invalidJson: false,
  entries: [],
  missingSourceModels: [],
  exposedTargetModels: [],
})

const formatModelNames = (models: string[]): string =>
  models.map((model) => `"${model}"`).join(', ')

const MODEL_MAPPING_PREVIEW_FALLBACK: Array<{
  source: string
  target: string
}> = [{ source: 'client-model', target: 'upstream-model' }]

const ADVANCED_SETTINGS_EXPANDED_KEY = 'channel-advanced-settings-expanded'
const UPSTREAM_DETECTED_MODEL_PREVIEW_LIMIT = 8

function readAdvancedSettingsPreference(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(ADVANCED_SETTINGS_EXPANDED_KEY) === 'true'
}

function hasAdvancedSettingsValues(values: ChannelFormValues): boolean {
  return Boolean(
    values.param_override?.trim() ||
    values.header_override?.trim() ||
    values.advanced_custom?.trim() ||
    values.status_code_mapping?.trim() ||
    values.tag?.trim() ||
    values.remark?.trim() ||
    values.priority ||
    values.weight ||
    values.proxy?.trim() ||
    values.system_prompt?.trim() ||
    values.force_format ||
    values.thinking_to_content ||
    values.pass_through_body_enabled ||
    values.system_prompt_override ||
    values.claude_beta_query ||
    values.upstream_model_update_check_enabled ||
    values.upstream_model_update_auto_sync_enabled ||
    values.upstream_model_update_ignored_models?.trim()
  )
}

function parseSettingsRecord(
  settings: string | undefined
): Record<string, unknown> {
  if (!settings?.trim()) return {}
  try {
    const parsed = JSON.parse(settings)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    return {}
  }
  return {}
}

function formatUnixTime(timestamp: unknown): string {
  const seconds = Number(timestamp)
  if (!Number.isFinite(seconds) || seconds <= 0) return '-'
  return new Date(seconds * 1000).toLocaleString()
}

function CardHeading({ title, icon }: { title: string; icon?: ReactNode }) {
  return (
    <div className='flex items-center gap-3'>
      {icon && (
        <span className='bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-md'>
          {icon}
        </span>
      )}
      <h3 className='text-sm font-semibold tracking-tight'>{title}</h3>
    </div>
  )
}

function SubHeading({ title, icon }: { title: string; icon?: ReactNode }) {
  return (
    <div className='flex items-center gap-2'>
      {icon && <span className='text-muted-foreground'>{icon}</span>}
      <h4 className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
        {title}
      </h4>
    </div>
  )
}

export function ChannelMutateDrawer({
  open,
  onOpenChange,
  currentRow,
}: ChannelMutateDrawerProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { setOpen } = useChannels()
  const [fetchModelsDialogOpen, setFetchModelsDialogOpen] = useState(false)
  const [channelKey, setChannelKey] = useState<string | null>(null)
  const [isChannelKeyLoading, setIsChannelKeyLoading] = useState(false)
  const [isCodexCredentialRefreshing, setIsCodexCredentialRefreshing] =
    useState(false)
  const initialModelsRef = useRef<string[]>([])
  const initialModelMappingRef = useRef<string>('')
  const initialStatusCodeMappingRef = useRef<string>('')
  const [statusCodeRiskOpen, setStatusCodeRiskOpen] = useState(false)
  const [statusCodeRiskDetailItems, setStatusCodeRiskDetailItems] = useState<
    string[]
  >([])
  const statusCodeRiskResolveRef = useRef<
    ((confirmed: boolean) => void) | null
  >(null)
  const [missingModelsDialogOpen, setMissingModelsDialogOpen] = useState(false)
  const [missingModelsList, setMissingModelsList] = useState<string[]>([])
  const missingModelsResolveRef = useRef<
    ((action: MissingModelsAction) => void) | null
  >(null)
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false)
  const [paramOverrideEditorOpen, setParamOverrideEditorOpen] = useState(false)
  const [advancedCustomEditorOpen, setAdvancedCustomEditorOpen] =
    useState(false)

  const isEditing = Boolean(currentRow)
  const channelId = currentRow?.id ?? null

  // Fetch channel details if editing
  const { data: channelData, isLoading: isChannelLoading } = useQuery({
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

  const { copyToClipboard } = useCopyToClipboard()

  const {
    open: verificationOpen,
    methods: verificationMethods,
    state: verificationState,
    executeVerification,
    withVerification,
    cancel: cancelVerification,
    setCode: setVerificationCode,
    switchMethod: switchVerificationMethod,
  } = useSecureVerification()

  useEffect(() => {
    if (!open) {
      setChannelKey(null)
      setIsChannelKeyLoading(false)
    } else if (channelId) {
      setChannelKey(null)
    }
  }, [open, channelId])

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
  const currentName = form.watch('name')
  const currentModelMapping = form.watch('model_mapping')
  const awsKeyType = form.watch('aws_key_type')
  const vertexKeyType = form.watch('vertex_key_type')
  const upstreamModelUpdateCheckEnabled = form.watch(
    'upstream_model_update_check_enabled'
  )
  const currentSettings = form.watch('settings')
  const currentAdvancedCustom = form.watch('advanced_custom')
  const {
    unlocked: doubaoApiEditUnlocked,
    handleClick: handleApiConfigSecretClick,
    reset: resetDoubaoApiUnlock,
  } = useHiddenClickUnlock({
    requiredClicks: 10,
    disabled: currentType !== 45,
    onUnlock: () => {
      toast.info(t('Doubao custom API address editing unlocked'))
    },
  })

  useEffect(() => {
    if (!open) {
      resetDoubaoApiUnlock()
    }
  }, [open, resetDoubaoApiUnlock])

  // Helper computed values
  const isBatchMode =
    multiKeyMode === 'batch' || multiKeyMode === 'multi_to_single'
  const isChannelDetailLoading = isEditing && isChannelLoading
  const supportsMultiKeyAddMode =
    currentType !== 57 && !(currentType === 41 && vertexKeyType === 'api_key')
  const addModeOptions = useMemo(
    () =>
      supportsMultiKeyAddMode
        ? ADD_MODE_OPTIONS
        : ADD_MODE_OPTIONS.filter((option) => option.value === 'single'),
    [supportsMultiKeyAddMode]
  )

  const advancedCustomStats = useMemo(
    () => getAdvancedCustomStats(currentAdvancedCustom),
    [currentAdvancedCustom]
  )

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

  const currentTypeLabel = useMemo(
    () =>
      CHANNEL_TYPE_OPTIONS.find((option) => option.value === currentType)
        ?.label || `#${currentType}`,
    [currentType]
  )

  const channelTypeOptions = useMemo(() => {
    const options = CHANNEL_TYPE_OPTIONS.map((option) => ({
      value: String(option.value),
      label: t(option.label),
      icon: getLobeIcon(`${getChannelTypeIcon(option.value)}.Color`, 16),
    }))
    if (!options.some((option) => Number(option.value) === currentType)) {
      options.push({
        value: String(currentType),
        label: `#${currentType}`,
        icon: getLobeIcon(`${getChannelTypeIcon(currentType)}.Color`, 16),
      })
    }
    return options
  }, [currentType, t])

  // Extract redirect models from model_mapping (target values)
  const redirectModelList = useMemo(
    () => extractRedirectModels(currentModelMapping || ''),
    [currentModelMapping]
  )

  // Extract source keys from model_mapping (models being remapped FROM)
  const redirectModelKeyList = useMemo(
    () => extractMappingSourceModels(currentModelMapping || ''),
    [currentModelMapping]
  )

  // Transform models to multi-select options
  const modelOptions = useMemo(() => {
    const allModels = new Set([...allModelsList, ...currentModelsArray])
    return Array.from(allModels).map((model) => ({
      value: model,
      label: model,
    }))
  }, [allModelsList, currentModelsArray])

  const modelMappingGuardrail = useMemo<ModelMappingGuardrail>(() => {
    if (!currentModelMapping?.trim()) {
      return createEmptyModelMappingGuardrail()
    }

    try {
      const parsed = JSON.parse(currentModelMapping)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { ...createEmptyModelMappingGuardrail(), invalidJson: true }
      }

      const entries = Object.entries(parsed).reduce<
        Array<{ source: string; target: string }>
      >((acc, [rawSource, rawTarget]) => {
        const source = String(rawSource).trim()
        const target = String(rawTarget ?? '').trim()

        if (!source || !target) {
          return acc
        }

        acc.push({ source, target })
        return acc
      }, [])

      const missingSourceModels = Array.from(
        new Set(
          entries
            .filter(
              (entry) =>
                Boolean(entry.source) &&
                !currentModelsArray.includes(entry.source)
            )
            .map((entry) => entry.source)
        )
      )

      const exposedTargetModels = Array.from(
        new Set(
          entries
            .filter(
              (entry) =>
                Boolean(entry.target) &&
                currentModelsArray.includes(entry.target)
            )
            .map((entry) => entry.target)
        )
      )

      return {
        invalidJson: false,
        entries,
        missingSourceModels,
        exposedTargetModels,
      }
    } catch {
      return { ...createEmptyModelMappingGuardrail(), invalidJson: true }
    }
  }, [currentModelMapping, currentModelsArray])

  const mappingPreviewPairs =
    modelMappingGuardrail.entries.length > 0
      ? modelMappingGuardrail.entries.slice(0, 3)
      : MODEL_MAPPING_PREVIEW_FALLBACK
  const remainingMappingCount =
    modelMappingGuardrail.entries.length > 3
      ? modelMappingGuardrail.entries.length - 3
      : 0

  const upstreamUpdateMeta = useMemo(() => {
    const settings = parseSettingsRecord(currentSettings)
    const detectedModels = Array.isArray(
      settings.upstream_model_update_last_detected_models
    )
      ? settings.upstream_model_update_last_detected_models
          .map((model) => String(model || '').trim())
          .filter(Boolean)
      : []

    return {
      lastCheckTime: settings.upstream_model_update_last_check_time,
      detectedModels: Array.from(new Set(detectedModels)),
    }
  }, [currentSettings])

  const upstreamDetectedModelsPreview = upstreamUpdateMeta.detectedModels.slice(
    0,
    UPSTREAM_DETECTED_MODEL_PREVIEW_LIMIT
  )
  const upstreamDetectedModelsOmittedCount =
    upstreamUpdateMeta.detectedModels.length -
    upstreamDetectedModelsPreview.length

  // Load channel data into form when editing
  useEffect(() => {
    if (isEditing && channelData?.data) {
      const defaults = transformChannelToFormDefaults(channelData.data)
      form.reset(defaults)
      setAdvancedSettingsOpen(
        readAdvancedSettingsPreference() || hasAdvancedSettingsValues(defaults)
      )
      // Store initial values for comparison
      initialModelsRef.current = parseModelsString(
        channelData.data.models || ''
      )
      initialModelMappingRef.current = channelData.data.model_mapping || ''
      initialStatusCodeMappingRef.current =
        channelData.data.status_code_mapping || ''
    } else if (!isEditing) {
      form.reset(CHANNEL_FORM_DEFAULT_VALUES)
      setAdvancedSettingsOpen(false)
      initialModelsRef.current = []
      initialModelMappingRef.current = ''
      initialStatusCodeMappingRef.current = ''
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

  useEffect(() => {
    if (currentType !== 45 || currentBaseUrl !== 'doubao-coding-plan') return

    form.setValue('base_url', 'https://ark.cn-beijing.volces.com', {
      shouldDirty: false,
      shouldValidate: true,
    })
  }, [currentBaseUrl, currentType, form])

  useEffect(() => {
    if (isEditing || supportsMultiKeyAddMode) return
    if (multiKeyMode && multiKeyMode !== 'single') {
      form.setValue('multi_key_mode', 'single', {
        shouldDirty: true,
        shouldValidate: true,
      })
    }
  }, [form, isEditing, multiKeyMode, supportsMultiKeyAddMode])

  // Validate base_url - warn if it ends with /v1
  useEffect(() => {
    if (!currentBaseUrl || !currentBaseUrl.endsWith('/v1')) return

    // Show warning toast
    const timer = setTimeout(() => {
      toast.warning(
        t(
          'Warning: Base URL should not end with /v1. New API will handle it automatically. This may cause request failures.'
        ),
        { duration: 5000 }
      )
    }, 500)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBaseUrl])

  // Handle key deduplication
  const handleDeduplicateKeys = () => {
    const currentKey = form.getValues('key')
    if (!currentKey || currentKey.trim() === '') {
      toast.info(t('Please enter keys first'))
      return
    }

    const result = deduplicateKeys(currentKey)

    if (result.removedCount === 0) {
      toast.info(t('No duplicate keys found'))
    } else {
      form.setValue('key', result.deduplicatedText)
      toast.success(
        t(
          'Removed {{removed}} duplicate key(s). Before: {{before}}, After: {{after}}',
          {
            removed: result.removedCount,
            before: result.beforeCount,
            after: result.afterCount,
          }
        )
      )
    }
  }

  const fetchChannelKey = useCallback(async () => {
    if (!channelId) {
      throw new Error('Channel is not selected')
    }

    setIsChannelKeyLoading(true)
    try {
      const res = await getChannelKey(channelId)
      if (!res.success) {
        throw new Error(res.message || t('Failed to fetch channel key'))
      }

      const keyValue = res.data?.key ?? ''
      setChannelKey(keyValue)
      toast.success(t('Channel key unlocked'))
      return res
    } finally {
      setIsChannelKeyLoading(false)
    }
  }, [channelId, t])

  const handleRevealKey = useCallback(async () => {
    if (!channelId) return

    try {
      await withVerification(fetchChannelKey, {
        preferredMethod: 'passkey',
        title: 'Verify to view channel key',
        description:
          'Use Passkey or 2FA to confirm your identity before revealing this channel key.',
      })
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message)
      }
    }
  }, [channelId, withVerification, fetchChannelKey])

  const handleRefreshCodexCredential = useCallback(async () => {
    if (!channelId) return
    setIsCodexCredentialRefreshing(true)
    try {
      const res = await refreshCodexCredential(channelId)
      if (!res.success) {
        throw new Error(res.message || t('Failed to refresh credential'))
      }
      toast.success(t('Credential refreshed'))
      queryClient.invalidateQueries({
        queryKey: channelsQueryKeys.detail(channelId),
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('Refresh failed'))
    } finally {
      setIsCodexCredentialRefreshing(false)
    }
  }, [channelId, queryClient, t])

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
      toast.error(t('This channel type does not support fetching models'))
      return
    }

    // For creation mode, validate key before opening dialog
    if (!isEditing) {
      const key = form.getValues('key')
      if (!key?.trim()) {
        toast.error(t('Please enter API key first'))
        return
      }
    }

    setFetchModelsDialogOpen(true)
  }, [isEditing, form, t])

  const createModeFetcher = useCallback(async (): Promise<string[]> => {
    const response = await fetchModels({
      type: form.getValues('type'),
      key: form.getValues('key'),
      base_url: form.getValues('base_url') || '',
    })
    if (response.success && response.data) {
      return response.data
    }
    throw new Error(response.message || 'No models fetched from upstream')
  }, [form])

  // Handle model operations
  const handleFillRelatedModels = useCallback(() => {
    if (!basicModels.length) {
      toast.info(t('No related models available for this channel type'))
      return
    }
    updateModels(basicModels)
    toast.success(
      t('Filled {{count}} related model(s)', { count: basicModels.length })
    )
  }, [basicModels, updateModels, t])

  const handleFillAllModels = useCallback(() => {
    if (!allModelsList.length) {
      toast.info(t('No models available'))
      return
    }
    updateModels(allModelsList)
    toast.success(
      t('Filled {{count}} model(s)', { count: allModelsList.length })
    )
  }, [allModelsList, updateModels, t])

  const handleClearModels = useCallback(() => {
    form.setValue('models', '')
    toast.success(t('Cleared all models'))
  }, [form, t])

  const handleCopyModels = useCallback(async () => {
    const models = form.getValues('models')
    if (!models?.trim()) {
      toast.info(t('No models to copy'))
      return
    }
    await copyToClipboard(models)
  }, [form, copyToClipboard, t])

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
        toast.success(
          t('Added {{count}} models from "{{name}}"', {
            count,
            name: group.name,
          })
        )
      } catch {
        toast.error(t('Failed to parse group items'))
      }
    },
    [updateModels, t]
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
    if (channelId) {
      queryClient.invalidateQueries({
        queryKey: channelsQueryKeys.detail(channelId),
      })
    }
    onOpenChange(false)
    setOpen(null)
  }, [channelId, queryClient, onOpenChange, setOpen])

  // Show missing models confirmation dialog
  const confirmMissingModelMappings = useCallback(
    (missingModels: string[]): Promise<MissingModelsAction> => {
      return new Promise((resolve) => {
        setMissingModelsList(missingModels)
        setMissingModelsDialogOpen(true)
        missingModelsResolveRef.current = resolve
      })
    },
    []
  )

  // Handle missing models dialog action
  const handleMissingModelsAction = useCallback(
    (action: MissingModelsAction) => {
      setMissingModelsDialogOpen(false)
      if (missingModelsResolveRef.current) {
        missingModelsResolveRef.current(action)
        missingModelsResolveRef.current = null
      }
    },
    []
  )

  const confirmStatusCodeRisk = useCallback(
    (detailItems: string[]): Promise<boolean> =>
      new Promise((resolve) => {
        statusCodeRiskResolveRef.current = resolve
        setStatusCodeRiskDetailItems(detailItems)
        setStatusCodeRiskOpen(true)
      }),
    []
  )

  const handleStatusCodeRiskAction = useCallback((confirmed: boolean) => {
    setStatusCodeRiskOpen(false)
    setStatusCodeRiskDetailItems([])
    if (statusCodeRiskResolveRef.current) {
      statusCodeRiskResolveRef.current(confirmed)
      statusCodeRiskResolveRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      if (statusCodeRiskResolveRef.current) {
        statusCodeRiskResolveRef.current(false)
        statusCodeRiskResolveRef.current = null
      }
    }
  }, [])

  const channelMutation = useChannelMutateForm({
    currentRow,
    isEditing,
    isMultiKeyChannel,
    onSuccess: handleSuccess,
  })

  const isSubmitting = channelMutation.isPending

  // Submit handler
  const onSubmit = useCallback(
    async (data: ChannelFormValues) => {
      // Validate key is required when creating
      if (!isEditing && !data.key?.trim()) {
        form.setError('key', {
          type: 'manual',
          message: ERROR_MESSAGES.REQUIRED_KEY,
        })
        return
      }

      // Validate status_code_mapping entries
      if (data.status_code_mapping?.trim()) {
        const invalidEntries = collectInvalidStatusCodeEntries(
          data.status_code_mapping
        )
        if (invalidEntries.length > 0) {
          toast.error(
            t('Invalid status code mapping entries: {{entries}}', {
              entries: invalidEntries.join(', '),
            })
          )
          return
        }

        const riskyRedirects = collectNewDisallowedStatusCodeRedirects(
          initialStatusCodeMappingRef.current,
          data.status_code_mapping
        )
        if (riskyRedirects.length > 0) {
          const confirmed = await confirmStatusCodeRisk(riskyRedirects)
          if (!confirmed) return
        }
      }

      // Validate model_mapping JSON format
      const hasModelMapping =
        typeof data.model_mapping === 'string' &&
        data.model_mapping.trim() !== ''

      if (hasModelMapping) {
        const validation = validateModelMappingJson(data.model_mapping!)
        if (!validation.valid) {
          toast.error(t(validation.error || 'Invalid model mapping'))
          return
        }
      }

      // Normalize models array
      const normalizedModels = parseModelsString(data.models || '')

      // Check for missing models in model_mapping
      if (hasModelMapping) {
        const missingModels = findMissingModelsInMapping(
          data.model_mapping!,
          normalizedModels
        )

        const shouldPromptMissing =
          missingModels.length > 0 &&
          hasModelConfigChanged(
            normalizedModels,
            data.model_mapping || '',
            initialModelsRef.current,
            initialModelMappingRef.current
          )

        if (shouldPromptMissing) {
          const confirmAction = await confirmMissingModelMappings(missingModels)
          if (confirmAction === 'cancel') {
            return
          }
          if (confirmAction === 'add') {
            const updatedModels = Array.from(
              new Set([...normalizedModels, ...missingModels])
            )
            data.models = formatModelsArray(updatedModels)
            form.setValue('models', data.models)
          }
        }
      }

      await channelMutation.mutateAsync(data)
    },
    [
      isEditing,
      form,
      confirmMissingModelMappings,
      confirmStatusCodeRisk,
      channelMutation,
      t,
    ]
  )

  const handleAdvancedSettingsOpenChange = useCallback((nextOpen: boolean) => {
    setAdvancedSettingsOpen(nextOpen)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        ADVANCED_SETTINGS_EXPANDED_KEY,
        String(nextOpen)
      )
    }
  }, [])

  const onInvalid: SubmitErrorHandler<ChannelFormValues> = useCallback(
    (errors) => {
      if (hasAdvancedSettingsErrors(errors)) {
        handleAdvancedSettingsOpenChange(true)
      }
      toast.error(t('Please fix the highlighted fields before saving'))
    },
    [handleAdvancedSettingsOpenChange, t]
  )

  // Handle drawer close
  const handleOpenChange = useCallback(
    (v: boolean) => {
      onOpenChange(v)
      if (!v) {
        form.reset(CHANNEL_FORM_DEFAULT_VALUES)
        setAdvancedSettingsOpen(false)
      }
    },
    [onOpenChange, form]
  )

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent className={sideDrawerContentClassName('sm:max-w-3xl')}>
          <SheetHeader className={sideDrawerHeaderClassName()}>
            <SheetTitle className='flex items-center gap-3'>
              <span className='bg-muted flex size-9 shrink-0 items-center justify-center rounded-md'>
                {getLobeIcon(`${getChannelTypeIcon(currentType)}.Color`, 22)}
              </span>
              <span>
                {isEditing ? t('Edit Channel') : t('Create Channel')}
                <span className='text-muted-foreground ml-2 text-sm font-normal'>
                  {t(currentTypeLabel)}
                </span>
              </span>
            </SheetTitle>
            <SheetDescription>
              {isEditing
                ? t(
                    "Update channel configuration and click save when you're done."
                  )
                : t(
                    'Add a new channel by providing the necessary information.'
                  )}
            </SheetDescription>
          </SheetHeader>

          <Form {...form}>
            <form
              id='channel-form'
              onSubmit={form.handleSubmit(onSubmit, onInvalid)}
              className={sideDrawerFormClassName('gap-5')}
            >
              {isChannelDetailLoading ? (
                <ChannelEditorLoadingState />
              ) : (
                <>
                  {/* ── Basic Information ── */}
                  <ChannelBasicSection>
                    <div className='grid gap-4 sm:grid-cols-2'>
                      <FormField
                        control={form.control}
                        name='name'
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('Name *')}</FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t(FIELD_PLACEHOLDERS.NAME)}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name='type'
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('Type *')}</FormLabel>
                            <FormControl>
                              <Combobox
                                options={channelTypeOptions}
                                value={String(field.value)}
                                onValueChange={(value) => {
                                  const nextType = Number(value)
                                  if (
                                    Number.isInteger(nextType) &&
                                    nextType > 0
                                  ) {
                                    field.onChange(nextType)
                                  }
                                }}
                                placeholder={t('Select channel type')}
                                searchPlaceholder={t('Search channel type...')}
                                emptyText={t('No channel type found.')}
                                allowCustomValue
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name='status'
                      render={({ field }) => (
                        <FormItem className={sideDrawerSwitchItemClassName()}>
                          <div className='flex flex-col gap-0.5'>
                            <FormLabel>{t('Enabled')}</FormLabel>
                            <FormDescription className='text-xs'>
                              {t('Enable or disable this channel')}
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

                    {currentType === 1 && (
                      <FormField
                        control={form.control}
                        name='openai_organization'
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('OpenAI Organization')}</FormLabel>
                            <FormControl>
                              <Input placeholder={t('org-...')} {...field} />
                            </FormControl>
                            <FormDescription>
                              {t(FIELD_DESCRIPTIONS.OPENAI_ORG)}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </ChannelBasicSection>

                  {/* ── API Access ── */}
                  <ChannelApiAccessSection>
                    {CHANNEL_TYPE_WARNINGS[currentType] && (
                      <Alert>
                        <AlertDescription>
                          {t(CHANNEL_TYPE_WARNINGS[currentType])}
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
                              <FormLabel>
                                {t('AZURE_OPENAI_ENDPOINT *')}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  placeholder={t(
                                    'e.g., https://docs-test-001.openai.azure.com'
                                  )}
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                {t('Your Azure OpenAI endpoint URL')}
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
                              <FormLabel>
                                {t('Default API Version *')}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  placeholder={t('e.g., 2025-04-01-preview')}
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                {t('Default API version for this channel')}
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
                              <FormLabel>
                                {t('Responses API Version')}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  placeholder={t('e.g., preview')}
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                {t(
                                  'Default Responses API version, if empty, will use the API version above'
                                )}
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
                              {t('Full Base URL (supports')} {'{'}
                              {t('model')}
                              {'}'} {t('variable) *')}
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t(
                                  'e.g., https://api.openai.com/v1/chat/completions'
                                )}
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              {t('Enter the complete URL, supports')} {'{'}
                              {t('model')}
                              {'}'} {t('variable')}
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
                            <FormLabel>{t('Model Version *')}</FormLabel>
                            <FormControl>
                              <Input placeholder={t('e.g., v2.1')} {...field} />
                            </FormControl>
                            <FormDescription>
                              {t(
                                'Spark model version, e.g., v2.1 (version number in API URL)'
                              )}
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
                          <FormItem className='flex items-center justify-between'>
                            <div className='space-y-0.5'>
                              <FormLabel>{t('Enterprise Account')}</FormLabel>
                              <FormDescription>
                                {t(
                                  'Enable if this is an OpenRouter enterprise account with special response format'
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
                    )}

                    {/* AWS (type 33) */}
                    {currentType === 33 && (
                      <FormField
                        control={form.control}
                        name='aws_key_type'
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('AWS Key Format')}</FormLabel>
                            <Select
                              items={[
                                {
                                  value: 'ak_sk',
                                  label: t('AccessKey / SecretAccessKey'),
                                },
                                { value: 'api_key', label: t('API Key') },
                              ]}
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue
                                    placeholder={t('Select key format')}
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent alignItemWithTrigger={false}>
                                <SelectGroup>
                                  <SelectItem value='ak_sk'>
                                    {t('AccessKey / SecretAccessKey')}
                                  </SelectItem>
                                  <SelectItem value='api_key'>
                                    {t('API Key')}
                                  </SelectItem>
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              {field.value === 'api_key'
                                ? t('API Key mode: use APIKey|Region')
                                : t(
                                    'AK/SK mode: use AccessKey|SecretAccessKey|Region'
                                  )}
                            </FormDescription>
                            <FormMessage />
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
                            <FormLabel>{t('Knowledge Base ID *')}</FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t('e.g., 123456')}
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              {t('Enter the knowledge base ID')}
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
                            <FormLabel>{t('Private Deployment URL')}</FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t(
                                  'e.g., https://fastgpt.run/api/openapi'
                                )}
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              {t(
                                'For private deployments, format: https://fastgpt.run/api/openapi'
                              )}
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
                              {t('API Base URL (Important: Not Chat API) *')}
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t(
                                  'e.g., https://api.example.com (path before /suno)'
                                )}
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              {t(
                                'Enter the path before /suno, usually just the domain'
                              )}
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
                            <FormLabel>{t('Account ID *')}</FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t(
                                  'e.g., d6b5da8hk1awo8nap34ube6gh'
                                )}
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              {t('Your Cloudflare Account ID')}
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
                          {t('Referral link:')}{' '}
                          <a
                            href='https://cloud.siliconflow.cn/i/hij0YNTZ'
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-primary underline'
                          >
                            {t('https://cloud.siliconflow.cn/i/hij0YNTZ')}
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
                              <FormLabel>{t('Vertex AI Key Format')}</FormLabel>
                              <Select
                                items={[
                                  { value: 'json', label: t('JSON') },
                                  { value: 'api_key', label: t('API Key') },
                                ]}
                                onValueChange={field.onChange}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent alignItemWithTrigger={false}>
                                  <SelectGroup>
                                    <SelectItem value='json'>
                                      {t('JSON')}
                                    </SelectItem>
                                    <SelectItem value='api_key'>
                                      {t('API Key')}
                                    </SelectItem>
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                {field.value === 'json'
                                  ? t(
                                      'JSON format supports service account JSON files'
                                    )
                                  : t(
                                      'API Key mode (does not support batch creation)'
                                    )}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        {vertexKeyType === 'json' && (
                          <FormItem>
                            <FormLabel>
                              {t('Service account JSON file(s)')}
                            </FormLabel>
                            <FormControl>
                              <Input
                                type='file'
                                accept='.json,application/json'
                                multiple={isBatchMode}
                                onChange={async (e) => {
                                  const fileList = e.target.files
                                  const files = fileList
                                    ? Array.from(fileList)
                                    : []
                                  // allow re-selecting the same file
                                  e.target.value = ''

                                  if (files.length === 0) {
                                    toast.info(t('Please upload key file(s)'))
                                    return
                                  }

                                  const keys: unknown[] = []
                                  for (const file of files) {
                                    try {
                                      const txt = await file.text()
                                      keys.push(JSON.parse(txt))
                                    } catch {
                                      toast.error(
                                        t(
                                          'Failed to parse JSON file: {{name}}',
                                          {
                                            name: file.name,
                                          }
                                        )
                                      )
                                      return
                                    }
                                  }

                                  if (keys.length === 0) {
                                    toast.info(t('Please upload key file(s)'))
                                    return
                                  }

                                  const keyValue = isBatchMode
                                    ? JSON.stringify(keys)
                                    : JSON.stringify(keys[0])

                                  form.setValue('key', keyValue, {
                                    shouldDirty: true,
                                    shouldValidate: true,
                                  })

                                  toast.success(
                                    t(
                                      'Parsed {{count}} service account file(s)',
                                      {
                                        count: keys.length,
                                      }
                                    )
                                  )
                                }}
                              />
                            </FormControl>
                            <FormDescription>
                              {isBatchMode
                                ? t('Upload multiple JSON files in batch modes')
                                : t(
                                    'Upload a single service account JSON file'
                                  )}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                        <FormField
                          control={form.control}
                          name='other'
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('Deployment Region *')}</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder={t(
                                    'e.g., us-central1 or JSON format for model-specific regions'
                                  )}
                                  rows={3}
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                {t('Enter deployment region or JSON mapping:')}{' '}
                                {'{'}
                                {t(
                                  '"default": "us-central1", "claude-3-5-sonnet-20240620": "europe-west1"'
                                )}
                                {'}'}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}

                    {/* VolcEngine (type 45) */}
                    {currentType === 45 && !doubaoApiEditUnlocked && (
                      <FormField
                        control={form.control}
                        name='base_url'
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel
                              className='cursor-pointer select-none'
                              onClick={handleApiConfigSecretClick}
                            >
                              {t('API Base URL *')}
                            </FormLabel>
                            <Select
                              items={[
                                {
                                  value: 'https://ark.cn-beijing.volces.com',
                                  label: t('https://ark.cn-beijing.volces.com'),
                                },
                                {
                                  value:
                                    'https://ark.ap-southeast.bytepluses.com',
                                  label: t(
                                    'https://ark.ap-southeast.bytepluses.com'
                                  ),
                                },
                              ]}
                              onValueChange={field.onChange}
                              value={
                                field.value === 'doubao-coding-plan'
                                  ? 'https://ark.cn-beijing.volces.com'
                                  : field.value ||
                                    'https://ark.cn-beijing.volces.com'
                              }
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent alignItemWithTrigger={false}>
                                <SelectGroup>
                                  <SelectItem value='https://ark.cn-beijing.volces.com'>
                                    {t('https://ark.cn-beijing.volces.com')}
                                  </SelectItem>
                                  <SelectItem value='https://ark.ap-southeast.bytepluses.com'>
                                    {t(
                                      'https://ark.ap-southeast.bytepluses.com'
                                    )}
                                  </SelectItem>
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              {t('Select the API endpoint region')}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {/* VolcEngine (type 45) - Custom API URL (unlocked) */}
                    {currentType === 45 && doubaoApiEditUnlocked && (
                      <FormField
                        control={form.control}
                        name='base_url'
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('API Base URL *')}</FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t(
                                  'e.g., https://ark.cn-beijing.volces.com'
                                )}
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              {t('Enter custom API endpoint URL')}
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
                            <FormLabel>{t('Agent ID *')}</FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t('e.g., 7342866812345')}
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              {t('Enter the Coze agent ID')}
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
                            <FormLabel>{t('Base URL')}</FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t(FIELD_PLACEHOLDERS.BASE_URL)}
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              {t(
                                'Custom API base URL. For official channels, New API has built-in addresses. Only fill this for third-party proxy sites or special endpoints. Do not add /v1 or trailing slash.'
                              )}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {currentType === CHANNEL_TYPE_ADVANCED_CUSTOM && (
                      <FormField
                        control={form.control}
                        name='advanced_custom'
                        render={({ field }) => (
                          <FormItem className='space-y-3 border-y py-4'>
                            <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                              <div className='space-y-2'>
                                <FormLabel>
                                  {t('Advanced Custom Routes')}
                                </FormLabel>
                                <div className='flex flex-wrap gap-2'>
                                  <Badge variant='secondary'>
                                    {t('Routes')}:{' '}
                                    {advancedCustomStats.routeCount}
                                  </Badge>
                                  {!advancedCustomStats.valid && (
                                    <Badge variant='destructive'>
                                      {t('Incomplete')}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <Button
                                type='button'
                                variant='outline'
                                size='sm'
                                onClick={() =>
                                  setAdvancedCustomEditorOpen(true)
                                }
                              >
                                <Route className='mr-2 h-4 w-4' />
                                {t('Configure routes')}
                              </Button>
                            </div>
                            <FormControl>
                              <input type='hidden' {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <ChannelAuthSection>
                      {!isEditing && (
                        <FormField
                          control={form.control}
                          name='multi_key_mode'
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('Add Mode')}</FormLabel>
                              <Select
                                items={[
                                  ...addModeOptions.map((option) => ({
                                    value: option.value,
                                    label: t(option.label),
                                  })),
                                ]}
                                onValueChange={field.onChange}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent alignItemWithTrigger={false}>
                                  <SelectGroup>
                                    {addModeOptions.map((option) => (
                                      <SelectItem
                                        key={option.value}
                                        value={option.value}
                                      >
                                        {t(option.label)}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                {t(
                                  supportsMultiKeyAddMode
                                    ? FIELD_DESCRIPTIONS.BATCH_ADD
                                    : FIELD_DESCRIPTIONS.KEY
                                )}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      <FormField
                        control={form.control}
                        name='key'
                        render={({ field }) => {
                          const keyPlaceholder = (() => {
                            if (isEditing) {
                              return t('Leave empty to keep existing key')
                            }
                            if (currentType === 33) {
                              if (awsKeyType === 'api_key') {
                                return isBatchMode
                                  ? t(
                                      'Enter API Key, one per line, format: APIKey|Region'
                                    )
                                  : t('Enter API Key, format: APIKey|Region')
                              }
                              return isBatchMode
                                ? t(
                                    'Enter key, one per line, format: AccessKey|SecretAccessKey|Region'
                                  )
                                : t(
                                    'Enter key, format: AccessKey|SecretAccessKey|Region'
                                  )
                            }
                            if (isBatchMode) {
                              return t(
                                'Enter one key per line for batch creation'
                              )
                            }
                            return t(getKeyPromptForType(currentType))
                          })()
                          return (
                            <FormItem>
                              <FormLabel>{t('API Key *')}</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder={keyPlaceholder}
                                  rows={isBatchMode ? 8 : 4}
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                <div className='flex flex-col gap-2'>
                                  <span>
                                    {isEditing ? (
                                      <>
                                        {t(
                                          'Enter new key to update, or leave empty to keep current key'
                                        )}
                                        {isMultiKeyChannel && (
                                          <span className='text-warning mt-1 block'>
                                            {t(
                                              'Multi-key channel: Keys will be'
                                            )}{' '}
                                            {keyMode === 'replace'
                                              ? t('replaced')
                                              : t('appended')}
                                          </span>
                                        )}
                                      </>
                                    ) : isBatchMode ? (
                                      t(
                                        'Enter one API key per line for batch creation'
                                      )
                                    ) : (
                                      t(FIELD_DESCRIPTIONS.KEY)
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
                                      {t('Remove Duplicates')}
                                    </Button>
                                  )}
                                </div>
                              </FormDescription>
                              {isEditing && (
                                <div className='border-border/60 mt-4 flex flex-col gap-3 border-y border-dashed py-4'>
                                  <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                                    <div>
                                      <p className='text-sm font-medium'>
                                        {t('Current key')}
                                      </p>
                                      <p className='text-muted-foreground text-xs'>
                                        {t(
                                          'Verification required to reveal the saved key.'
                                        )}
                                      </p>
                                    </div>
                                    <div className='flex items-center gap-2'>
                                      <Button
                                        type='button'
                                        variant='outline'
                                        size='sm'
                                        onClick={handleRevealKey}
                                        disabled={
                                          isChannelKeyLoading ||
                                          verificationState.loading
                                        }
                                      >
                                        {isChannelKeyLoading ||
                                        verificationState.loading ? (
                                          <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                        ) : (
                                          <Eye className='mr-2 h-4 w-4' />
                                        )}
                                        {t('Reveal key')}
                                      </Button>
                                      <Button
                                        type='button'
                                        variant='ghost'
                                        size='sm'
                                        onClick={async () => {
                                          if (channelKey) {
                                            await copyToClipboard(channelKey)
                                          }
                                        }}
                                        disabled={!channelKey}
                                      >
                                        <Copy className='mr-2 h-4 w-4' />
                                        {t('Copy')}
                                      </Button>
                                    </div>
                                  </div>
                                  <Input
                                    readOnly
                                    value={channelKey ?? ''}
                                    placeholder={t('Hidden — verify to reveal')}
                                    className='font-mono'
                                  />
                                </div>
                              )}
                              <FormMessage />
                            </FormItem>
                          )
                        }}
                      />

                      {currentType === 57 && (
                        <div className='border-border/60 flex flex-col gap-3 border-y py-4'>
                          <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                            <div className='text-muted-foreground text-xs'>
                              {t(
                                'Codex channels use an OAuth JSON credential as the key.'
                              )}
                            </div>
                            <div className='flex flex-wrap items-center gap-2'>
                              {isEditing && channelId && (
                                <Button
                                  type='button'
                                  variant='outline'
                                  size='sm'
                                  onClick={handleRefreshCodexCredential}
                                  disabled={isCodexCredentialRefreshing}
                                >
                                  {isCodexCredentialRefreshing ? (
                                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                  ) : (
                                    <RefreshCw className='mr-2 h-4 w-4' />
                                  )}
                                  {isCodexCredentialRefreshing
                                    ? t('Refreshing...')
                                    : t('Refresh credential')}
                                </Button>
                              )}
                            </div>
                          </div>
                          <Alert className='border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-50'>
                            <AlertDescription>
                              {t(
                                "Disclaimer: Personal use only. Do not distribute or share any credentials. This channel has prerequisites and requires prior setup; use it only if you understand the flow and risks, and comply with OpenAI's terms and policies. Credentials and configuration are for Codex CLI integration only, and are not intended for any other client, platform, or channel."
                              )}
                            </AlertDescription>
                          </Alert>
                        </div>
                      )}

                      {isEditing && isMultiKeyChannel && (
                        <FormField
                          control={form.control}
                          name='key_mode'
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('Key Update Mode')}</FormLabel>
                              <Select
                                items={[
                                  {
                                    value: 'append',
                                    label: t('Append to existing keys'),
                                  },
                                  {
                                    value: 'replace',
                                    label: t('Replace all existing keys'),
                                  },
                                ]}
                                onValueChange={field.onChange}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent alignItemWithTrigger={false}>
                                  <SelectGroup>
                                    <SelectItem value='append'>
                                      {t('Append to existing keys')}
                                    </SelectItem>
                                    <SelectItem value='replace'>
                                      {t('Replace all existing keys')}
                                    </SelectItem>
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                {field.value === 'replace'
                                  ? t(
                                      'Replace mode: Will completely replace all existing keys'
                                    )
                                  : t(
                                      'Append mode: New keys will be added to the end of the existing key list'
                                    )}
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
                              <FormLabel>{t('Multi-Key Strategy')}</FormLabel>
                              <Select
                                items={[
                                  { value: 'random', label: t('Random') },
                                  { value: 'polling', label: t('Polling') },
                                ]}
                                onValueChange={field.onChange}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent alignItemWithTrigger={false}>
                                  <SelectGroup>
                                    <SelectItem value='random'>
                                      {t('Random')}
                                    </SelectItem>
                                    <SelectItem value='polling'>
                                      {t('Polling')}
                                    </SelectItem>
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                {multiKeyType === 'polling' ? (
                                  <span className='text-warning'>
                                    {t(
                                      'Polling mode requires Redis and memory cache, otherwise performance will be significantly degraded'
                                    )}
                                  </span>
                                ) : (
                                  t(
                                    'Randomly select a key from the pool for each request'
                                  )
                                )}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </ChannelAuthSection>
                  </ChannelApiAccessSection>

                  {/* ── Models & Groups ── */}
                  <ChannelModelsSection>
                    <div className='space-y-5'>
                      <div className='border-border/60 bg-muted/10 rounded-lg border p-4'>
                        <FormField
                          control={form.control}
                          name='models'
                          render={() => (
                            <FormItem className='space-y-3'>
                              <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                                <div className='space-y-1'>
                                  <FormLabel>{t('Models *')}</FormLabel>
                                  <FormDescription>
                                    {t(FIELD_DESCRIPTIONS.MODELS)}
                                  </FormDescription>
                                </div>
                                <Badge variant='outline' className='w-fit'>
                                  {t('Selected {{count}}', {
                                    count: currentModelsArray.length,
                                  })}
                                </Badge>
                              </div>
                              <FormControl>
                                <MultiSelect
                                  options={modelOptions}
                                  selected={currentModelsArray}
                                  onChange={handleModelsChange}
                                  placeholder={t(
                                    'Select models or add custom ones'
                                  )}
                                  allowCreate
                                  createLabel='Add custom model "{{value}}"'
                                  maxVisibleChips={8}
                                  copyChipOnClick
                                />
                              </FormControl>
                              {modelMappingGuardrail.exposedTargetModels
                                .length > 0 && (
                                <Alert className='border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-50'>
                                  <AlertDescription className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                                    <span>
                                      {t('The mapped upstream model(s)')}{' '}
                                      {formatModelNames(
                                        modelMappingGuardrail.exposedTargetModels
                                      )}{' '}
                                      {t(
                                        'are also listed here. Remove them from Models to keep the `/v1/models` response user-friendly and hide vendor-specific names.'
                                      )}
                                    </span>
                                    <Button
                                      type='button'
                                      variant='outline'
                                      size='sm'
                                      onClick={() => {
                                        const hiddenTargets = new Set(
                                          modelMappingGuardrail.exposedTargetModels
                                        )
                                        updateModels(
                                          currentModelsArray.filter(
                                            (model) => !hiddenTargets.has(model)
                                          )
                                        )
                                      }}
                                    >
                                      {t('Remove mapped targets')}
                                    </Button>
                                  </AlertDescription>
                                </Alert>
                              )}
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Separator className='my-4' />

                        <div className='space-y-3'>
                          <div>
                            <p className='text-sm font-medium'>
                              {t('Quick actions')}
                            </p>
                            <p className='text-muted-foreground text-xs'>
                              {t(
                                'Use presets or upstream discovery to populate the model list faster.'
                              )}
                            </p>
                          </div>
                          <div className='flex flex-wrap gap-2'>
                            <Button
                              type='button'
                              variant='outline'
                              size='sm'
                              onClick={handleFillRelatedModels}
                              disabled={!basicModels.length}
                            >
                              <FileText
                                className='mr-2 h-4 w-4'
                                aria-hidden='true'
                              />
                              {t('Fill Related Models')}
                            </Button>
                            <Button
                              type='button'
                              variant='outline'
                              size='sm'
                              onClick={handleFillAllModels}
                              disabled={!allModelsList.length}
                            >
                              <Plus
                                className='mr-2 h-4 w-4'
                                aria-hidden='true'
                              />
                              {t('Fill All Models')}
                            </Button>
                            {MODEL_FETCHABLE_TYPES.has(currentType) && (
                              <Button
                                type='button'
                                variant='outline'
                                size='sm'
                                onClick={handleFetchModels}
                              >
                                <Sparkles
                                  className='mr-2 h-4 w-4'
                                  aria-hidden='true'
                                />
                                {t('Fetch from Upstream')}
                              </Button>
                            )}
                            <Button
                              type='button'
                              variant='outline'
                              size='sm'
                              onClick={handleCopyModels}
                              disabled={currentModelsArray.length === 0}
                            >
                              <Copy
                                className='mr-2 h-4 w-4'
                                aria-hidden='true'
                              />
                              {t('Copy All')}
                            </Button>
                            <Button
                              type='button'
                              variant='ghost'
                              size='sm'
                              onClick={handleClearModels}
                              disabled={currentModelsArray.length === 0}
                            >
                              <Eraser
                                className='mr-2 h-4 w-4'
                                aria-hidden='true'
                              />
                              {t('Clear All')}
                            </Button>
                          </div>
                          {prefillGroups.length > 0 && (
                            <div className='flex flex-wrap items-center gap-2'>
                              <span className='text-muted-foreground text-xs'>
                                {t('Preset groups')}:
                              </span>
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
                          )}
                        </div>
                      </div>

                      <div className='border-border/60 rounded-lg border p-4'>
                        <FormField
                          control={form.control}
                          name='model_mapping'
                          render={({ field }) => (
                            <FormItem className='space-y-3'>
                              <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
                                <div className='space-y-1'>
                                  <div className='flex items-center gap-2'>
                                    <FormLabel className='mb-0'>
                                      {t('Model Mapping')}
                                    </FormLabel>
                                    <Tooltip>
                                      <TooltipTrigger
                                        render={
                                          <Button
                                            type='button'
                                            variant='ghost'
                                            size='icon-sm'
                                            className='text-muted-foreground hover:text-foreground size-auto p-0'
                                            aria-label={t(
                                              'How model mapping works'
                                            )}
                                          />
                                        }
                                      >
                                        <HelpCircle
                                          className='h-4 w-4'
                                          aria-hidden='true'
                                        />
                                      </TooltipTrigger>
                                      <TooltipContent
                                        side='top'
                                        align='start'
                                        className='max-w-xs space-y-2 text-left'
                                      >
                                        <p className='text-xs font-semibold tracking-wide uppercase'>
                                          {t('Request flow')}
                                        </p>
                                        <div className='space-y-1 font-mono text-xs'>
                                          {mappingPreviewPairs.map((pair) => (
                                            <div
                                              key={`${pair.source}-${pair.target}`}
                                              className='flex items-center gap-1'
                                            >
                                              <span>{pair.source}</span>
                                              <ArrowRight
                                                className='h-3.5 w-3.5 opacity-70'
                                                aria-hidden='true'
                                              />
                                              <span>{pair.target}</span>
                                            </div>
                                          ))}
                                          {remainingMappingCount > 0 && (
                                            <div className='text-[11px] opacity-70'>
                                              +{remainingMappingCount}{' '}
                                              {t('more mapping')}
                                              {remainingMappingCount > 1
                                                ? 's'
                                                : ''}
                                            </div>
                                          )}
                                        </div>
                                        <p className='text-[11px] leading-relaxed opacity-80'>
                                          {t(
                                            'Users call the model on the left. The platform forwards the request to the upstream model on the right.'
                                          )}
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </div>
                                  <FormDescription>
                                    {t(FIELD_DESCRIPTIONS.MODEL_MAPPING)}
                                  </FormDescription>
                                </div>
                              </div>
                              <FormControl>
                                <ModelMappingEditor
                                  value={field.value || ''}
                                  onChange={field.onChange}
                                  disabled={isSubmitting}
                                  sourceModelOptions={currentModelsArray}
                                  targetModelOptions={modelOptions.map(
                                    (option) => option.value
                                  )}
                                />
                              </FormControl>
                              {modelMappingGuardrail.invalidJson && (
                                <Alert variant='destructive'>
                                  <AlertDescription>
                                    {t(
                                      'Model Mapping must be a JSON object like'
                                    )}{' '}
                                    <code className='font-mono'>
                                      {'{"gpt-4":"Azure-GPT4"}'}
                                    </code>
                                    {t('. Please fix the JSON before saving.')}
                                  </AlertDescription>
                                </Alert>
                              )}
                              {modelMappingGuardrail.missingSourceModels
                                .length > 0 && (
                                <Alert className='border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-50'>
                                  <AlertDescription className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                                    <span>
                                      {t('Add')}{' '}
                                      {formatModelNames(
                                        modelMappingGuardrail.missingSourceModels
                                      )}{' '}
                                      {t(
                                        'to the Models list so users can use them before the mapping sends traffic upstream.'
                                      )}
                                    </span>
                                    <Button
                                      type='button'
                                      variant='outline'
                                      size='sm'
                                      onClick={() => {
                                        updateModels([
                                          ...currentModelsArray,
                                          ...modelMappingGuardrail.missingSourceModels,
                                        ])
                                      }}
                                    >
                                      {t('Add missing models')}
                                    </Button>
                                  </AlertDescription>
                                </Alert>
                              )}
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className='border-border/60 rounded-lg border p-4'>
                        <FormField
                          control={form.control}
                          name='group'
                          render={({ field }) => (
                            <FormItem className='space-y-3'>
                              <div className='space-y-1'>
                                <FormLabel>{t('Groups *')}</FormLabel>
                                <FormDescription>
                                  {t(FIELD_DESCRIPTIONS.GROUP)}
                                </FormDescription>
                              </div>
                              <FormControl>
                                {isLoadingGroups ? (
                                  <Skeleton className='h-10 w-full' />
                                ) : (
                                  <MultiSelect
                                    options={groupOptions}
                                    selected={field.value}
                                    onChange={field.onChange}
                                    placeholder={t(FIELD_PLACEHOLDERS.GROUP)}
                                  />
                                )}
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </ChannelModelsSection>

                  <ChannelAdvancedSection
                    open={advancedSettingsOpen}
                    onOpenChange={handleAdvancedSettingsOpenChange}
                  >
                    {/* ── Routing & Overrides ── */}
                    <div className={sideDrawerSectionClassName()}>
                      <CardHeading
                        title={t('Routing & Overrides')}
                        icon={<Route className='h-4 w-4' />}
                      />
                      <div className='flex flex-col gap-4'>
                        <SubHeading
                          title={t('Routing Strategy')}
                          icon={<Route className='h-3.5 w-3.5' />}
                        />
                        <div className='grid gap-4 sm:grid-cols-2'>
                          <FormField
                            control={form.control}
                            name='priority'
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('Priority')}</FormLabel>
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
                                  {t(FIELD_DESCRIPTIONS.PRIORITY)}
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
                                <FormLabel>{t('Weight')}</FormLabel>
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
                                  {t(FIELD_DESCRIPTIONS.WEIGHT)}
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name='test_model'
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('Test Model')}</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder={t(FIELD_PLACEHOLDERS.TEST_MODEL)}
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                {t(FIELD_DESCRIPTIONS.TEST_MODEL)}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name='auto_ban'
                          render={({ field }) => (
                            <FormItem className='flex items-center justify-between'>
                              <div className='space-y-0.5'>
                                <FormLabel>{t('Auto Ban')}</FormLabel>
                                <FormDescription>
                                  {t(FIELD_DESCRIPTIONS.AUTO_BAN)}
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
                      </div>

                      <div className='flex flex-col gap-4 border-t pt-4'>
                        <SubHeading
                          title={t('Internal Notes')}
                          icon={<FileText className='h-3.5 w-3.5' />}
                        />
                        <div className='grid gap-4 sm:grid-cols-2'>
                          <FormField
                            control={form.control}
                            name='tag'
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('Tag')}</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder={t(FIELD_PLACEHOLDERS.TAG)}
                                    {...field}
                                  />
                                </FormControl>
                                <FormDescription>
                                  {t(FIELD_DESCRIPTIONS.TAG)}
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
                                <FormLabel>{t('Remark')}</FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder={t(FIELD_PLACEHOLDERS.REMARK)}
                                    rows={2}
                                    {...field}
                                  />
                                </FormControl>
                                <FormDescription>
                                  {t(FIELD_DESCRIPTIONS.REMARK)}
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      <div className='flex flex-col gap-4 border-t pt-4'>
                        <SubHeading
                          title={t('Override Rules')}
                          icon={<Code className='h-3.5 w-3.5' />}
                        />

                        <FormField
                          control={form.control}
                          name='status_code_mapping'
                          render={({ field }) => (
                            <FormItem className='space-y-3'>
                              <div className='space-y-1'>
                                <FormLabel>
                                  {t('Status Code Mapping')}
                                </FormLabel>
                                <FormDescription>
                                  {t(
                                    'Map upstream status codes to different codes'
                                  )}
                                </FormDescription>
                              </div>
                              <FormControl>
                                <JsonEditor
                                  value={field.value || ''}
                                  onChange={field.onChange}
                                  disabled={isSubmitting}
                                  keyPlaceholder='400'
                                  valuePlaceholder='500'
                                  keyLabel='Original Code'
                                  valueLabel='Mapped Code'
                                  emptyMessage={t(
                                    'No status code mappings configured.'
                                  )}
                                  template={{ '400': '500', '429': '503' }}
                                  valueType='string'
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name='param_override'
                          render={({ field }) => (
                            <FormItem className='space-y-3 border-t pt-4'>
                              <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
                                <div className='space-y-1'>
                                  <FormLabel>
                                    {t('Parameter Override')}
                                  </FormLabel>
                                  <FormDescription>
                                    {t(
                                      'Override request parameters. Cannot override stream parameter.'
                                    )}
                                  </FormDescription>
                                </div>
                                <div className='flex flex-wrap gap-2'>
                                  <Button
                                    type='button'
                                    variant='outline'
                                    size='sm'
                                    onClick={() =>
                                      setParamOverrideEditorOpen(true)
                                    }
                                  >
                                    <Wand2 className='mr-2 h-4 w-4' />
                                    {t('Visual edit')}
                                  </Button>
                                  <Button
                                    type='button'
                                    variant='outline'
                                    size='sm'
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
                                    <Code className='mr-2 h-4 w-4' />
                                    {t('New Format Template')}
                                  </Button>
                                  <Button
                                    type='button'
                                    variant='ghost'
                                    size='sm'
                                    onClick={() => field.onChange('')}
                                  >
                                    {t('Clear')}
                                  </Button>
                                </div>
                              </div>
                              <FormControl>
                                <Textarea
                                  value={field.value || ''}
                                  onChange={field.onChange}
                                  disabled={isSubmitting}
                                  rows={8}
                                  placeholder={t(
                                    'Override request parameters. Cannot override stream parameter.'
                                  )}
                                  className='max-h-72 min-h-40 resize-y overflow-auto font-mono text-xs'
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name='header_override'
                          render={({ field }) => (
                            <FormItem className='space-y-3 border-t pt-4'>
                              <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
                                <div className='space-y-1'>
                                  <FormLabel>
                                    {t('Request Header Override')}
                                  </FormLabel>
                                  <FormDescription>
                                    {t('Override request headers')}
                                  </FormDescription>
                                </div>
                                <div className='flex flex-wrap gap-2'>
                                  <Button
                                    type='button'
                                    variant='outline'
                                    size='sm'
                                    onClick={() =>
                                      field.onChange(
                                        JSON.stringify(
                                          {
                                            '*': true,
                                            're:^X-Trace-.*$': true,
                                            'X-Foo': '{client_header:X-Foo}',
                                            Authorization: 'Bearer {api_key}',
                                          },
                                          null,
                                          2
                                        )
                                      )
                                    }
                                  >
                                    {t('Fill Template')}
                                  </Button>
                                  <Button
                                    type='button'
                                    variant='outline'
                                    size='sm'
                                    onClick={() =>
                                      field.onChange(
                                        JSON.stringify({ '*': true }, null, 2)
                                      )
                                    }
                                  >
                                    {t('Passthrough Template')}
                                  </Button>
                                  <Button
                                    type='button'
                                    variant='outline'
                                    size='sm'
                                    onClick={() => {
                                      try {
                                        const parsed = JSON.parse(
                                          field.value || '{}'
                                        )
                                        field.onChange(
                                          JSON.stringify(parsed, null, 2)
                                        )
                                      } catch (_e) {
                                        /* ignore invalid JSON */
                                      }
                                    }}
                                  >
                                    {t('Format')}
                                  </Button>
                                  <Button
                                    type='button'
                                    variant='ghost'
                                    size='sm'
                                    onClick={() => field.onChange('')}
                                  >
                                    {t('Clear')}
                                  </Button>
                                </div>
                              </div>
                              <FormControl>
                                <Textarea
                                  className='font-mono text-sm'
                                  rows={6}
                                  value={field.value || ''}
                                  onChange={field.onChange}
                                  disabled={isSubmitting}
                                  placeholder={t(
                                    'Enter JSON to override request headers'
                                  )}
                                />
                              </FormControl>
                              <FormDescription className='text-xs'>
                                {t('Supported variables')}:{' '}
                                <code className='bg-muted rounded px-1 py-0.5'>
                                  {'{api_key}'}
                                </code>{' '}
                                — {t('Channel key')},{' '}
                                <code className='bg-muted rounded px-1 py-0.5'>
                                  {'{client_header:NAME}'}
                                </code>{' '}
                                — {t('Client header value')}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* ── Extra Settings ── */}
                    <div className={sideDrawerSectionClassName()}>
                      <CardHeading
                        title={t('Channel Extra Settings')}
                        icon={<Settings className='h-4 w-4' />}
                      />
                      {(currentType === 1 || currentType === 14) && (
                        <div className='border-border/60 flex flex-col gap-3 border-y py-4'>
                          <SubHeading
                            title={t('Field passthrough controls')}
                            icon={<SlidersHorizontal className='h-3.5 w-3.5' />}
                          />

                          <div className='divide-border space-y-0 divide-y border-y'>
                            <FormField
                              control={form.control}
                              name='allow_service_tier'
                              render={({ field }) => (
                                <FormItem className='flex items-center justify-between gap-3 px-4 py-3'>
                                  <div className='space-y-0.5'>
                                    <FormLabel className='text-sm'>
                                      {t('Allow service_tier passthrough')}
                                    </FormLabel>
                                    <FormDescription>
                                      {t('Pass through the service_tier field')}
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

                            {currentType === 1 && (
                              <>
                                <FormField
                                  control={form.control}
                                  name='disable_store'
                                  render={({ field }) => (
                                    <FormItem className='flex items-center justify-between gap-3 px-4 py-3'>
                                      <div className='space-y-0.5'>
                                        <FormLabel className='text-sm'>
                                          {t('Disable store passthrough')}
                                        </FormLabel>
                                        <FormDescription>
                                          {t(
                                            'When enabled, the store field will be blocked'
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

                                <FormField
                                  control={form.control}
                                  name='allow_safety_identifier'
                                  render={({ field }) => (
                                    <FormItem className='flex items-center justify-between gap-3 px-4 py-3'>
                                      <div className='space-y-0.5'>
                                        <FormLabel className='text-sm'>
                                          {t(
                                            'Allow safety_identifier passthrough'
                                          )}
                                        </FormLabel>
                                        <FormDescription>
                                          {t(
                                            'Pass through the safety_identifier field'
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

                                <FormField
                                  control={form.control}
                                  name='allow_include_obfuscation'
                                  render={({ field }) => (
                                    <FormItem className='flex items-center justify-between gap-3 px-4 py-3'>
                                      <div className='space-y-0.5'>
                                        <FormLabel className='text-sm'>
                                          {t(
                                            'Allow include usage obfuscation passthrough'
                                          )}
                                        </FormLabel>
                                        <FormDescription>
                                          {t(
                                            'Pass through the include field for usage obfuscation'
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

                                <FormField
                                  control={form.control}
                                  name='allow_inference_geo'
                                  render={({ field }) => (
                                    <FormItem className='flex items-center justify-between gap-3 px-4 py-3'>
                                      <div className='space-y-0.5'>
                                        <FormLabel className='text-sm'>
                                          {t(
                                            'Allow inference geography passthrough'
                                          )}
                                        </FormLabel>
                                        <FormDescription>
                                          {t(
                                            'Pass through the inference_geo field for geographic routing'
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
                              </>
                            )}

                            {currentType === 14 && (
                              <>
                                <FormField
                                  control={form.control}
                                  name='allow_inference_geo'
                                  render={({ field }) => (
                                    <FormItem className='flex items-center justify-between gap-3 px-4 py-3'>
                                      <div className='space-y-0.5'>
                                        <FormLabel className='text-sm'>
                                          {t('Allow inference_geo passthrough')}
                                        </FormLabel>
                                        <FormDescription>
                                          {t(
                                            'Pass through the inference_geo field for Claude data residency region control'
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

                                <FormField
                                  control={form.control}
                                  name='allow_speed'
                                  render={({ field }) => (
                                    <FormItem className='flex items-center justify-between gap-3 px-4 py-3'>
                                      <div className='space-y-0.5'>
                                        <FormLabel className='text-sm'>
                                          {t('Allow speed passthrough')}
                                        </FormLabel>
                                        <FormDescription>
                                          {t(
                                            'Pass through the speed field for Claude inference speed mode control'
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

                                <FormField
                                  control={form.control}
                                  name='claude_beta_query'
                                  render={({ field }) => (
                                    <FormItem className='flex items-center justify-between gap-3 px-4 py-3'>
                                      <div className='space-y-0.5'>
                                        <FormLabel className='text-sm'>
                                          {t(
                                            'Allow Claude beta query passthrough'
                                          )}
                                        </FormLabel>
                                        <FormDescription>
                                          {t(
                                            'Pass through the anthropic-beta header for beta features'
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
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      <div className='divide-border space-y-0 divide-y border-y'>
                        {currentType === 1 && (
                          <FormField
                            control={form.control}
                            name='force_format'
                            render={({ field }) => (
                              <FormItem className='flex items-center justify-between px-4 py-3'>
                                <div className='space-y-0.5'>
                                  <FormLabel>{t('Force Format')}</FormLabel>
                                  <FormDescription>
                                    {t(
                                      'Force format response to OpenAI standard (OpenAI channel only)'
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
                        )}

                        <FormField
                          control={form.control}
                          name='thinking_to_content'
                          render={({ field }) => (
                            <FormItem className='flex items-center justify-between px-4 py-3'>
                              <div className='space-y-0.5'>
                                <FormLabel>
                                  {t('Thinking to Content')}
                                </FormLabel>
                                <FormDescription>
                                  {t(
                                    'Convert reasoning_content to <think> tag in content'
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

                        <FormField
                          control={form.control}
                          name='pass_through_body_enabled'
                          render={({ field }) => (
                            <FormItem className='flex items-center justify-between px-4 py-3'>
                              <div className='space-y-0.5'>
                                <FormLabel>{t('Pass Through Body')}</FormLabel>
                                <FormDescription>
                                  {t('Pass request body directly to upstream')}
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

                      <FormField
                        control={form.control}
                        name='proxy'
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('Proxy Address')}</FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t('socks5://user:pass@host:port')}
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              {t(
                                'Network proxy for this channel (supports socks5 protocol)'
                              )}
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
                            <FormLabel>{t('System Prompt')}</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder={t(
                                  'Enter system prompt (user prompt takes priority)'
                                )}
                                rows={3}
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              {t('Default system prompt for this channel')}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name='system_prompt_override'
                        render={({ field }) => (
                          <FormItem className='flex items-center justify-between'>
                            <div className='space-y-0.5'>
                              <FormLabel>
                                {t('System Prompt Concatenation')}
                              </FormLabel>
                              <FormDescription>
                                {t(
                                  'Concatenate channel system prompt with user&apos;s prompt'
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

                      {MODEL_FETCHABLE_TYPES.has(currentType) && (
                        <div className='border-border/60 flex flex-col gap-3 border-y py-4'>
                          <SubHeading
                            title={t('Upstream Model Detection Settings')}
                            icon={<RefreshCw className='h-3.5 w-3.5' />}
                          />
                          <div className='divide-border space-y-0 divide-y border-y'>
                            <FormField
                              control={form.control}
                              name='upstream_model_update_check_enabled'
                              render={({ field }) => (
                                <FormItem className='flex items-center justify-between px-4 py-3'>
                                  <div className='space-y-0.5'>
                                    <FormLabel>
                                      {t('Upstream Model Update Check')}
                                    </FormLabel>
                                    <FormDescription>
                                      {t(
                                        'Periodically check for upstream model changes'
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
                            <FormField
                              control={form.control}
                              name='upstream_model_update_auto_sync_enabled'
                              render={({ field }) => (
                                <FormItem className='flex items-center justify-between px-4 py-3'>
                                  <div className='space-y-0.5'>
                                    <FormLabel>
                                      {t('Auto Sync Upstream Models')}
                                    </FormLabel>
                                    <FormDescription>
                                      {t(
                                        'Automatically sync model list when upstream changes are detected'
                                      )}
                                    </FormDescription>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      disabled={
                                        !upstreamModelUpdateCheckEnabled
                                      }
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField
                            control={form.control}
                            name='upstream_model_update_ignored_models'
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  {t('Ignored upstream models')}
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder={t(
                                      'e.g., gpt-4.1-nano,regex:^claude-.*$,regex:^sora-.*$'
                                    )}
                                    {...field}
                                  />
                                </FormControl>
                                <FormDescription>
                                  {t(
                                    'Comma-separated exact model names. Prefix with regex: to ignore by regular expression.'
                                  )}
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className='text-muted-foreground space-y-2 border-t pt-3 text-xs'>
                            <div>
                              <span className='text-foreground font-medium'>
                                {t('Last check time')}:
                              </span>{' '}
                              {formatUnixTime(upstreamUpdateMeta.lastCheckTime)}
                            </div>
                            <div>
                              <span className='text-foreground font-medium'>
                                {t('Last detected addable models')}:
                              </span>{' '}
                              {upstreamUpdateMeta.detectedModels.length ===
                              0 ? (
                                t('None')
                              ) : (
                                <>
                                  <span className='break-all'>
                                    {upstreamDetectedModelsPreview.join(', ')}
                                  </span>
                                  {upstreamDetectedModelsOmittedCount > 0 && (
                                    <span className='ml-1'>
                                      {t(
                                        '({{total}} total, {{omit}} omitted)',
                                        {
                                          total:
                                            upstreamUpdateMeta.detectedModels
                                              .length,
                                          omit: upstreamDetectedModelsOmittedCount,
                                        }
                                      )}
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </ChannelAdvancedSection>
                </>
              )}
            </form>
          </Form>

          <SheetFooter className={sideDrawerFooterClassName()}>
            <SheetClose
              render={<Button variant='outline' disabled={isSubmitting} />}
            >
              {t('Cancel')}
            </SheetClose>
            <Button form='channel-form' type='submit' disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              )}
              {isEditing ? t('Update Channel') : t('Save changes')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {paramOverrideEditorOpen && (
        <ParamOverrideEditorDialog
          open={paramOverrideEditorOpen}
          value={form.watch('param_override') || ''}
          onOpenChange={setParamOverrideEditorOpen}
          onSave={(nextValue) => {
            form.setValue('param_override', nextValue, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }}
        />
      )}

      {advancedCustomEditorOpen && (
        <AdvancedCustomEditorDialog
          open={advancedCustomEditorOpen}
          value={form.watch('advanced_custom') || ''}
          onOpenChange={setAdvancedCustomEditorOpen}
          onSave={(nextValue) => {
            form.setValue('advanced_custom', nextValue, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }}
        />
      )}

      {/* Fetch Models Dialog */}
      <FetchModelsDialog
        open={fetchModelsDialogOpen}
        onOpenChange={setFetchModelsDialogOpen}
        onModelsSelected={(models) => {
          form.setValue('models', formatModelsArray(models))
        }}
        redirectModels={redirectModelList}
        redirectSourceModels={redirectModelKeyList}
        customFetcher={!isEditing ? createModeFetcher : undefined}
        channelName={!isEditing ? currentName?.trim() : undefined}
        existingModelsOverride={
          !isEditing
            ? parseModelsString(form.getValues('models') || '')
            : undefined
        }
      />

      <SecureVerificationDialog
        open={verificationOpen}
        onOpenChange={(open) => {
          if (!open) {
            cancelVerification()
          }
        }}
        methods={verificationMethods}
        state={verificationState}
        onVerify={async (method, code) => {
          await executeVerification(method, code)
        }}
        onCancel={cancelVerification}
        onCodeChange={setVerificationCode}
        onMethodChange={switchVerificationMethod}
      />

      {/* Missing Models Confirmation Dialog */}
      <MissingModelsConfirmationDialog
        open={missingModelsDialogOpen}
        missingModels={missingModelsList}
        onConfirm={handleMissingModelsAction}
        onOpenChange={setMissingModelsDialogOpen}
      />

      <StatusCodeRiskDialog
        open={statusCodeRiskOpen}
        onOpenChange={(v) => {
          if (!v) handleStatusCodeRiskAction(false)
        }}
        detailItems={statusCodeRiskDetailItems}
        onConfirm={() => handleStatusCodeRiskAction(true)}
      />
    </>
  )
}
