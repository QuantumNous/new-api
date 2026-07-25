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
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm, type SubmitErrorHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Alert02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { trackYahooApiKeyCreatedConversion } from '@/lib/analytics/yahoo'
import { getCurrencyDisplay, getCurrencyLabel } from '@/lib/currency'
import { useCanUseGroups } from '@/hooks/use-enterprise'
import { useMediaQuery } from '@/hooks/use-media-query'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { DateTimePicker } from '@/components/datetime-picker'
import { MultiSelect } from '@/components/multi-select'
import { OperationDocumentationLink } from '@/components/operation-documentation-link'
import { resolveCreateScope } from '@/features/available-models'
import { ModelAccessPreview } from '@/features/available-models/components/model-access-preview'
import { createApiKey, updateApiKey, getApiKey } from '../api'
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants'
import {
  getApiKeyFormSchema,
  type ApiKeyFormValues,
  getApiKeyFormDefaultValues,
  transformFormDataToPayload,
  transformApiKeyToFormDefaults,
} from '../lib'
import {
  getApiKeyModelPreviewPlacement,
  isApiKeyUpdateDetailReady,
  requestApiKeyModelAccessPreservation,
  requiresModelAccessForApiKeyMutation,
  resolveSafeCreateScope,
  shouldApplyResolvedCreateGroup,
  shouldReinitializeCreateForm,
} from '../lib/api-key-create-dialog'
import {
  getApiKeyModelAccessState,
  getApiKeyModelAllowlistOptions,
  getApiKeyModelPreviewCopy,
  hasUsableApiKeyModelAccess,
} from '../lib/api-key-model-access'
import { type ApiKey } from '../types'
import {
  ApiKeyGroupCombobox,
  type ApiKeyGroupOption,
} from './api-key-group-combobox'
import { ApiKeyModelPreviewDrawer } from './api-key-model-preview-drawer'
import { ApiKeyRevealDialog } from './api-key-reveal-dialog'
import { useApiKeys } from './api-keys-provider'

type ApiKeyMutateDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: ApiKey
  initialCreateGroup?: string | null
  createRequestKey?: string | null
  createRequestedGroup?: string
}

