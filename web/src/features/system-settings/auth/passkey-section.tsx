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
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import * as z from 'zod'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Dialog } from '@/components/dialog'
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
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { statusQueryOptions } from '@/lib/status-query'
import { cn } from '@/lib/utils'

import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

type AttachmentPreference = '' | 'platform' | 'cross-platform'
type AttachmentSelectValue = 'none' | 'platform' | 'cross-platform'

/**
 * Use a nested object so the dotted FormField `name` props line up with
 * react-hook-form's path semantics. Flat keys with dots cause the form state
 * to silently diverge from what zod validates on submit.
 */
const passkeySchema = z.object({
  passkey: z.object({
    enabled: z.boolean(),
    rp_display_name: z.string(),
    rp_id: z.string(),
    origins: z.string(),
    allow_insecure_origin: z.boolean(),
    user_verification: z.enum(['required', 'preferred', 'discouraged']),
    attachment_preference: z.enum(['none', 'platform', 'cross-platform']),
  }),
})

type PasskeyFormInput = z.input<typeof passkeySchema>
type PasskeyFormValues = z.output<typeof passkeySchema>

type FlatPasskeyDefaults = {
  'passkey.enabled': boolean
  'passkey.rp_display_name': string
  'passkey.rp_id': string
  'passkey.origins': string
  'passkey.allow_insecure_origin': boolean
  'passkey.user_verification': 'required' | 'preferred' | 'discouraged'
  'passkey.attachment_preference': AttachmentPreference
}

const toAttachmentSelectValue = (
  value: AttachmentPreference
): AttachmentSelectValue => (value === '' ? 'none' : value)

const fromAttachmentSelectValue = (
  value: AttachmentSelectValue
): AttachmentPreference => (value === 'none' ? '' : value)

