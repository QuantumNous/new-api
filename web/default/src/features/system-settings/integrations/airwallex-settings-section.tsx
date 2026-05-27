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
import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { useUpdateOption } from '../hooks/use-update-option'
import {
  formatAllowedPaymentMethods,
  parseAirwallexAccountsForForm,
  parseAllowedPaymentMethods,
  serializeAirwallexAccounts,
  serializeAllowedPaymentMethods,
  type AirwallexAccountForm,
  type AirwallexSettingsValues,
} from './airwallex-settings'

type AirwallexSettingsSectionProps = {
  defaultValues: AirwallexSettingsValues
}

function createBlankAccount(index: number): AirwallexAccountForm {
  return {
    biz: index === 0 ? 'b2c' : `biz${index + 1}`,
    enabled: false,
    base_url: 'https://api.airwallex.com',
    client_id: '',
    api_key: '',
    login_as: '',
    webhook_secret: '',
    apiKeyConfigured: false,
    webhookSecretConfigured: false,
  }
}

export function AirwallexSettingsSection({
  defaultValues,
}: AirwallexSettingsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [enabled, setEnabled] = useState(defaultValues.enabled)
  const [opsEnabled, setOpsEnabled] = useState(defaultValues.opsEnabled)
  const [paymentMethodsCacheTTLSeconds, setPaymentMethodsCacheTTLSeconds] =
    useState(defaultValues.paymentMethodsCacheTTLSeconds)
  const [httpTimeoutSeconds, setHttpTimeoutSeconds] = useState(
    defaultValues.httpTimeoutSeconds
  )
  const [allowedPaymentMethods, setAllowedPaymentMethods] = useState(
    formatAllowedPaymentMethods(
      parseAllowedPaymentMethods(defaultValues.allowedPaymentMethods)
    )
  )
  const [accounts, setAccounts] = useState<AirwallexAccountForm[]>(() =>
    parseAirwallexAccountsForForm(defaultValues.accounts)
  )

  const defaultsSignature = useMemo(
    () => JSON.stringify(defaultValues),
    [defaultValues]
  )

  useEffect(() => {
    setEnabled(defaultValues.enabled)
    setOpsEnabled(defaultValues.opsEnabled)
    setPaymentMethodsCacheTTLSeconds(
      defaultValues.paymentMethodsCacheTTLSeconds
    )
    setHttpTimeoutSeconds(defaultValues.httpTimeoutSeconds)
    setAllowedPaymentMethods(
      formatAllowedPaymentMethods(
        parseAllowedPaymentMethods(defaultValues.allowedPaymentMethods)
      )
    )
    setAccounts(parseAirwallexAccountsForForm(defaultValues.accounts))
  }, [defaultValues, defaultsSignature])

  const updateAccount = (
    index: number,
    updater: (account: AirwallexAccountForm) => AirwallexAccountForm
  ) => {
    setAccounts((previous) =>
      previous.map((account, itemIndex) =>
        itemIndex === index ? updater(account) : account
      )
    )
  }

  const removeAccount = (index: number) => {
    setAccounts((previous) => {
      const next = previous.filter((_, itemIndex) => itemIndex !== index)
      return next.length > 0 ? next : [createBlankAccount(0)]
    })
  }

  const handleSave = async () => {
    try {
      const updates = [
        { key: 'airwallex_setting.enabled', value: enabled },
        {
          key: 'airwallex_setting.accounts',
          value: serializeAirwallexAccounts(accounts),
        },
        {
          key: 'airwallex_setting.allowed_payment_methods',
          value: serializeAllowedPaymentMethods(allowedPaymentMethods),
        },
        {
          key: 'airwallex_setting.payment_methods_cache_ttl_seconds',
          value: Math.max(0, Number(paymentMethodsCacheTTLSeconds) || 0),
        },
        { key: 'airwallex_setting.ops_enabled', value: opsEnabled },
        {
          key: 'airwallex_setting.http_timeout_seconds',
          value: Math.max(1, Number(httpTimeoutSeconds) || 15),
        },
      ]

      for (const update of updates) {
        await updateOption.mutateAsync(update)
      }
      toast.success(t('Updated successfully'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('Update failed'))
    }
  }

  return (
    <div className='space-y-4 pt-4'>
      <div>
        <h3 className='text-lg font-medium'>{t('Airwallex Gateway')}</h3>
        <p className='text-muted-foreground text-sm'>
          {t('Configuration for Airwallex payment integration')}
        </p>
      </div>

      <Alert>
        <AlertDescription className='text-xs'>
          {t(
            'Configure at least one enabled business account with Base URL, Client ID, API Key, and Webhook Secret. Leave secret fields blank to keep the existing configured value.'
          )}
        </AlertDescription>
      </Alert>

      <div className='grid gap-4 md:grid-cols-2'>
        <div className='flex items-center gap-2 rounded-lg border p-4'>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
          <div>
            <Label>{t('Enable Airwallex')}</Label>
            <p className='text-muted-foreground text-xs'>
              {t('Show Airwallex recharge options when an account is ready')}
            </p>
          </div>
        </div>
        <div className='flex items-center gap-2 rounded-lg border p-4'>
          <Switch checked={opsEnabled} onCheckedChange={setOpsEnabled} />
          <div>
            <Label>{t('Enable operations polling')}</Label>
            <p className='text-muted-foreground text-xs'>
              {t(
                'Allow background reconciliation for pending Airwallex orders'
              )}
            </p>
          </div>
        </div>
      </div>

      <div className='grid gap-4 md:grid-cols-3'>
        <div className='grid gap-1.5'>
          <Label>{t('Allowed payment methods')}</Label>
          <Input
            value={allowedPaymentMethods}
            onChange={(event) => setAllowedPaymentMethods(event.target.value)}
            placeholder='card, alipaycn, googlepay'
          />
          <p className='text-muted-foreground text-xs'>
            {t(
              'Comma or space separated. Leave blank to allow all returned methods.'
            )}
          </p>
        </div>
        <div className='grid gap-1.5'>
          <Label>{t('Payment methods cache TTL (seconds)')}</Label>
          <Input
            type='number'
            min={0}
            value={paymentMethodsCacheTTLSeconds}
            onChange={(event) =>
              setPaymentMethodsCacheTTLSeconds(event.target.valueAsNumber)
            }
          />
        </div>
        <div className='grid gap-1.5'>
          <Label>{t('HTTP timeout (seconds)')}</Label>
          <Input
            type='number'
            min={1}
            value={httpTimeoutSeconds}
            onChange={(event) =>
              setHttpTimeoutSeconds(event.target.valueAsNumber)
            }
          />
        </div>
      </div>

      <Separator />

      <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h4 className='font-medium'>{t('Business accounts')}</h4>
          <p className='text-muted-foreground text-xs'>
            {t(
              'Business line keys are used by wallet checkout and webhook URLs.'
            )}
          </p>
        </div>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() =>
            setAccounts((previous) => [
              ...previous,
              createBlankAccount(previous.length),
            ])
          }
        >
          <Plus className='mr-2 h-3 w-3' />
          {t('Add account')}
        </Button>
      </div>

      <div className='space-y-4'>
        {accounts.map((account, index) => (
          <div
            key={`${account.biz}-${index}`}
            className='rounded-lg border p-4'
          >
            <div className='mb-4 flex items-center justify-between gap-3'>
              <div className='flex items-center gap-2'>
                <Switch
                  checked={account.enabled}
                  onCheckedChange={(value) =>
                    updateAccount(index, (item) => ({
                      ...item,
                      enabled: value,
                    }))
                  }
                />
                <Label>{t('Enable account')}</Label>
              </div>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={() => removeAccount(index)}
              >
                <Trash2 className='mr-2 h-3 w-3' />
                {t('Remove')}
              </Button>
            </div>

            <div className='grid gap-4 md:grid-cols-2'>
              <div className='grid gap-1.5'>
                <Label>{t('Business line')}</Label>
                <Input
                  value={account.biz}
                  onChange={(event) =>
                    updateAccount(index, (item) => ({
                      ...item,
                      biz: event.target.value,
                    }))
                  }
                  placeholder='b2c'
                />
              </div>
              <div className='grid gap-1.5'>
                <Label>{t('Base URL')}</Label>
                <Input
                  value={account.base_url}
                  onChange={(event) =>
                    updateAccount(index, (item) => ({
                      ...item,
                      base_url: event.target.value,
                    }))
                  }
                  placeholder='https://api.airwallex.com'
                />
              </div>
              <div className='grid gap-1.5'>
                <Label>{t('Client ID')}</Label>
                <Input
                  value={account.client_id}
                  onChange={(event) =>
                    updateAccount(index, (item) => ({
                      ...item,
                      client_id: event.target.value,
                    }))
                  }
                  autoComplete='off'
                />
              </div>
              <div className='grid gap-1.5'>
                <Label>{t('Login As')}</Label>
                <Input
                  value={account.login_as}
                  onChange={(event) =>
                    updateAccount(index, (item) => ({
                      ...item,
                      login_as: event.target.value,
                    }))
                  }
                  placeholder={t('Optional')}
                />
              </div>
              <div className='grid gap-1.5'>
                <Label>
                  {t('API Key')}
                  {account.apiKeyConfigured ? (
                    <span className='text-muted-foreground ml-2 text-xs'>
                      {t('Configured')}
                    </span>
                  ) : null}
                </Label>
                <Input
                  type='password'
                  value={account.api_key}
                  onChange={(event) =>
                    updateAccount(index, (item) => ({
                      ...item,
                      api_key: event.target.value,
                    }))
                  }
                  placeholder={
                    account.apiKeyConfigured
                      ? t('Leave blank to keep existing key')
                      : t('Enter API key')
                  }
                  autoComplete='new-password'
                />
              </div>
              <div className='grid gap-1.5'>
                <Label>
                  {t('Webhook Secret')}
                  {account.webhookSecretConfigured ? (
                    <span className='text-muted-foreground ml-2 text-xs'>
                      {t('Configured')}
                    </span>
                  ) : null}
                </Label>
                <Input
                  type='password'
                  value={account.webhook_secret}
                  onChange={(event) =>
                    updateAccount(index, (item) => ({
                      ...item,
                      webhook_secret: event.target.value,
                    }))
                  }
                  placeholder={
                    account.webhookSecretConfigured
                      ? t('Leave blank to keep existing secret')
                      : t('Enter webhook secret')
                  }
                  autoComplete='new-password'
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button onClick={handleSave} disabled={updateOption.isPending}>
        {updateOption.isPending ? t('Saving...') : t('Save Airwallex settings')}
      </Button>
    </div>
  )
}
