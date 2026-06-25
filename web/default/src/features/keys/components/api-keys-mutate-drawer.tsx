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
import { useEffect, useState } from 'react'
import { useForm, type SubmitErrorHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getUserModels, getUserGroups } from '@/lib/api'
import { getCurrencyDisplay, getCurrencyLabel } from '@/lib/currency'
import { useCanUseGroups } from '@/hooks/use-enterprise'
import { useStatus } from '@/hooks/use-status'
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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { DateTimePicker } from '@/components/datetime-picker'
import { MultiSelect } from '@/components/multi-select'
import { createApiKey, updateApiKey, getApiKey } from '../api'
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants'
import {
  getApiKeyFormSchema,
  type ApiKeyFormValues,
  getApiKeyFormDefaultValues,
  transformFormDataToPayload,
  transformApiKeyToFormDefaults,
} from '../lib'
import { type ApiKey } from '../types'
import { ApiKeyRevealDialog } from './api-key-reveal-dialog'
import {
  ApiKeyGroupCombobox,
  type ApiKeyGroupOption,
} from './api-key-group-combobox'
import { useApiKeys } from './api-keys-provider'

type ApiKeyMutateDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: ApiKey
}

export function ApiKeysMutateDrawer({
  open,
  onOpenChange,
  currentRow,
}: ApiKeyMutateDrawerProps) {
  const { t } = useTranslation()
  const isUpdate = !!currentRow
  const { triggerRefresh } = useApiKeys()
  const { status } = useStatus()
  const canUseGroups = useCanUseGroups()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [revealKey, setRevealKey] = useState<string | null>(null)
  const defaultUseAutoGroup = status?.default_use_auto_group === true

  // Fetch models
  const { data: modelsData } = useQuery({
    queryKey: ['user-models'],
    queryFn: getUserModels,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })

  // Fetch groups only when the current user can choose token groups.
  const { data: groupsData } = useQuery({
    queryKey: ['user-groups'],
    queryFn: getUserGroups,
    staleTime: 5 * 60 * 1000,
    enabled: canUseGroups,
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
  const backendHasAuto = groups.some((g) => g.value === 'auto')
  const schema = getApiKeyFormSchema(t)

  const form = useForm<ApiKeyFormValues>({
    resolver: zodResolver(schema),
    defaultValues: getApiKeyFormDefaultValues(defaultUseAutoGroup),
  })

  // Load existing data when updating
  useEffect(() => {
    if (open && isUpdate && currentRow) {
      getApiKey(currentRow.id).then((result) => {
        if (result.success && result.data) {
          form.reset(transformApiKeyToFormDefaults(result.data))
        }
      })
    } else if (open && !isUpdate) {
      form.reset(
        getApiKeyFormDefaultValues(defaultUseAutoGroup && backendHasAuto)
      )
    }
  }, [open, isUpdate, currentRow, form, defaultUseAutoGroup, backendHasAuto])

  // Correct group after groups load: if the form value is not in available groups, fall back
  useEffect(() => {
    if (groups.length === 0) return
    const currentGroup = form.getValues('group')
    if (currentGroup && !groups.some((g) => g.value === currentGroup)) {
      const fallback =
        groups.find((g) => g.value === 'default')?.value ??
        groups[0]?.value ??
        ''
      form.setValue('group', fallback)
      if (currentGroup === 'auto') {
        form.setValue('cross_group_retry', false)
      }
    }
  }, [groups, form])

  const onSubmit = async (data: ApiKeyFormValues) => {
    setIsSubmitting(true)
    try {
      const basePayload = transformFormDataToPayload(data, canUseGroups)

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
    } catch (_error) {
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
      <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>
            {isUpdate ? t('Edit API key') : t('Create API Key')}
          </DialogTitle>
          <DialogDescription>
            {isUpdate
              ? t('Update the API key by providing necessary info.')
              : t('Add a new API key by providing necessary info.')}
          </DialogDescription>
        </DialogHeader>
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
            {!isUpdate && canUseGroups && (
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
                    onChange={(e) => handleCreditLimitChange(e.target.value)}
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
                {canUseGroups && (
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

                {canUseGroups && selectedGroup === 'auto' && (
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
                          placeholder={t('Select models (empty for allow all)')}
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
                      <FormLabel>{t('IP Whitelist (supports CIDR)')}</FormLabel>
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
          </form>
        </Form>
        <DialogFooter>
          <DialogClose
            render={<Button variant='outline' className='w-full sm:w-auto' />}
          >
            {t('Close')}
          </DialogClose>
          <Button
            type='button'
            onClick={form.handleSubmit(onSubmit, onInvalid)}
            disabled={isSubmitting}
            className='w-full sm:w-auto'
          >
            {isSubmitting ? t('Saving...') : t('Save changes')}
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