export function ApiKeysMutateDrawer({
  open,
  onOpenChange,
  currentRow,
  initialCreateGroup,
  createRequestKey,
  createRequestedGroup,
}: ApiKeyMutateDrawerProps) {
  const { t } = useTranslation()
  const isUpdate = !!currentRow
  const { triggerRefresh, modelAccessQuery } = useApiKeys()
  const canUseGroups = useCanUseGroups()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [revealKey, setRevealKey] = useState<string | null>(null)
  const [loadedUpdateKey, setLoadedUpdateKey] = useState<ApiKey | null>(null)
  const initializedCreateRequestRef = useRef<string | undefined>(undefined)
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const modelPreviewPlacement = getApiKeyModelPreviewPlacement(isDesktop)
  const modelAccess = modelAccessQuery.data
  const groups: ApiKeyGroupOption[] = useMemo(
    () =>
      modelAccess?.groups.map((group) => ({
        value: group.id,
        label: group.label,
        desc: group.description,
        ratio: group.ratio ?? undefined,
      })) ?? [],
    [modelAccess]
  )
  const canSelectGroups =
    canUseGroups &&
    modelAccess?.scope_mode === 'selectable_group' &&
    groups.length > 0
  const schema = getApiKeyFormSchema(t)

  const form = useForm<ApiKeyFormValues>({
    resolver: zodResolver(schema),
    defaultValues: getApiKeyFormDefaultValues(false),
  })

  useEffect(() => {
    let cancelled = false
    const currentKeyId = currentRow?.id

    if (!open || !isUpdate || currentKeyId === undefined) {
      setLoadedUpdateKey(null)
      return
    }

    setLoadedUpdateKey(null)
    void getApiKey(currentKeyId).then((result) => {
      if (!cancelled && result.success && result.data) {
        setLoadedUpdateKey(result.data)
        form.reset(transformApiKeyToFormDefaults(result.data))
      }
    })

    return () => {
      cancelled = true
    }
  }, [currentRow?.id, form, isUpdate, open])

  useEffect(() => {
    const scopeReady = modelAccess !== undefined || modelAccessQuery.isError
    if (
      shouldReinitializeCreateForm({
        initializedRequestKey: initializedCreateRequestRef.current,
        nextRequestKey: createRequestKey,
        open,
        isUpdate,
        scopeReady,
      })
    ) {
      const requestedGroup = createRequestKey
        ? createRequestedGroup
        : initialCreateGroup
      const createScope = resolveSafeCreateScope(modelAccess, requestedGroup)
      form.reset(getApiKeyFormDefaultValues(false, createScope))
      initializedCreateRequestRef.current = createRequestKey ?? 'manual'
    } else if (!open) {
      initializedCreateRequestRef.current = undefined
    }
  }, [
    open,
    isUpdate,
    form,
    modelAccess,
    modelAccessQuery.isError,
    initialCreateGroup,
    createRequestKey,
    createRequestedGroup,
  ])

  useEffect(() => {
    const groupDirty = form.getFieldState('group').isDirty
    if (
      !shouldApplyResolvedCreateGroup({
        access: modelAccess,
        groupDirty,
        initialized: initializedCreateRequestRef.current !== undefined,
        isUpdate,
        open,
      }) ||
      !modelAccess
    ) {
      return
    }

    const requestedGroup = createRequestKey
      ? createRequestedGroup
      : initialCreateGroup
    const resolvedGroup = resolveCreateScope(modelAccess, requestedGroup)
    const nextGroup = resolvedGroup ?? ''
    if (form.getValues('group') !== nextGroup) {
      form.setValue('group', nextGroup, { shouldDirty: false })
    }
  }, [
    createRequestKey,
    createRequestedGroup,
    form,
    initialCreateGroup,
    isUpdate,
    modelAccess,
    open,
  ])

  // Only create mode may safely fall back to another selectable scope. Existing
  // keys keep their saved group until the user explicitly changes it.
  useEffect(() => {
    if (isUpdate || groups.length === 0) return
    const currentGroup = form.getValues('group')
    if (currentGroup && !groups.some((g) => g.value === currentGroup)) {
      const fallbackGroup =
        groups.find((g) => g.value === 'default')?.value ??
        groups[0]?.value ??
        ''
      form.setValue('group', fallbackGroup)
      if (currentGroup === 'auto') {
        form.setValue('cross_group_retry', false)
      }
    }
  }, [groups, form, isUpdate])

  const onSubmit = async (data: ApiKeyFormValues) => {
    const updateDetailReady = isApiKeyUpdateDetailReady(
      isUpdate,
      currentRow?.id,
      loadedUpdateKey?.id
    )
    if (!updateDetailReady) {
      toast.error(t('API key is loading, please try again in a moment'))
      return
    }

    const modelAccessRequired = requiresModelAccessForApiKeyMutation(
      isUpdate,
      form.formState.dirtyFields,
      data
    )
    if (modelAccessRequired && !hasUsableApiKeyModelAccess(modelAccess)) {
      toast.error(t('Unable to load available models'))
      return
    }

    setIsSubmitting(true)
    try {
      let basePayload = transformFormDataToPayload(data, canUseGroups)

      if (isUpdate && !modelAccessRequired) {
        basePayload = requestApiKeyModelAccessPreservation(basePayload)
      }

      if (isUpdate && currentRow) {
        const result = await updateApiKey({
          ...basePayload,
          id: currentRow.id,
        })
        if (result.success) {
          toast.success(t(SUCCESS_MESSAGES.API_KEY_UPDATED))
          onOpenChange(false)
          triggerRefresh()
        } else {
          toast.error(result.message || t(ERROR_MESSAGES.UPDATE_FAILED))
        }
      } else {
        // Create mode - handle batch creation
        const count = data.tokenCount || 1
        let successCount = 0
        let firstKey: string | null = null

        for (let i = 0; i < count; i++) {
          const result = await createApiKey({
            ...basePayload,
            name:
              i === 0 && data.name
                ? data.name
                : `${data.name || 'default'}-${Math.random().toString(36).slice(2, 8)}`,
          })
          if (result.success) {
            successCount++
            if (i === 0) firstKey = result.data?.key ?? null
          } else {
            toast.error(result.message || t(ERROR_MESSAGES.CREATE_FAILED))
            break
          }
        }

        if (successCount > 0) {
          trackYahooApiKeyCreatedConversion()
          onOpenChange(false)
          triggerRefresh()
          // OpenRouter-style: reveal the newly created key once. For batch
          // creation (no single key to highlight) fall back to a toast.
          if (count === 1 && firstKey) {
            setRevealKey(firstKey)
          } else {
            toast.success(
              t('Successfully created {{count}} API Key(s)', {
                count: successCount,
              })
            )
          }
        }
      }
    } catch {
      toast.error(t(ERROR_MESSAGES.UNEXPECTED))
    } finally {
      setIsSubmitting(false)
    }
  }

  const onInvalid: SubmitErrorHandler<ApiKeyFormValues> = () => {
    toast.error(t('Please fix the highlighted fields before saving'))
  }

  const handleSetExpiry = (months: number, days: number, hours: number) => {
    if (months === 0 && days === 0 && hours === 0) {
      form.setValue('expired_time', undefined)
      return
    }

    const now = new Date()
    now.setMonth(now.getMonth() + months)
    now.setDate(now.getDate() + days)
    now.setHours(now.getHours() + hours)

    form.setValue('expired_time', now)
  }

  const { meta: currencyMeta } = getCurrencyDisplay()
  const currencyLabel = getCurrencyLabel()
  const tokensOnly = currencyMeta.kind === 'tokens'
  const quotaLabel = t('Quota ({{currency}})', { currency: currencyLabel })
  const quotaPlaceholder = tokensOnly
    ? t('Enter quota in tokens')
    : t('Enter quota in {{currency}}', { currency: currencyLabel })
  const selectedGroup = form.watch('group')
  const modelLimitsEnabled = form.watch('model_limits_enabled')
  const modelLimits = form.watch('model_limits')
  const crossGroupRetry = form.watch('cross_group_retry')
  const allowlistEnabled = isUpdate && modelLimitsEnabled
  const modelAccessState = useMemo(
    () =>
      modelAccess
        ? getApiKeyModelAccessState(
            modelAccess,
            selectedGroup,
            allowlistEnabled,
            modelLimits
          )
        : null,
    [allowlistEnabled, modelAccess, modelLimits, selectedGroup]
  )
  const allowlistOptions = useMemo(
    () => getApiKeyModelAllowlistOptions(modelAccessState?.scopeModels ?? []),
    [modelAccessState?.scopeModels]
  )
  const previewCopy = useMemo(() => {
    if (!modelAccess || !modelAccessState) return null
    const mode = isUpdate ? 'edit' : 'create'
    return getApiKeyModelPreviewCopy(
      modelAccess,
      modelAccessState,
      mode,
      allowlistEnabled
    )
  }, [allowlistEnabled, isUpdate, modelAccess, modelAccessState])
  const previewScopeTitle = previewCopy
    ? t(previewCopy.titleKey, previewCopy.titleValues)
    : t('Unavailable scope')
  const previewSummary = previewCopy
    ? t(previewCopy.summaryKey, previewCopy.summaryValues)
    : ''
  const previewScopeDescription = modelAccessState?.scope?.description
  const invalidAllowlistCount =
    modelAccessState?.invalidAllowlistItems.length ?? 0
  const unlimitedQuota = form.watch('unlimited_quota')
  // Create-mode credit-limit input value: blank when unlimited, otherwise the
  // dollar amount currently held in `remain_quota_dollars`.
  const watchedQuotaDollars = form.watch('remain_quota_dollars')
  const creditLimitInputValue = unlimitedQuota
    ? ''
    : (watchedQuotaDollars ?? '')

  // OpenRouter-style single "credit limit" input: blank => unlimited.
  const handleCreditLimitChange = (raw: string) => {
    const trimmed = raw.trim()
    if (trimmed === '') {
      // Blank => unlimited; keep unlimited_quota valid and clear the amount.
      form.setValue('unlimited_quota', true, { shouldValidate: true })
      form.setValue('remain_quota_dollars', undefined, { shouldValidate: true })
      return
    }
    const parsed = parseFloat(trimmed)
    form.setValue('unlimited_quota', false, { shouldValidate: true })
    form.setValue('remain_quota_dollars', Number.isNaN(parsed) ? 0 : parsed, {
      shouldValidate: true,
    })
  }

  const renderModelAccessError = (className?: string) => (
    <Alert variant='destructive' className={className}>
      <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} aria-hidden='true' />
      <AlertTitle>{t('Unable to load available models')}</AlertTitle>
      <AlertDescription className='flex flex-col items-start gap-2'>
        <span>{t('Request failed')}</span>
        <Button
          type='button'
          size='sm'
          variant='outline'
          disabled={modelAccessQuery.isFetching}
          onClick={() => void modelAccessQuery.refetch()}
        >
          {modelAccessQuery.isFetching && <Spinner data-icon='inline-start' />}
          {t('Retry')}
        </Button>
      </AlertDescription>
    </Alert>
  )

  const renderDesktopModelPreview = () => {
    if (modelAccessQuery.isError && !modelAccess) {
      return renderModelAccessError()
    }

    if (!modelAccessState) {
      return (
        <div className='flex flex-col gap-3' aria-label={t('Loading models')}>
          <Skeleton className='h-8 w-48' />
          <Skeleton className='h-20 w-full' />
          <Skeleton className='h-28 w-full' />
          <Skeleton className='h-40 w-full' />
        </div>
      )
    }

    return (
      <ModelAccessPreview
        defaultRatio={modelAccessState.defaultRatio}
        modelRatios={modelAccessState.modelRatios}
        models={modelAccessState.effectiveModels}
        totalCount={modelAccessState.scopeModels.length}
        scopeKey={selectedGroup || previewScopeTitle}
        scopeTitle={previewScopeTitle}
        scopeDescription={previewScopeDescription}
        summary={previewSummary}
        headerAction={<OperationDocumentationLink size='xs' />}
        emptyTitle={previewCopy ? t(previewCopy.emptyTitleKey) : undefined}
        emptyDescription={
          previewCopy ? t(previewCopy.emptyDescriptionKey) : undefined
        }
      />
    )
  }

  const renderMobileModelPreview = () => {
    if (modelAccessQuery.isError && !modelAccess) {
      return renderModelAccessError('lg:hidden')
    }
    if (!modelAccessState) {
      return <Skeleton className='h-16 w-full lg:hidden' />
    }
    return (
      <ApiKeyModelPreviewDrawer
        defaultRatio={modelAccessState.defaultRatio}
        modelRatios={modelAccessState.modelRatios}
        models={modelAccessState.effectiveModels}
        totalCount={modelAccessState.scopeModels.length}
        scopeKey={selectedGroup || previewScopeTitle}
        scopeTitle={previewScopeTitle}
        scopeDescription={previewScopeDescription}
        summary={previewSummary}
        drawerTitle={previewCopy ? t(previewCopy.drawerTitleKey) : ''}
        drawerDescription={
          previewCopy ? t(previewCopy.drawerDescriptionKey) : ''
        }
        emptyTitle={previewCopy ? t(previewCopy.emptyTitleKey) : ''}
        emptyDescription={previewCopy ? t(previewCopy.emptyDescriptionKey) : ''}
      />
    )
  }

  let submitLabel = isUpdate ? t('Save changes') : t('Create API Key')
  if (isSubmitting) {
    submitLabel = t('Saving...')
  }
  const modelAccessRequired = requiresModelAccessForApiKeyMutation(
    isUpdate,
    form.formState.dirtyFields,
    {
      group: selectedGroup,
      model_limits_enabled: modelLimitsEnabled,
      model_limits: modelLimits,
      cross_group_retry: crossGroupRetry,
    }
  )
  const updateDetailReady = isApiKeyUpdateDetailReady(
    isUpdate,
    currentRow?.id,
    loadedUpdateKey?.id
  )
  const submitDisabled =
    isSubmitting ||
    !updateDetailReady ||
    (modelAccessRequired && !hasUsableApiKeyModelAccess(modelAccess))

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          onOpenChange(v)
          if (!v) {
            form.reset()
          }
        }}
      >
        <DialogContent className='flex h-[min(90vh,52rem)] max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg lg:max-w-[68rem]'>
          <DialogHeader className='shrink-0 border-b p-4 pr-12'>
            <DialogTitle>
              {isUpdate ? t('Edit API key') : t('Create API Key')}
            </DialogTitle>
            <DialogDescription>
              {isUpdate
                ? t('Update the API key by providing necessary info.')
                : t('Add a new API key by providing necessary info.')}
            </DialogDescription>
          </DialogHeader>

          <div className='grid min-h-0 flex-1 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]'>
            <ScrollArea className='min-h-0 lg:border-r'>
              <div className='p-4'>
                <Form {...form}>
                  <form
                    id='api-key-form'
                    onSubmit={form.handleSubmit(onSubmit, onInvalid)}
                    className='flex flex-col gap-4'
                  >
                    <FormField
                      control={form.control}
                      name='name'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('Name')}</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder={t('Enter a name')} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* PLG users never see groups; their keys are forced to plg server-side. */}
                    {!isUpdate && canSelectGroups && (
                      <>
                        <FormField
                          control={form.control}
                          name='group'
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('Group')}</FormLabel>
                              <FormControl>
                                <ApiKeyGroupCombobox
                                  options={groups}
                                  value={field.value}
                                  onValueChange={field.onChange}
                                  placeholder={t('Select a group')}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {selectedGroup === 'auto' && (
                          <FormField
                            control={form.control}
                            name='cross_group_retry'
                            render={({ field }) => (
                              <FormItem className='flex items-center justify-between gap-3 rounded-md border p-3'>
                                <div className='flex flex-col gap-0.5'>
                                  <FormLabel className='text-sm'>
                                    {t('Cross-group retry')}
                                  </FormLabel>
                                  <FormDescription className='text-xs'>
                                    {t(
                                      'When enabled, if channels in the current group fail, it will try channels in the next group in order.'
                                    )}
                                  </FormDescription>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={!!field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        )}
                      </>
                    )}

                    {!isUpdate && (
                      // CREATE mode (OpenRouter-style): a single optional credit-limit
                      // input. Blank => unlimited; a number => that quota amount.
                      <FormItem>
                        <FormLabel>{t('Credit limit (optional)')}</FormLabel>
                        <FormControl>
                          <Input
                            type='number'
                            min={0}
                            step={tokensOnly ? 1 : 0.01}
                            value={creditLimitInputValue}
                            placeholder={t('Leave blank for unlimited')}
                            onChange={(e) =>
                              handleCreditLimitChange(e.target.value)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}

                    {!isUpdate && (
                      // Mirrors OpenRouter's "Reset limit every…" field. New-API has no per-token
                      // periodic credit reset, so it is shown disabled at N/A for visual parity.
                      <FormItem>
                        <FormLabel>{t('Reset limit every...')}</FormLabel>
                        <FormControl>
                          <Input value={t('N/A')} disabled readOnly />
                        </FormControl>
                      </FormItem>
                    )}

                    {isUpdate && (
                      <>
                        {!unlimitedQuota && (
                          <FormField
                            control={form.control}
                            name='remain_quota_dollars'
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{quotaLabel}</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    type='number'
                                    step={tokensOnly ? 1 : 0.01}
                                    placeholder={quotaPlaceholder}
                                    onChange={(e) =>
                                      field.onChange(
                                        parseFloat(e.target.value) || 0
                                      )
                                    }
                                  />
                                </FormControl>
                                <FormDescription>
                                  {tokensOnly
                                    ? t('Enter the quota amount in tokens')
                                    : t(
                                        'Enter the quota amount in {{currency}}',
                                        {
                                          currency: currencyLabel,
                                        }
                                      )}
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        <FormField
                          control={form.control}
                          name='unlimited_quota'
                          render={({ field }) => (
                            <FormItem className='flex items-center justify-between gap-3 rounded-md border p-3'>
                              <div className='flex flex-col gap-0.5'>
                                <FormLabel className='text-sm'>
                                  {t('Unlimited Quota')}
                                </FormLabel>
                                <FormDescription className='text-xs'>
                                  {t('Enable unlimited quota for this API key')}
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

                    <FormField
                      control={form.control}
                      name='expired_time'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('Expiration Time')}</FormLabel>
                          <div className='flex flex-col gap-2'>
                            <FormControl>
                              <DateTimePicker
                                value={field.value}
                                onChange={field.onChange}
                                placeholder={t('Never expires')}
                                className='min-w-0 [&_input[type=time]]:w-24 sm:[&_input[type=time]]:w-32'
                              />
                            </FormControl>
                            <div className='grid grid-cols-4 gap-2'>
                              <Button
                                type='button'
                                variant='outline'
                                size='sm'
                                className='px-2 text-xs sm:px-3 sm:text-sm'
                                onClick={() => handleSetExpiry(0, 0, 0)}
                              >
                                {t('Never')}
                              </Button>
                              <Button
                                type='button'
                                variant='outline'
                                size='sm'
                                className='px-2 text-xs sm:px-3 sm:text-sm'
                                onClick={() => handleSetExpiry(1, 0, 0)}
                              >
                                {t('1 Month')}
                              </Button>
                              <Button
                                type='button'
                                variant='outline'
                                size='sm'
                                className='px-2 text-xs sm:px-3 sm:text-sm'
                                onClick={() => handleSetExpiry(0, 1, 0)}
                              >
                                {t('1 Day')}
                              </Button>
                              <Button
                                type='button'
                                variant='outline'
                                size='sm'
                                className='px-2 text-xs sm:px-3 sm:text-sm'
                                onClick={() => handleSetExpiry(0, 0, 1)}
                              >
                                {t('1 Hour')}
                              </Button>
                            </div>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {isUpdate && (
                      <>
                        {canSelectGroups && (
                          <FormField
                            control={form.control}
                            name='group'
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('Group')}</FormLabel>
                                <FormControl>
                                  <ApiKeyGroupCombobox
                                    options={groups}
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    placeholder={t('Select a group')}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        {canSelectGroups && selectedGroup === 'auto' && (
                          <FormField
                            control={form.control}
                            name='cross_group_retry'
                            render={({ field }) => (
                              <FormItem className='flex items-center justify-between gap-3 rounded-md border p-3'>
                                <div className='flex flex-col gap-0.5'>
                                  <FormLabel className='text-sm'>
                                    {t('Cross-group retry')}
                                  </FormLabel>
                                  <FormDescription className='text-xs'>
                                    {t(
                                      'When enabled, if channels in the current group fail, it will try channels in the next group in order.'
                                    )}
                                  </FormDescription>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={!!field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        )}

                        <FormField
                          control={form.control}
                          name='model_limits_enabled'
                          render={({ field }) => (
                            <FormItem className='flex items-center justify-between gap-3 rounded-md border p-3'>
                              <div className='flex flex-col gap-0.5'>
                                <FormLabel htmlFor='model-limits-enabled'>
                                  {t('Enable model allowlist')}
                                </FormLabel>
                                <FormDescription>
                                  {t(
                                    'When disabled, every model in the current API key scope is allowed.'
                                  )}
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  id='model-limits-enabled'
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        {allowlistEnabled && (
                          <FormField
                            control={form.control}
                            name='model_limits'
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('Allowed models')}</FormLabel>
                                <FormControl>
                                  <MultiSelect
                                    options={allowlistOptions}
                                    selected={field.value}
                                    onChange={field.onChange}
                                    placeholder={t('Select allowed models')}
                                    maxVisibleChips={4}
                                  />
                                </FormControl>
                                <FormDescription>
                                  {t(
                                    'Only selected models can be called. An empty allowlist permits zero models.'
                                  )}
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        {allowlistEnabled && modelLimits.length === 0 && (
                          <Alert variant='destructive'>
                            <HugeiconsIcon
                              icon={Alert02Icon}
                              strokeWidth={2}
                              aria-hidden='true'
                            />
                            <AlertTitle>
                              {t('No models are allowed')}
                            </AlertTitle>
                            <AlertDescription>
                              {t(
                                'The current allowlist is empty. After saving, this API key will not be able to call any model.'
                              )}
                            </AlertDescription>
                          </Alert>
                        )}

                        {allowlistEnabled && invalidAllowlistCount > 0 && (
                          <Alert>
                            <HugeiconsIcon
                              icon={Alert02Icon}
                              strokeWidth={2}
                              aria-hidden='true'
                            />
                            <AlertTitle>
                              {t(
                                '{{count}} saved models are outside this scope',
                                {
                                  count: invalidAllowlistCount,
                                }
                              )}
                            </AlertTitle>
                            <AlertDescription>
                              {t(
                                'They are preserved for compatibility but do not grant access. Remove them explicitly if they are no longer needed.'
                              )}
                            </AlertDescription>
                          </Alert>
                        )}

                        <FormField
                          control={form.control}
                          name='allow_ips'
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                {t('IP Whitelist (supports CIDR)')}
                              </FormLabel>
                              <FormControl>
                                <Textarea
                                  {...field}
                                  className='min-h-20 resize-none'
                                  placeholder={t(
                                    'One IP per line (empty for no restriction)'
                                  )}
                                  rows={3}
                                />
                              </FormControl>
                              <FormDescription>
                                {t(
                                  'Do not over-trust this feature. IP may be spoofed. Please use with nginx, CDN and other gateways.'
                                )}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}

                    {modelPreviewPlacement === 'mobile' &&
                      renderMobileModelPreview()}
                  </form>
                </Form>
              </div>
            </ScrollArea>

            {modelPreviewPlacement === 'desktop' && (
              <aside className='bg-muted/20 min-h-0'>
                <ScrollArea className='h-full'>
                  <div className='p-4'>{renderDesktopModelPreview()}</div>
                </ScrollArea>
              </aside>
            )}
          </div>

          <DialogFooter className='mx-0 mb-0 shrink-0 rounded-b-xl'>
            <DialogClose
              render={<Button variant='outline' className='w-full sm:w-auto' />}
            >
              {t('Close')}
            </DialogClose>
            <Button
              type='button'
              onClick={form.handleSubmit(onSubmit, onInvalid)}
              disabled={submitDisabled}
              className='w-full sm:w-auto'
            >
              {isSubmitting && <Spinner data-icon='inline-start' />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ApiKeyRevealDialog
        open={!!revealKey}
        onOpenChange={(o) => !o && setRevealKey(null)}
        apiKey={revealKey ?? ''}
      />
    </>
  )
}
