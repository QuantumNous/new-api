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
import { Bell, Loader2, Mail, Server, Webhook } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { PasswordInput } from '@/components/password-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  SettingsControlChildren,
  SettingsControlGroup,
  SettingsSwitchField,
} from '@/features/system-settings/components/settings-form-layout'
import { getCurrencyDisplay, getCurrencyLabel } from '@/lib/currency'
import {
  formatQuota,
  parseQuotaFromDollars,
  quotaUnitsToDollars,
} from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'
import { ROLE } from '@/lib/roles'

import { updateUserSettings } from '../../api'
import { NOTIFICATION_METHODS } from '../../constants'
import { normalizeUserSettings } from '../../lib/user-settings'
import type { UserProfile, NotifyType } from '../../types'

const NOTIFICATION_ICONS: Record<NotifyType, typeof Mail> = {
  email: Mail,
  webhook: Webhook,
  bark: Bell,
  gotify: Server,
}

// ============================================================================
// Settings Tab Component
// ============================================================================

interface NotificationTabProps {
  profile: UserProfile | null
  onUpdate: () => void
  /** Whether the site sends low balance reminders at all */
  quotaRemindEnabled: boolean
  /** The site default reminder threshold, in quota units */
  quotaRemindThreshold: number
}

export function NotificationTab({
  profile,
  onUpdate,
  quotaRemindEnabled,
  quotaRemindThreshold,
}: NotificationTabProps) {
  const { t } = useTranslation()
  const role = profile?.role ?? 0
  const isAdmin = role >= ROLE.ADMIN
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState(() => normalizeUserSettings())
  const [thresholdInput, setThresholdInput] = useState('')

  // Update form field helper
  const updateField = useCallback(
    <K extends keyof typeof settings>(
      field: K,
      value: (typeof settings)[K]
    ) => {
      setSettings((prev) => ({ ...prev, [field]: value }))
    },
    []
  )

  useEffect(() => {
    if (profile?.setting) {
      const next = normalizeUserSettings(profile.setting)
      setSettings(next)
      // 0 means the site default and shows as an empty input.
      setThresholdInput(
        next.quota_warning_threshold
          ? String(quotaUnitsToDollars(next.quota_warning_threshold))
          : ''
      )
    }
  }, [profile])

  const handleSave = async () => {
    try {
      setLoading(true)
      const { record_ip_log: _recordIpLog, ...notificationSettings } = settings
      const response = await updateUserSettings(notificationSettings)

      if (response.success) {
        toast.success(t('Settings updated successfully'))
        onUpdate()
      } else {
        handleServerError(response, t('Failed to update settings'))
      }
    } catch (error) {
      handleServerError(error, t('Failed to update settings'))
    } finally {
      setLoading(false)
    }
  }

  const notifyType = settings.notify_type
  // Switches the user never chose: reminders stay on, and root alone gets
  // channel notifications.
  const quotaWarningEnabled = settings.quota_warning_enabled ?? true
  const channelNotifyEnabled =
    settings.channel_notify_enabled ?? role >= ROLE.SUPER_ADMIN
  const tokensOnly = getCurrencyDisplay().meta.kind === 'tokens'

  return (
    <div className='space-y-4 sm:space-y-6'>
      {!quotaRemindEnabled && !isAdmin && (
        <p className='text-muted-foreground text-sm'>
          {t('No notifications are available to you right now')}
        </p>
      )}

      {(quotaRemindEnabled || isAdmin) && (
        <>
          {/* Notification Type */}
          <div className='space-y-2.5'>
            <Label>{t('Notification Method')}</Label>
            <ToggleGroup
              value={[notifyType]}
              onValueChange={(value) => {
                const nextValue = value.find((item) => item !== notifyType)
                if (nextValue) {
                  updateField('notify_type', nextValue as NotifyType)
                }
              }}
              aria-label={t('Notification Method')}
              variant='outline'
              size='lg'
              spacing={2}
              className='grid w-full grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3'
            >
              {NOTIFICATION_METHODS.map((method) => {
                const Icon = NOTIFICATION_ICONS[method.value]
                return (
                  <ToggleGroupItem
                    key={method.value}
                    value={method.value}
                    className='h-auto min-h-14 w-full flex-col gap-1.5 px-3 py-3 sm:min-h-16'
                  >
                    <Icon className='h-4 w-4 sm:h-5 sm:w-5' />
                    <span className='max-w-full truncate text-xs font-medium sm:text-sm'>
                      {t(method.label)}
                    </span>
                  </ToggleGroupItem>
                )
              })}
            </ToggleGroup>
          </div>

          {/* Email Settings */}
          {notifyType === 'email' && (
            <div className='space-y-1.5'>
              <Label htmlFor='notifyEmail'>{t('Notification Email')}</Label>
              <Input
                id='notifyEmail'
                type='email'
                className='h-9'
                value={settings.notification_email}
                onChange={(e) =>
                  updateField('notification_email', e.target.value)
                }
                placeholder={t('Leave empty to use account email')}
              />
            </div>
          )}

          {/* Webhook Settings */}
          {notifyType === 'webhook' && (
            <>
              <div className='space-y-1.5'>
                <Label htmlFor='webhookUrl'>{t('Webhook URL')}</Label>
                <Input
                  id='webhookUrl'
                  type='url'
                  className='h-9'
                  value={settings.webhook_url}
                  onChange={(e) => updateField('webhook_url', e.target.value)}
                  placeholder={t('https://example.com/webhook')}
                />
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='webhookSecret'>{t('Webhook Secret')}</Label>
                <PasswordInput
                  id='webhookSecret'
                  value={settings.webhook_secret}
                  onChange={(e) =>
                    updateField('webhook_secret', e.target.value)
                  }
                  placeholder={t('Enter secret key')}
                />
              </div>
            </>
          )}

          {/* Bark Settings */}
          {notifyType === 'bark' && (
            <div className='space-y-1.5'>
              <Label htmlFor='barkUrl'>{t('Bark Push URL')}</Label>
              <Input
                id='barkUrl'
                type='url'
                className='h-9'
                value={settings.bark_url}
                onChange={(e) => updateField('bark_url', e.target.value)}
                placeholder={t(
                  'https://api.day.app/yourkey/{{title}}/{{content}}'
                )}
              />
              <p className='text-muted-foreground text-xs'>
                {t('Template variables:')} {'{{title}}'}, {'{{content}}'}
              </p>
            </div>
          )}

          {/* Gotify Settings */}
          {notifyType === 'gotify' && (
            <>
              <div className='space-y-1.5'>
                <Label htmlFor='gotifyUrl'>{t('Gotify Server URL')}</Label>
                <Input
                  id='gotifyUrl'
                  type='url'
                  className='h-9'
                  value={settings.gotify_url}
                  onChange={(e) => updateField('gotify_url', e.target.value)}
                  placeholder={t('https://gotify.example.com')}
                />
                <p className='text-muted-foreground text-xs'>
                  {t('Enter the full URL of your Gotify server')}
                </p>
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='gotifyToken'>
                  {t('Gotify Application Token')}
                </Label>
                <PasswordInput
                  id='gotifyToken'
                  value={settings.gotify_token}
                  onChange={(e) => updateField('gotify_token', e.target.value)}
                  placeholder={t('Enter application token')}
                />
                <p className='text-muted-foreground text-xs'>
                  {t('Token obtained from your Gotify application')}
                </p>
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='gotifyPriority'>{t('Message Priority')}</Label>
                <Input
                  id='gotifyPriority'
                  type='number'
                  className='h-9'
                  min='0'
                  max='10'
                  value={settings.gotify_priority}
                  onChange={(e) =>
                    updateField('gotify_priority', Number(e.target.value))
                  }
                  placeholder='5'
                />
                <p className='text-muted-foreground text-xs'>
                  {t(
                    'Priority level from 0 (lowest) to 10 (highest), default is 5'
                  )}
                </p>
              </div>
              <div className='bg-muted/50 rounded-lg border p-3 sm:p-4'>
                <h5 className='mb-1.5 text-sm font-medium sm:mb-2'>
                  {t('Setup Instructions')}
                </h5>
                <ol className='text-muted-foreground space-y-1 text-xs'>
                  <li>{t('1. Create an application in your Gotify server')}</li>
                  <li>{t('2. Copy the application token')}</li>
                  <li>
                    {t('3. Enter your Gotify server URL and token above')}
                  </li>
                </ol>
                <p className='text-muted-foreground mt-3 text-xs'>
                  {t('Learn more:')}{' '}
                  <a
                    href='https://gotify.net/'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-primary underline underline-offset-4'
                  >
                    {t('Gotify Documentation')}
                  </a>
                </p>
              </div>
            </>
          )}

          {/* Notifications to receive */}
          <div className='space-y-2.5'>
            <h4 className='text-sm font-medium'>
              {t('Notifications to receive')}
            </h4>
            <SettingsControlGroup>
              {quotaRemindEnabled && (
                <>
                  <SettingsSwitchField
                    controlId='quotaWarningEnabled'
                    label={t('Low balance reminder')}
                    description={t(
                      'Remind me once when my balance drops below the threshold'
                    )}
                    checked={quotaWarningEnabled}
                    onCheckedChange={(checked) =>
                      updateField('quota_warning_enabled', checked)
                    }
                  />
                  {quotaWarningEnabled && (
                    <SettingsControlChildren className='space-y-1.5 pb-1'>
                      <Label htmlFor='threshold'>
                        {t('Reminder threshold')} ({getCurrencyLabel()})
                      </Label>
                      <Input
                        id='threshold'
                        type='number'
                        className='h-9'
                        min={0}
                        step={tokensOnly ? 1 : 0.000001}
                        value={thresholdInput}
                        onChange={(e) => {
                          const value = e.target.value
                          setThresholdInput(value)
                          updateField(
                            'quota_warning_threshold',
                            value.trim() === ''
                              ? 0
                              : parseQuotaFromDollars(Number(value))
                          )
                        }}
                        placeholder={String(
                          quotaUnitsToDollars(quotaRemindThreshold)
                        )}
                      />
                      <p className='text-muted-foreground text-xs'>
                        {t('Leave empty to use the site default ({{amount}})', {
                          amount: formatQuota(quotaRemindThreshold),
                        })}
                      </p>
                    </SettingsControlChildren>
                  )}
                </>
              )}
              {isAdmin && (
                <>
                  <SettingsSwitchField
                    controlId='channelNotify'
                    label={t('Channel notifications')}
                    description={t(
                      'When a channel is disabled or re-enabled automatically, or a test of all channels finishes'
                    )}
                    checked={channelNotifyEnabled}
                    onCheckedChange={(checked) =>
                      updateField('channel_notify_enabled', checked)
                    }
                  />
                  <SettingsSwitchField
                    controlId='upstreamModelUpdateNotify'
                    label={t('Upstream Model Updates')}
                    description={t(
                      'Only available for admins. When enabled, you will receive a summary notification via your selected method when the scheduled model check detects upstream model changes or check failures.'
                    )}
                    checked={settings.upstream_model_update_notify_enabled}
                    onCheckedChange={(checked) =>
                      updateField(
                        'upstream_model_update_notify_enabled',
                        checked
                      )
                    }
                  />
                </>
              )}
            </SettingsControlGroup>
          </div>
        </>
      )}

      {/* Divider */}
      <div className='border-t' />

      {/* Preferences Section */}
      <div className='space-y-3'>
        <div>
          <h4 className='text-sm font-medium'>{t('Preferences')}</h4>
          <p className='text-muted-foreground mt-1 text-xs'>
            {t('Configure your account behavior preferences')}
          </p>
        </div>

        {/* Accept Unset Model Price */}
        <div className='flex items-start justify-between gap-3 rounded-lg border p-3 sm:items-center sm:p-4'>
          <div className='space-y-0.5'>
            <Label htmlFor='acceptUnsetPrice'>
              {t('Accept Unpriced Models')}
            </Label>
            <p className='text-muted-foreground text-xs sm:text-sm'>
              {t('Allow using models without price configuration')}
            </p>
          </div>
          <Switch
            id='acceptUnsetPrice'
            className='shrink-0'
            checked={settings.accept_unset_model_ratio_model}
            onCheckedChange={(checked) =>
              updateField('accept_unset_model_ratio_model', checked)
            }
          />
        </div>
      </div>

      {/* Save Button */}
      <div className='flex justify-end'>
        <Button onClick={handleSave} disabled={loading}>
          {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
          {loading ? t('Saving...') : t('Save Settings')}
        </Button>
      </div>
    </div>
  )
}
