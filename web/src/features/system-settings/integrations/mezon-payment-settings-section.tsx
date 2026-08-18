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
import { AlertTriangle } from 'lucide-react'
import { useMemo } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useCustomOAuthProviders } from '@/features/system-settings/auth/custom-oauth/hooks/use-custom-oauth-providers'

import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const DEFAULT_INDEXER_BASE = 'https://dong.mezon.ai/indexer-api'
const DEFAULT_CHAIN_ID = '1337'

const createSchema = (t: (key: string) => string) =>
  z
    .object({
      MezonPaymentEnabled: z.boolean(),
      MezonProviderId: z.number().int(),
      MezonTreasuryAddress: z.string(),
      MezonIndexerBase: z.string(),
      MezonChainId: z.string(),
    })
    .superRefine((values, ctx) => {
      if (values.MezonPaymentEnabled && values.MezonProviderId <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['MezonProviderId'],
          message: t(
            'Mezon OAuth provider is required when Mezon top-up is enabled'
          ),
        })
      }

      if (values.MezonPaymentEnabled && !values.MezonTreasuryAddress.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['MezonTreasuryAddress'],
          message: t(
            'Treasury wallet address is required when Mezon top-up is enabled'
          ),
        })
      }

      const indexer = values.MezonIndexerBase.trim()
      if (indexer) {
        try {
          const url = new URL(indexer)
          if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            throw new Error('invalid protocol')
          }
        } catch {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['MezonIndexerBase'],
            message: t('Indexer base must be a valid http(s) URL'),
          })
        }
      }

      if (values.MezonPaymentEnabled && !values.MezonChainId.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['MezonChainId'],
          message: t('Chain ID is required when Mezon top-up is enabled'),
        })
      }
    })

type Values = z.infer<ReturnType<typeof createSchema>>

export type MezonPaymentSettingsValues = {
  MezonPaymentEnabled: boolean
  MezonProviderId: number
  MezonTreasuryAddress: string
  MezonIndexerBase: string
  MezonChainId: string
  customCurrencyExchangeRate?: number
}

