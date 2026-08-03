import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronDown,
  KeyRound,
  PackageCheck,
  Settings2,
  WalletCards,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { getUserModels, getUserGroups } from '@/lib/api'
import { getCurrencyDisplay, getCurrencyLabel } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { useStatus } from '@/hooks/use-status'
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
import { DateTimePicker } from '@/components/datetime-picker'
import { MultiSelect } from '@/components/multi-select'
import {
  createApiKey,
  getApiKey,
  getSelfEntitlementPackages,
  getTokenEntitlementAssignments,
  updateApiKey,
} from '../api'
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants'
import {
  apiKeyFormSchema,
  type ApiKeyFormValues,
  getApiKeyFormDefaultValues,
  transformFormDataToPayload,
  transformApiKeyToFormDefaults,
} from '../lib'
import { getActiveEntitlementPackageIds } from '../lib/api-key-form'
import { type ApiKey } from '../types'
import {
  ApiKeyGroupCombobox,
  type ApiKeyGroupOption,
} from './api-key-group-combobox'
import { useApiKeys } from './api-keys-provider'

type ApiKeyMutateDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: ApiKey
  side?: 'left' | 'right'
}

type ApiKeyFormSectionProps = {
  title: string
  description: string
  icon: LucideIcon
  children: ReactNode
}

type LoadState = 'idle' | 'loading' | 'ready' | 'unavailable'

function ApiKeyFormSection(props: ApiKeyFormSectionProps) {
  const Icon = props.icon

  return (
    <section className='bg-card rounded-lg border'>
      <div className='flex items-center gap-2.5 border-b px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3'>
        <div className='bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg border sm:size-10'>
          <Icon className='size-4 sm:size-5' />
        </div>
        <div className='min-w-0'>
          <h3 className='text-sm leading-none font-medium'>{props.title}</h3>
          <p className='text-muted-foreground mt-0.5 text-xs sm:mt-1'>
            {props.description}
          </p>
        </div>
      </div>
      <div className='space-y-3 p-3 sm:space-y-4 sm:p-4'>{props.children}</div>
    </section>
  )
}

