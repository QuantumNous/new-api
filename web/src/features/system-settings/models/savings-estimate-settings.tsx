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
import { Code2, Save } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { JsonCodeEditor } from '@/components/json-code-editor'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import {
  SettingsSwitchField,
  SettingsSwitchRow,
} from '../components/settings-form-layout'
import { useUpdateOption } from '../hooks/use-update-option'
import {
  DEFAULT_SAVINGS_SETTING,
  formatSavingsSetting,
  isPlainObject,
  parseSavingsSetting,
  type BooleanSettingKey,
  type NumberSettingKey,
  type SavingsEstimateSetting,
} from './savings-estimate-setting'
import { normalizeJsonString, validateJsonString } from './utils'

const OPTION_KEY = 'SavingsEstimateSetting'

type SavingsEstimateSettingsProps = {
  defaultValue: string
}

export const SavingsEstimateSettings = memo(function SavingsEstimateSettings({
  defaultValue,
}: SavingsEstimateSettingsProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [editMode, setEditMode] = useState<'visual' | 'json'>('visual')
  const [setting, setSetting] = useState<SavingsEstimateSetting>(
    () => parseSavingsSetting(defaultValue) ?? { ...DEFAULT_SAVINGS_SETTING }
  )
  const [jsonText, setJsonText] = useState(() =>
    formatSavingsSetting(defaultValue)
  )

  useEffect(() => {
    const nextSetting = parseSavingsSetting(defaultValue)
    if (nextSetting) setSetting(nextSetting)
    setJsonText(formatSavingsSetting(defaultValue))
  }, [defaultValue])

  const validation = useMemo(
    () =>
      validateJsonString(jsonText, {
        predicate: isPlainObject,
        predicateMessage: 'JSON must be an object',
      }),
    [jsonText]
  )
  const validationMessage =
    validation.message === 'JSON must be an object'
      ? t('JSON must be an object')
      : validation.message || t('Invalid JSON')

  const updateBoolean = useCallback(
    (key: BooleanSettingKey, checked: boolean) => {
      setSetting((current) => ({ ...current, [key]: checked }))
    },
    []
  )

  const updateNumber = useCallback((key: NumberSettingKey, value: string) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed < 1) return
    setSetting((current) => ({
      ...current,
      [key]: Math.floor(parsed),
    }))
  }, [])

  const handleModeChange = useCallback(
    (nextMode: string) => {
      if (nextMode === 'json') {
        setJsonText(JSON.stringify(setting, null, 2))
        setEditMode('json')
        return
      }

      const nextSetting = parseSavingsSetting(jsonText)
      if (!nextSetting) {
        toast.error(validationMessage)
        return
      }
      setSetting(nextSetting)
      setJsonText(JSON.stringify(nextSetting, null, 2))
      setEditMode('visual')
    },
    [jsonText, setting, validationMessage]
  )

  const handleSave = useCallback(async () => {
    const currentSetting =
      editMode === 'visual' ? setting : parseSavingsSetting(jsonText)
    if (!currentSetting) {
      toast.error(validationMessage)
      return
    }

    const currentText = JSON.stringify(currentSetting)
    const normalized = normalizeJsonString(currentText)
    const saved = normalizeJsonString(formatSavingsSetting(defaultValue))
    if (normalized === saved) {
      toast.info(t('No changes to save'))
      return
    }

    try {
      await updateOption.mutateAsync({
        key: OPTION_KEY,
        value: normalized,
      })
    } catch {
      // useUpdateOption handles the user-facing error toast.
    }
  }, [
    defaultValue,
    editMode,
    jsonText,
    setting,
    t,
    updateOption,
    validationMessage,
  ])

  const overrideCount = Object.keys(setting.official_prices).length

  return (
    <div className='space-y-4'>
      <Alert>
        <AlertDescription>
          {t(
            'Uses local official pricing from the model marketplace by default; official_prices is only needed for overrides.'
          )}
        </AlertDescription>
      </Alert>

      <Tabs value={editMode} onValueChange={handleModeChange}>
        <TabsList className='grid w-full grid-cols-2'>
          <TabsTrigger value='visual'>{t('Visual')}</TabsTrigger>
          <TabsTrigger value='json'>{t('JSON')}</TabsTrigger>
        </TabsList>

        <TabsContent value='visual' className='mt-6 space-y-7'>
          <section className='space-y-1'>
            <h3 className='text-sm font-semibold'>{t('General')}</h3>
            <div className='divide-border divide-y'>
              <SettingsSwitchField
                checked={setting.enabled}
                onCheckedChange={(checked) => updateBoolean('enabled', checked)}
                label={t('Enable savings estimates')}
                description={t(
                  'Calculate estimated savings using official model prices.'
                )}
              />
              <SettingsSwitchField
                checked={setting.show_on_dashboard}
                onCheckedChange={(checked) =>
                  updateBoolean('show_on_dashboard', checked)
                }
                label={t('Show on dashboard')}
                description={t(
                  'Show the savings summary and trend on the user dashboard.'
                )}
              />
              <SettingsSwitchField
                checked={setting.show_on_usage_logs}
                onCheckedChange={(checked) =>
                  updateBoolean('show_on_usage_logs', checked)
                }
                label={t('Show in usage logs')}
                description={t(
                  'Show request-level savings estimates in usage logs.'
                )}
              />
            </div>
          </section>

          <section className='space-y-1 border-t pt-6'>
            <h3 className='text-sm font-semibold'>{t('Official pricing')}</h3>
            <div className='divide-border divide-y'>
              <SettingsSwitchField
                checked={setting.local_pricing_official_confirmed}
                onCheckedChange={(checked) =>
                  updateBoolean('local_pricing_official_confirmed', checked)
                }
                label={t('Confirm marketplace pricing as official')}
                description={t(
                  'Treat local model marketplace prices as official reference prices.'
                )}
              />
              <SettingsSwitchField
                checked={setting.require_official_confirmation}
                onCheckedChange={(checked) =>
                  updateBoolean('require_official_confirmation', checked)
                }
                label={t('Require official price confirmation')}
                description={t(
                  'Exclude prices that have not been confirmed as official.'
                )}
              />
              <SettingsSwitchRow className='py-3'>
                <div className='min-w-0 space-y-0.5'>
                  <Label htmlFor='official-price-stale-days'>
                    {t('Official price validity (days)')}
                  </Label>
                  <p className='text-muted-foreground text-xs'>
                    {t(
                      'Prices older than this are excluded from savings estimates.'
                    )}
                  </p>
                </div>
                <Input
                  id='official-price-stale-days'
                  type='number'
                  min={1}
                  step={1}
                  className='w-28 shrink-0'
                  value={setting.official_price_stale_days}
                  onChange={(event) =>
                    updateNumber(
                      'official_price_stale_days',
                      event.target.value
                    )
                  }
                />
              </SettingsSwitchRow>
            </div>
          </section>

          <section className='space-y-1 border-t pt-6'>
            <h3 className='text-sm font-semibold'>
              {t('Historical estimates')}
            </h3>
            <div className='divide-border divide-y'>
              <SettingsSwitchField
                checked={setting.rebuild_legacy_logs}
                onCheckedChange={(checked) =>
                  updateBoolean('rebuild_legacy_logs', checked)
                }
                label={t('Recalculate legacy usage logs')}
                description={t(
                  'Estimate historical logs without a saved official price snapshot.'
                )}
              />
              <SettingsSwitchRow className='py-3'>
                <div className='min-w-0 space-y-0.5'>
                  <Label htmlFor='max-summary-days'>
                    {t('Maximum summary range (days)')}
                  </Label>
                  <p className='text-muted-foreground text-xs'>
                    {t('Limit the date range of each savings summary query.')}
                  </p>
                </div>
                <Input
                  id='max-summary-days'
                  type='number'
                  min={1}
                  step={1}
                  className='w-28 shrink-0'
                  value={setting.max_summary_days}
                  onChange={(event) =>
                    updateNumber('max_summary_days', event.target.value)
                  }
                />
              </SettingsSwitchRow>
              <SettingsSwitchRow className='py-3'>
                <div className='min-w-0 space-y-0.5'>
                  <Label htmlFor='max-summary-log-rows'>
                    {t('Maximum scanned log rows')}
                  </Label>
                  <p className='text-muted-foreground text-xs'>
                    {t('Limit the number of usage logs scanned per summary.')}
                  </p>
                </div>
                <Input
                  id='max-summary-log-rows'
                  type='number'
                  min={1}
                  step={1}
                  className='w-28 shrink-0'
                  value={setting.max_summary_log_rows}
                  onChange={(event) =>
                    updateNumber('max_summary_log_rows', event.target.value)
                  }
                />
              </SettingsSwitchRow>
            </div>
          </section>

          <section className='flex flex-wrap items-center justify-between gap-3 border-t pt-6'>
            <div className='min-w-0 space-y-0.5'>
              <h3 className='text-sm font-semibold'>{t('Price overrides')}</h3>
              <p className='text-muted-foreground text-xs'>
                {t('{{count}} model price overrides', { count: overrideCount })}
              </p>
            </div>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => handleModeChange('json')}
            >
              <Code2 data-icon='inline-start' aria-hidden='true' />
              {t('Manage in JSON')}
            </Button>
          </section>
        </TabsContent>

        <TabsContent value='json' className='mt-6 space-y-2'>
          <JsonCodeEditor value={jsonText} onChange={setJsonText} />
          {!validation.valid && (
            <p className='text-destructive text-sm'>{validationMessage}</p>
          )}
        </TabsContent>
      </Tabs>

      <div className='flex justify-end'>
        <Button
          onClick={handleSave}
          disabled={
            updateOption.isPending || (editMode === 'json' && !validation.valid)
          }
        >
          <Save data-icon='inline-start' aria-hidden='true' />
          {updateOption.isPending
            ? t('Saving...')
            : t('Save savings estimate settings')}
        </Button>
      </div>
    </div>
  )
})
