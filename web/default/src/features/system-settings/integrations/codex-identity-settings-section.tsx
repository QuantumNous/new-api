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
/* eslint-disable react-refresh/only-export-components */
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useResetForm } from '../hooks/use-reset-form'
import { useUpdateOptionsBulk } from '../hooks/use-update-option'

export type CodexIdentityFormValues = {
  CodexClientUserAgent: string
  CodexClientVersion: string
  CodexSyncedClientVersion: string
  CodexSyncedClientVersionAt: string
  CodexAutoSyncClientVersion: boolean
  CodexEnforceClientIdentity: boolean
}

type CodexIdentityUpdate = {
  key:
    | 'CodexClientUserAgent'
    | 'CodexClientVersion'
    | 'CodexAutoSyncClientVersion'
    | 'CodexEnforceClientIdentity'
  value: string
}

export function buildCodexIdentityOptionUpdates(
  defaults: CodexIdentityFormValues,
  values: CodexIdentityFormValues
): CodexIdentityUpdate[] {
  const updates: CodexIdentityUpdate[] = []
  const nextUserAgent = values.CodexClientUserAgent.trim()
  const nextVersion = values.CodexClientVersion.trim()

  if (nextUserAgent !== defaults.CodexClientUserAgent.trim()) {
    updates.push({
      key: 'CodexClientUserAgent',
      value: nextUserAgent,
    })
  }
  if (nextVersion !== defaults.CodexClientVersion.trim()) {
    updates.push({
      key: 'CodexClientVersion',
      value: nextVersion,
    })
  }
  if (
    values.CodexAutoSyncClientVersion !== defaults.CodexAutoSyncClientVersion
  ) {
    updates.push({
      key: 'CodexAutoSyncClientVersion',
      value: String(values.CodexAutoSyncClientVersion),
    })
  }
  if (
    values.CodexEnforceClientIdentity !== defaults.CodexEnforceClientIdentity
  ) {
    updates.push({
      key: 'CodexEnforceClientIdentity',
      value: String(values.CodexEnforceClientIdentity),
    })
  }
  return updates
}

export function formatSyncTime(value: string): string {
  const raw = value.trim()
  if (raw === '') return ''

  const seconds = Number(raw)
  if (Number.isFinite(seconds) && seconds > 0) {
    return new Date(seconds * 1000).toLocaleString()
  }

  const parsed = Date.parse(raw)
  if (!Number.isFinite(parsed)) return ''
  return new Date(parsed).toLocaleString()
}

export function CodexIdentitySettingsSection({
  defaultValues,
}: {
  defaultValues: CodexIdentityFormValues
}) {
  const { t } = useTranslation()
  const updateOptions = useUpdateOptionsBulk()
  const form = useForm<CodexIdentityFormValues>({ defaultValues })

  useResetForm(form, defaultValues)

  async function onSubmit(values: CodexIdentityFormValues) {
    const updates = buildCodexIdentityOptionUpdates(defaultValues, values)
    if (updates.length === 0) {
      toast.info(t('No changes to save'))
      return
    }
    await updateOptions.mutateAsync({ options: updates })
  }

  return (
    <SettingsSection title={t('Codex Identity')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOptions.isPending || form.formState.isSubmitting}
            saveLabel='Save Codex identity settings'
          />

          <FormField
            control={form.control}
            name='CodexClientUserAgent'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Codex User-Agent override')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder='codex-cli/0.144.0'
                    autoComplete='off'
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Optional canonical Codex CLI User-Agent suffix. The version is rebuilt from the effective client version.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='CodexClientVersion'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Manual Codex client version')}</FormLabel>
                <FormControl>
                  <Input placeholder='0.144.0' autoComplete='off' {...field} />
                </FormControl>
                <FormDescription>
                  {t(
                    'Manual version wins over synced releases. Versions below 0.144.0 or invalid values fall back to the built-in safe version.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='CodexSyncedClientVersion'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Synced Codex client version')}</FormLabel>
                <FormControl>
                  <Input readOnly {...field} />
                </FormControl>
                <FormDescription>
                  {t(
                    'Read-only latest stable official release captured by the automatic sync.'
                  )}
                </FormDescription>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='CodexSyncedClientVersionAt'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Last Codex version sync')}</FormLabel>
                <FormControl>
                  <Input
                    readOnly
                    value={formatSyncTime(field.value) || field.value}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormDescription>
                  {t('Automatic release checks run every six hours.')}
                </FormDescription>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='CodexAutoSyncClientVersion'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Auto-sync Codex client version')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Keep the synced version current from official stable releases.'
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
            name='CodexEnforceClientIdentity'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enforce Codex client identity')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Emergency kill switch. Disable only to roll back canonical outbound identity enforcement.'
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

          <Alert>
            <AlertTitle>{t('Deployment namespace required')}</AlertTitle>
            <AlertDescription>
              {t(
                'Set CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE consistently on console and router replicas before using full convergence in production.'
              )}
            </AlertDescription>
          </Alert>
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