export function MezonPaymentSettingsSection({
  defaultValues,
}: {
  defaultValues: MezonPaymentSettingsValues
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const schema = useMemo(() => createSchema(t), [t])
  const providersQuery = useCustomOAuthProviders()
  const providers = providersQuery.data ?? []

  const form = useForm<Values>({
    resolver: zodResolver(schema) as unknown as Resolver<Values>,
    defaultValues: {
      MezonPaymentEnabled: defaultValues.MezonPaymentEnabled,
      MezonProviderId: defaultValues.MezonProviderId ?? 0,
      MezonTreasuryAddress: defaultValues.MezonTreasuryAddress,
      MezonIndexerBase: defaultValues.MezonIndexerBase || DEFAULT_INDEXER_BASE,
      MezonChainId: defaultValues.MezonChainId || DEFAULT_CHAIN_ID,
    },
  })

  const { isDirty, isSubmitting } = form.formState
  const enabled = form.watch('MezonPaymentEnabled')

  async function onSubmit(values: Values) {
    const nextValues: Values = {
      MezonPaymentEnabled: values.MezonPaymentEnabled,
      MezonProviderId: values.MezonProviderId,
      MezonTreasuryAddress: values.MezonTreasuryAddress.trim(),
      MezonIndexerBase: values.MezonIndexerBase.trim() || DEFAULT_INDEXER_BASE,
      MezonChainId: values.MezonChainId.trim() || DEFAULT_CHAIN_ID,
    }

    const updates: Array<{ key: string; value: string }> = []

    if (nextValues.MezonProviderId !== (defaultValues.MezonProviderId ?? 0)) {
      updates.push({
        key: 'MezonProviderId',
        value: String(nextValues.MezonProviderId),
      })
    }
    if (
      nextValues.MezonTreasuryAddress !== defaultValues.MezonTreasuryAddress
    ) {
      updates.push({
        key: 'MezonTreasuryAddress',
        value: nextValues.MezonTreasuryAddress,
      })
    }
    if (
      nextValues.MezonIndexerBase !==
      (defaultValues.MezonIndexerBase || DEFAULT_INDEXER_BASE)
    ) {
      updates.push({
        key: 'MezonIndexerBase',
        value: nextValues.MezonIndexerBase,
      })
    }
    if (
      nextValues.MezonChainId !==
      (defaultValues.MezonChainId || DEFAULT_CHAIN_ID)
    ) {
      updates.push({
        key: 'MezonChainId',
        value: nextValues.MezonChainId,
      })
    }
    if (nextValues.MezonPaymentEnabled !== defaultValues.MezonPaymentEnabled) {
      updates.push({
        key: 'MezonPaymentEnabled',
        value: String(nextValues.MezonPaymentEnabled),
      })
    }

    if (updates.length === 0) {
      toast.info(t('No changes to save'))
      return
    }

    for (const update of updates) {
      await updateOption.mutateAsync(update)
    }

    form.reset(nextValues)
  }

  return (
    <SettingsSection title={t('Mezon đồng top-up')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending || isSubmitting}
            isSaveDisabled={!isDirty}
            saveLabel='Save Mezon payment settings'
          />

          <Alert>
            <AlertTriangle className='h-4 w-4' />
            <AlertTitle>{t('Conversion rule')}</AlertTitle>
            <AlertDescription className='space-y-1'>
              <p>
                {t(
                  '1 Mezon đồng is credited as 1 mzđ at a fixed 1:1 rate. Transfer 100000 dong → receive 100000 mzđ.'
                )}
              </p>
            </AlertDescription>
          </Alert>

          <FormField
            control={form.control}
            name='MezonPaymentEnabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable Mezon đồng top-up')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Users transfer đồng to the treasury wallet in the Mezon app, then paste the transaction hash on the Wallet page. Requires Mezon OAuth login.'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={updateOption.isPending || isSubmitting}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />

          <FormField
            control={form.control}
            name='MezonProviderId'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Mezon OAuth provider')}</FormLabel>
                <Select
                  items={providers.map((provider) => ({
                    value: String(provider.id),
                    label: provider.enabled
                      ? `${provider.name} (${provider.slug})`
                      : `${provider.name} (${provider.slug}) — ${t('disabled')}`,
                  }))}
                  onValueChange={(value) => field.onChange(Number(value) || 0)}
                  value={field.value > 0 ? String(field.value) : ''}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t('Select the Mezon OAuth provider')}
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      {providers.map((provider) => (
                        <SelectItem
                          key={provider.id}
                          value={String(provider.id)}
                        >
                          {provider.enabled
                            ? `${provider.name} (${provider.slug})`
                            : `${provider.name} (${provider.slug}) — ${t('disabled')}`}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FormDescription>
                  {t(
                    'Only bindings from this provider can claim Mezon top-ups. Adding another OAuth provider must not be able to steal a transfer.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='MezonTreasuryAddress'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Treasury wallet address')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder='9boK1HQDiKJ922j3HetRkFszX873q6B1xSZDqmDSoQro'
                    spellCheck={false}
                    autoComplete='off'
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'MMN wallet that receives top-up transfers. Shown to users on the Wallet page.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {enabled && (
            <div className='grid gap-6 sm:grid-cols-2'>
              <FormField
                control={form.control}
                name='MezonIndexerBase'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Indexer base URL')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={DEFAULT_INDEXER_BASE}
                        spellCheck={false}
                        autoComplete='off'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Public mmn-tx-explorer indexer API base. Default is Mezon production.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='MezonChainId'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Chain ID')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={DEFAULT_CHAIN_ID}
                        spellCheck={false}
                        autoComplete='off'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'MMN chain id used in indexer paths. Production is 1337.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