export function ApiKeysMutateDrawer({
  open,
  onOpenChange,
  currentRow,
  side = 'right',
}: ApiKeyMutateDrawerProps) {
  const { t } = useTranslation()
  const isUpdate = !!currentRow
  const { triggerRefresh } = useApiKeys()
  const { status } = useStatus()
  const currentUserId = useAuthStore((state) => state.auth.user?.id)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [updateKeyState, setUpdateKeyState] = useState<LoadState>('idle')
  const [entitlementAssignmentsState, setEntitlementAssignmentsState] =
    useState<LoadState>('idle')
  const defaultUseAutoGroup = status?.default_use_auto_group === true

  // Fetch models
  const { data: modelsData } = useQuery({
    queryKey: ['user-models'],
    queryFn: getUserModels,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })

  // Fetch groups
  const { data: groupsData } = useQuery({
    queryKey: ['user-groups'],
    queryFn: getUserGroups,
    staleTime: 5 * 60 * 1000,
  })

  const {
    data: entitlementPackagesData,
    isError: entitlementPackagesIsError,
    isLoading: entitlementPackagesLoading,
  } = useQuery({
    queryKey: ['self-entitlement-packages', currentUserId],
    queryFn: getSelfEntitlementPackages,
    staleTime: 5 * 60 * 1000,
    enabled: open,
  })

  const models = modelsData?.data || []
  const groupsRaw = groupsData?.data || {}
  const groups: ApiKeyGroupOption[] = Object.entries(groupsRaw).map(
    ([key, info]) => ({
      value: key,
      label: key,
      desc: info.desc || key,
      ratio: info.ratio,
    })
  )

  // Add auto group if configured
  if (!groups.some((g) => g.value === 'auto')) {
    groups.unshift({
      value: 'auto',
      label: 'auto',
      desc: t('Auto (Circuit Breaker)'),
    })
  }

  const form = useForm<ApiKeyFormValues>({
    resolver: zodResolver(apiKeyFormSchema),
    defaultValues: getApiKeyFormDefaultValues(defaultUseAutoGroup),
  })

  const selectedEntitlementPackageIds = form.watch('entitlement_package_ids')
  const entitlementPackagesReady =
    entitlementPackagesData?.success === true &&
    Array.isArray(entitlementPackagesData.data)
  const entitlementPackagesUnavailable =
    entitlementPackagesIsError ||
    (entitlementPackagesData !== undefined && !entitlementPackagesReady)
  const entitlementAssignmentsReady =
    !isUpdate || entitlementAssignmentsState === 'ready'
  const canEditEntitlementAssignments =
    entitlementPackagesReady && entitlementAssignmentsReady

  const entitlementPackageOptions = useMemo(() => {
    if (!entitlementPackagesReady) return []

    const options = (entitlementPackagesData.data || []).map((item) => {
      const name = item.name?.trim() || t('Package #{{id}}', { id: item.id })
      const description = item.description?.trim()
      return {
        value: String(item.id),
        label: description ? `${name} — ${description}` : name,
      }
    })
    const knownPackageIds = new Set(options.map((option) => option.value))

    for (const packageId of selectedEntitlementPackageIds) {
      if (!knownPackageIds.has(packageId)) {
        options.push({
          value: packageId,
          label: t('Package #{{id}} (currently assigned)', { id: packageId }),
        })
      }
    }

    return options
  }, [
    entitlementPackagesData?.data,
    entitlementPackagesReady,
    selectedEntitlementPackageIds,
    t,
  ])

  // Load existing data when updating
  useEffect(() => {
    let cancelled = false

    if (open && isUpdate && currentRow) {
      setUpdateKeyState('loading')
      setEntitlementAssignmentsState('loading')

      const loadExistingKey = async () => {
        const [apiKeyResult, assignmentResult] = await Promise.allSettled([
          getApiKey(currentRow.id),
          getTokenEntitlementAssignments(currentRow.id),
        ])
        if (cancelled) return

        if (
          apiKeyResult.status !== 'fulfilled' ||
          !apiKeyResult.value.success ||
          !apiKeyResult.value.data
        ) {
          setUpdateKeyState('unavailable')
          setEntitlementAssignmentsState('unavailable')
          const message =
            apiKeyResult.status === 'fulfilled'
              ? apiKeyResult.value.message
              : undefined
          toast.error(message || t(ERROR_MESSAGES.UPDATE_FAILED))
          return
        }

        let entitlementPackageIds: number[] = []
        const assignmentSnapshotReady =
          assignmentResult.status === 'fulfilled' &&
          assignmentResult.value.success &&
          Array.isArray(assignmentResult.value.data)

        if (assignmentSnapshotReady && assignmentResult.value.data) {
          entitlementPackageIds = getActiveEntitlementPackageIds(
            assignmentResult.value.data
          )
        }

        form.reset(
          transformApiKeyToFormDefaults(
            apiKeyResult.value.data,
            entitlementPackageIds
          )
        )
        setUpdateKeyState('ready')
        setEntitlementAssignmentsState(
          assignmentSnapshotReady ? 'ready' : 'unavailable'
        )
      }

      void loadExistingKey()
    } else if (open && !isUpdate) {
      // For create, reset to defaults
      form.reset(getApiKeyFormDefaultValues(defaultUseAutoGroup))
      setUpdateKeyState('ready')
      setEntitlementAssignmentsState('ready')
    } else if (!open) {
      setUpdateKeyState('idle')
      setEntitlementAssignmentsState('idle')
    }

    return () => {
      cancelled = true
    }
  }, [open, isUpdate, currentRow, form, defaultUseAutoGroup, t])

  const onSubmit = async (data: ApiKeyFormValues) => {
    setIsSubmitting(true)
    try {
      const entitlementSelectionChanged = form.getFieldState(
        'entitlement_package_ids'
      ).isDirty
      const basePayload = transformFormDataToPayload(data, {
        includeEntitlementPackageIds:
          canEditEntitlementAssignments &&
          (!isUpdate || entitlementSelectionChanged),
      })

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
          } else {
            toast.error(result.message || t(ERROR_MESSAGES.CREATE_FAILED))
            break
          }
        }

        if (successCount > 0) {
          toast.success(
            t('Successfully created {{count}} API Key(s)', {
              count: successCount,
            })
          )
          onOpenChange(false)
          triggerRefresh()
        }
      }
    } catch (_error) {
      toast.error(t(ERROR_MESSAGES.UNEXPECTED))
    } finally {
      setIsSubmitting(false)
    }
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
  const unlimitedQuota = form.watch('unlimited_quota')
  const entitlementControlLoading =
    entitlementPackagesLoading ||
    (isUpdate && entitlementAssignmentsState === 'loading')
  const updateFormUnavailable = isUpdate && updateKeyState !== 'ready'
  const saveDisabled =
    isSubmitting || entitlementControlLoading || updateFormUnavailable

  const entitlementPlaceholder = t('Select entitlement packages')

  let entitlementContent: ReactNode
  if (entitlementControlLoading) {
    entitlementContent = (
      <p className='text-muted-foreground text-sm'>
        {t('Loading entitlement packages...')}
      </p>
    )
  } else if (entitlementPackagesUnavailable) {
    let message = t(
      'Entitlement packages could not be loaded. This API key can still be created without entitlement assignments.'
    )
    if (isUpdate) {
      message = t(
        'Entitlement packages could not be loaded. Existing assignments will not be changed.'
      )
    }
    entitlementContent = <p className='text-destructive text-sm'>{message}</p>
  } else if (isUpdate && entitlementAssignmentsState === 'unavailable') {
    entitlementContent = (
      <p className='text-destructive text-sm'>
        {t(
          'Entitlement assignments could not be loaded. Existing assignments will not be changed.'
        )}
      </p>
    )
  } else if (entitlementPackageOptions.length === 0) {
    entitlementContent = (
      <p className='text-muted-foreground text-sm'>
        {t('Your account has no active entitlement packages.')}
      </p>
    )
  } else {
    entitlementContent = (
      <FormField
        control={form.control}
        name='entitlement_package_ids'
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('Entitlement Packages')}</FormLabel>
            <FormControl>
              <MultiSelect
                options={entitlementPackageOptions}
                selected={field.value}
                onChange={field.onChange}
                placeholder={entitlementPlaceholder}
              />
            </FormControl>
            <FormDescription>
              {t('Only packages granted to your account can be selected.')}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    )
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) {
          form.reset()
        }
      }}
    >
      <SheetContent
        side={side}
        className='bg-background flex !h-dvh !w-screen max-w-none gap-0 overflow-hidden p-0 sm:!w-full sm:!max-w-[620px]'
      >
        <SheetHeader className='bg-background border-b px-4 py-3 text-start sm:px-5 sm:py-4'>
          <SheetTitle className='text-base sm:text-lg'>
            {isUpdate ? t('Update API Key') : t('Create API Key')}
          </SheetTitle>
          <SheetDescription className='pr-6 text-xs sm:text-sm'>
            {isUpdate
              ? t('Update the API key by providing necessary info.')
              : t('Add a new API key by providing necessary info.')}{' '}
            {t("Click save when you're done.")}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            id='api-key-form'
            onSubmit={form.handleSubmit(onSubmit)}
            className='min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3 sm:space-y-4 sm:px-4 sm:py-4'
          >
            <ApiKeyFormSection
              title={t('Basic Information')}
              description={t('Set API key basic information')}
              icon={KeyRound}
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
                    <FormItem className='flex min-h-16 flex-row items-center justify-between gap-3 rounded-lg border px-3 py-2.5 sm:min-h-20 sm:gap-4 sm:px-4 sm:py-3'>
                      <div className='space-y-0.5'>
                        <FormLabel className='text-sm'>
                          {t('Cross-group retry')}
                        </FormLabel>
                        <FormDescription className='line-clamp-2 text-xs sm:line-clamp-none'>
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
                name='expired_time'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Expiration Time')}</FormLabel>
                    <div className='grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center'>
                      <FormControl>
                        <DateTimePicker
                          value={field.value}
                          onChange={field.onChange}
                          placeholder={t('Never expires')}
                          className='min-w-0 [&_input[type=time]]:w-24 sm:[&_input[type=time]]:w-32'
                        />
                      </FormControl>
                      <div className='grid grid-cols-4 gap-2 sm:flex'>
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

              {!isUpdate && (
                <FormField
                  control={form.control}
                  name='tokenCount'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Quantity')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type='number'
                          min='1'
                          placeholder={t('Number of keys to create')}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value, 10) || 1)
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          'Create multiple API keys at once (random suffix will be added to names)'
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </ApiKeyFormSection>

            <ApiKeyFormSection
              title={t('Directed Entitlements')}
              description={t(
                'Bind this API key to one or more entitlement packages'
              )}
              icon={PackageCheck}
            >
              {entitlementContent}
            </ApiKeyFormSection>

            <ApiKeyFormSection
              title={t('Quota Settings')}
              description={t('Set quota amount and limits')}
              icon={WalletCards}
            >
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
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        {tokensOnly
                          ? t('Enter the quota amount in tokens')
                          : t('Enter the quota amount in {{currency}}', {
                              currency: currencyLabel,
                            })}
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
                  <FormItem className='flex min-h-16 flex-row items-center justify-between gap-3 rounded-lg border px-3 py-2.5 sm:min-h-20 sm:gap-4 sm:px-4 sm:py-3'>
                    <div className='space-y-0.5'>
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
            </ApiKeyFormSection>

            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <section className='bg-card rounded-lg border'>
                <CollapsibleTrigger
                  render={
                    <button
                      type='button'
                      className='hover:bg-muted/50 flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors sm:gap-3 sm:px-4 sm:py-3'
                    />
                  }
                >
                  <div className='bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg border sm:size-10'>
                    <Settings2 className='size-4 sm:size-5' />
                  </div>
                  <div className='min-w-0 flex-1'>
                    <h3 className='text-sm leading-none font-medium'>
                      {t('Advanced Settings')}
                    </h3>
                    <p className='text-muted-foreground mt-1 text-xs'>
                      {t('Set API key access restrictions')}
                    </p>
                  </div>
                  <ChevronDown
                    className={cn(
                      'text-muted-foreground size-4 shrink-0 transition-transform',
                      advancedOpen && 'rotate-180'
                    )}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className='space-y-3 border-t p-3 sm:space-y-4 sm:p-4'>
                    <FormField
                      control={form.control}
                      name='model_limits'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('Model Limits')}</FormLabel>
                          <FormControl>
                            <MultiSelect
                              options={models.map((m) => ({
                                label: m,
                                value: m,
                              }))}
                              selected={field.value}
                              onChange={field.onChange}
                              placeholder={t(
                                'Select models (empty for allow all)'
                              )}
                            />
                          </FormControl>
                          <FormDescription>
                            {t('Limit which models can be used with this key')}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

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
                  </div>
                </CollapsibleContent>
              </section>
            </Collapsible>
          </form>
        </Form>
        <SheetFooter className='bg-background grid grid-cols-2 gap-2 border-t px-3 py-3 sm:flex sm:flex-row sm:justify-end sm:px-5 sm:py-4'>
          <SheetClose
            render={<Button variant='outline' className='w-full sm:w-auto' />}
          >
            {t('Close')}
          </SheetClose>
          <Button
            form='api-key-form'
            type='submit'
            disabled={saveDisabled}
            className='w-full sm:w-auto'
          >
            {isSubmitting ? t('Saving...') : t('Save changes')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