const buildFormDefaults = (
  defaults: FlatPasskeyDefaults
): PasskeyFormInput => ({
  passkey: {
    enabled: defaults['passkey.enabled'],
    rp_display_name: defaults['passkey.rp_display_name'] ?? '',
    rp_id: defaults['passkey.rp_id'] ?? '',
    origins: (defaults['passkey.origins'] ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
      .join('\n'),
    allow_insecure_origin: defaults['passkey.allow_insecure_origin'],
    user_verification: defaults['passkey.user_verification'],
    attachment_preference: toAttachmentSelectValue(
      defaults['passkey.attachment_preference']
    ),
  },
})

const normalizeFormValues = (
  values: PasskeyFormValues
): FlatPasskeyDefaults => ({
  'passkey.enabled': values.passkey.enabled,
  'passkey.rp_display_name': values.passkey.rp_display_name,
  'passkey.rp_id': values.passkey.rp_id,
  'passkey.origins': values.passkey.origins
    .split('\n')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .join(','),
  'passkey.allow_insecure_origin': values.passkey.allow_insecure_origin,
  'passkey.user_verification': values.passkey.user_verification,
  'passkey.attachment_preference': fromAttachmentSelectValue(
    values.passkey.attachment_preference
  ),
})

interface PasskeySectionProps {
  defaultValues: FlatPasskeyDefaults
}

export function PasskeySection(props: PasskeySectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [domainHelpOpen, setDomainHelpOpen] = useState(false)
  const [pendingDomainChange, setPendingDomainChange] =
    useState<FlatPasskeyDefaults | null>(null)

  const formDefaults = useMemo(
    () => buildFormDefaults(props.defaultValues),
    [props.defaultValues]
  )

  const form = useForm<PasskeyFormInput, unknown, PasskeyFormValues>({
    resolver: zodResolver(passkeySchema),
    defaultValues: formDefaults,
  })

  const {
    data: status,
    isError: statusError,
    isFetching: statusLoading,
  } = useQuery({
    ...statusQueryOptions,
    refetchOnMount: 'always',
  })
  const rpId = useWatch({ control: form.control, name: 'passkey.rp_id' })
  const origins = useWatch({ control: form.control, name: 'passkey.origins' })
  const currentHostname = window.location.hostname
  const currentOrigin = window.location.origin
  const canUseCurrentSite =
    (window.location.protocol === 'https:' ||
      (window.location.protocol === 'http:' &&
        currentHostname === 'localhost')) &&
    currentHostname !== '' &&
    !currentHostname.includes(':') &&
    !/^\d+\.\d+\.\d+\.\d+$/.test(currentHostname)
  const serverRPID =
    typeof status?.passkey_rp_id === 'string' ? status.passkey_rp_id.trim() : ''
  const existingRPID = props.defaultValues['passkey.rp_id'].trim() || serverRPID
  const suggestedRPID = existingRPID || currentHostname
  const previewRPID = (rpId.trim() || serverRPID).toLowerCase()
  const domainMismatch =
    previewRPID !== '' &&
    currentHostname !== previewRPID &&
    !currentHostname.endsWith(`.${previewRPID}`)
  const hasDomainWarning = previewRPID === '' || domainMismatch
  const currentOriginMissing =
    origins.trim() !== '' &&
    !origins.split(/[,\n]/).some((origin) => origin.trim() === currentOrigin)

  const baselineRef = useRef<FlatPasskeyDefaults>(props.defaultValues)
  const baselineSerializedRef = useRef<string>(
    JSON.stringify(props.defaultValues)
  )

  useEffect(() => {
    const serialized = JSON.stringify(props.defaultValues)
    if (serialized === baselineSerializedRef.current) return
    baselineRef.current = props.defaultValues
    baselineSerializedRef.current = serialized
    form.reset(buildFormDefaults(props.defaultValues))
  }, [props.defaultValues, form])

  const saveSettings = async (normalized: FlatPasskeyDefaults) => {
    const changedKeys = (
      Object.keys(normalized) as Array<keyof FlatPasskeyDefaults>
    ).filter((key) => normalized[key] !== baselineRef.current[key])

    if (changedKeys.length === 0) {
      toast.info(t('No changes to save'))
      return
    }

    try {
      for (const key of changedKeys) {
        await updateOption.mutateAsync({
          key,
          value: normalized[key],
        })
      }
    } catch {
      // useUpdateOption reports the error. Keep the form and confirmation for retry.
      return
    }

    baselineRef.current = normalized
    baselineSerializedRef.current = JSON.stringify(normalized)
    form.reset(buildFormDefaults(normalized))
    setPendingDomainChange(null)
  }

  const onSubmit = async (values: PasskeyFormValues) => {
    const normalized = normalizeFormValues(values)
    const nextRPID = normalized['passkey.rp_id'].trim()
    const changesDomain =
      nextRPID !== baselineRef.current['passkey.rp_id'].trim() &&
      nextRPID !== existingRPID
    if (changesDomain) {
      setPendingDomainChange(normalized)
      return
    }
    await saveSettings(normalized)
  }

  return (
    <SettingsSection title={t('Passkey Authentication')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
          />
          <FormField
            control={form.control}
            name='passkey.enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable Passkey')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Allow users to register and sign in with Passkey (WebAuthn)'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />

          <FormField
            control={form.control}
            name='passkey.rp_display_name'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Passkey display name')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('e.g. New API Console')}
                    value={field.value ?? ''}
                    onChange={(event) => field.onChange(event.target.value)}
                    name={field.name}
                    onBlur={field.onBlur}
                    ref={field.ref}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Human-readable name shown to users during Passkey prompts.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='passkey.rp_id'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Passkey website domain')}</FormLabel>
                <FormControl>
                  <Input
                    className={cn(
                      hasDomainWarning &&
                        'border-amber-500 focus-visible:border-amber-500 focus-visible:ring-amber-500/20 dark:border-amber-400 dark:focus-visible:border-amber-400'
                    )}
                    placeholder={t('e.g. example.com')}
                    value={field.value ?? ''}
                    onChange={(event) => field.onChange(event.target.value)}
                    name={field.name}
                    onBlur={field.onBlur}
                    ref={field.ref}
                  />
                </FormControl>
                <div className='flex flex-wrap items-center gap-x-2 gap-y-1'>
                  <FormDescription
                    aria-live='polite'
                    className={cn(
                      hasDomainWarning && 'text-amber-700 dark:text-amber-400'
                    )}
                  >
                    {previewRPID === '' &&
                      t('Set the website where users will use their Passkeys.')}
                    {domainMismatch &&
                      t(
                        'This domain does not match the current website. Passkeys may not work here.'
                      )}
                    {!hasDomainWarning &&
                      rpId.trim() === '' &&
                      t('The system currently uses: {{domain}}', {
                        domain: serverRPID,
                      })}
                    {!hasDomainWarning &&
                      rpId.trim() !== '' &&
                      t('Enter the website domain, such as example.com.')}
                  </FormDescription>
                  <Dialog
                    open={domainHelpOpen}
                    onOpenChange={setDomainHelpOpen}
                    title={t('Why set a website domain?')}
                    description={t(
                      'Passkeys only work on the website they were created for. This helps prevent other websites from misusing them.'
                    )}
                    contentClassName='sm:max-w-lg'
                    bodyClassName='space-y-3 text-sm break-words'
                    trigger={
                      <Button
                        type='button'
                        variant='link'
                        size='sm'
                        className='h-auto p-0'
                      >
                        {t('Why set this?')}
                      </Button>
                    }
                    footer={
                      <>
                        <Button
                          type='button'
                          variant='outline'
                          onClick={() => setDomainHelpOpen(false)}
                        >
                          {t('Close')}
                        </Button>
                        <Button
                          type='button'
                          disabled={
                            !canUseCurrentSite ||
                            statusLoading ||
                            updateOption.isPending
                          }
                          onClick={() => {
                            form.setValue('passkey.rp_id', suggestedRPID, {
                              shouldDirty: true,
                            })
                            if (!form.getValues('passkey.origins').trim()) {
                              form.setValue('passkey.origins', currentOrigin, {
                                shouldDirty: true,
                              })
                            }
                            setDomainHelpOpen(false)
                          }}
                        >
                          {existingRPID
                            ? t('Keep existing domain')
                            : t('Fill in this website')}
                        </Button>
                      </>
                    }
                  >
                    <p>
                      {t(
                        'An empty field uses the system website address. If Passkeys already work, keep the existing domain.'
                      )}
                    </p>
                    <div className='bg-muted space-y-2 rounded-lg p-3 break-all'>
                      <p>
                        {t('Current site: {{origin}}', {
                          origin: currentOrigin,
                        })}
                      </p>
                      {!existingRPID && (
                        <p className='font-medium'>
                          {t('For this website, you can enter: {{domain}}', {
                            domain: currentHostname,
                          })}
                        </p>
                      )}
                      {serverRPID && !statusError && (
                        <p className='text-muted-foreground'>
                          {t('The system currently uses: {{domain}}', {
                            domain: serverRPID,
                          })}
                        </p>
                      )}
                    </div>
                    {statusError && (
                      <p>
                        {t(
                          'The current setting could not be loaded. You can still enter the website domain yourself.'
                        )}
                      </p>
                    )}
                    <p>
                      {t(
                        'Enter only the domain, without https://, a port or a page path. example.com and www.example.com are different Passkey domains; changing between them does not migrate existing Passkeys.'
                      )}
                    </p>
                    <p>
                      {t(
                        'If users already have Passkeys, changing this domain may require them to sign in another way and set up their Passkeys again.'
                      )}
                    </p>
                    {!canUseCurrentSite && (
                      <p>
                        {t(
                          'Use an HTTPS domain (or localhost for development) to configure Passkey.'
                        )}
                      </p>
                    )}
                    <p className='text-muted-foreground'>
                      {t(
                        'The button fills in this website and keeps any existing website addresses. Save changes on the settings page to apply.'
                      )}
                    </p>
                  </Dialog>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='passkey.user_verification'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('User Verification')}</FormLabel>
                <FormControl>
                  <Select
                    items={[
                      { value: 'required', label: t('Required') },
                      { value: 'preferred', label: t('Recommended') },
                      { value: 'discouraged', label: t('Discouraged') },
                    ]}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('Select requirement')} />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        <SelectItem value='required'>
                          {t('Required')}
                        </SelectItem>
                        <SelectItem value='preferred'>
                          {t('Recommended')}
                        </SelectItem>
                        <SelectItem value='discouraged'>
                          {t('Discouraged')}
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormDescription>
                  {t(
                    'Controls whether user verification (biometrics/PIN) is required during Passkey flows.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='passkey.attachment_preference'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Device Type Preference')}</FormLabel>
                <FormControl>
                  <Select
                    items={[
                      { value: 'none', label: t('Unlimited') },
                      { value: 'platform', label: t('Built-in Device') },
                      { value: 'cross-platform', label: t('External Device') },
                    ]}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('No preference')} />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        <SelectItem value='none'>{t('Unlimited')}</SelectItem>
                        <SelectItem value='platform'>
                          {t('Built-in Device')}
                        </SelectItem>
                        <SelectItem value='cross-platform'>
                          {t('External Device')}
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormDescription>
                  {t(
                    'Built-in: phone fingerprint/face, or Windows Hello; External: USB security key'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='passkey.allow_insecure_origin'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Allow Insecure Origins')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Permit Passkey registration on non-HTTPS origins (only recommended for development)'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />

          <FormField
            control={form.control}
            name='passkey.origins'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Allowed Passkey websites')}</FormLabel>
                <FormControl>
                  <Textarea
                    rows={4}
                    placeholder={currentOrigin}
                    value={field.value ?? ''}
                    onChange={(event) => field.onChange(event.target.value)}
                    name={field.name}
                    onBlur={field.onBlur}
                    ref={field.ref}
                  />
                </FormControl>
                <FormDescription
                  aria-live='polite'
                  className={cn(
                    currentOriginMissing && 'text-amber-700 dark:text-amber-400'
                  )}
                >
                  {currentOriginMissing
                    ? t(
                        'This list does not include the current website. Add {{origin}} if users sign in here.',
                        { origin: currentOrigin }
                      )
                    : t(
                        'Enter one website address per line, such as https://example.com. Do not include a page path.'
                      )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsForm>
      </Form>
      <ConfirmDialog
        open={pendingDomainChange !== null}
        onOpenChange={(open) => {
          if (!open && !updateOption.isPending) setPendingDomainChange(null)
        }}
        title={t('Change the Passkey domain?')}
        desc={t(
          'Existing Passkeys remain tied to the old domain and may stop working. Keep the old domain to preserve access, or confirm only if you have a recovery plan.'
        )}
        confirmText={t('Change domain')}
        destructive
        isLoading={updateOption.isPending}
        handleConfirm={() => {
          if (pendingDomainChange) void saveSettings(pendingDomainChange)
        }}
      >
        <div className='space-y-2 text-sm break-all'>
          <p>
            {t('Current domain: {{domain}}', {
              domain: existingRPID || t('Unknown'),
            })}
          </p>
          <p>
            {t('New domain: {{domain}}', {
              domain:
                pendingDomainChange?.['passkey.rp_id'].trim() ||
                t('Automatic from system website address'),
            })}
          </p>
        </div>
      </ConfirmDialog>
    </SettingsSection>
  )
}
