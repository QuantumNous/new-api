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
import { useState, useEffect, useCallback } from 'react'
import { Loader2, Mail } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ROLE } from '@/lib/roles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { updateUserSettings } from '../../api'
import {
  DEFAULT_QUOTA_WARNING_THRESHOLD,
  normalizeNotifyTypeForUi,
  UI_VISIBLE_NOTIFICATION_METHODS,
} from '../../constants'
import { parseUserSettings } from '../../lib'
import type { UserProfile, UserSettings } from '../../types'

const NOTIFICATION_ICONS: Record<string, typeof Mail> = {
  email: Mail,
}

// ============================================================================
// Settings Tab Component
// ============================================================================

interface NotificationTabProps {
  profile: UserProfile | null
  onUpdate: () => void
}

export function NotificationTab({ profile, onUpdate }: NotificationTabProps) {
  const { t } = useTranslation()
  const isAdmin = (profile?.role ?? 0) >= ROLE.ADMIN
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState<UserSettings>({
    notify_type: 'email',
    quota_warning_threshold: DEFAULT_QUOTA_WARNING_THRESHOLD,
    notification_email: '',
    webhook_url: '',
    webhook_secret: '',
    bark_url: '',
    gotify_url: '',
    gotify_token: '',
    gotify_priority: 5,
    accept_unset_model_ratio_model: false,
    record_ip_log: false,
    upstream_model_update_notify_enabled: false,
  })

  const updateField = useCallback(
    <K extends keyof UserSettings>(field: K, value: UserSettings[K]) => {
      setSettings((prev) => ({ ...prev, [field]: value }))
    },
    []
  )

  useEffect(() => {
    if (profile?.setting) {
      const parsed = parseUserSettings(profile.setting)
      setSettings({
        notify_type: normalizeNotifyTypeForUi(parsed.notify_type),
        quota_warning_threshold:
          parsed.quota_warning_threshold ?? DEFAULT_QUOTA_WARNING_THRESHOLD,
        notification_email: parsed.notification_email ?? '',
        webhook_url: parsed.webhook_url ?? '',
        webhook_secret: parsed.webhook_secret ?? '',
        bark_url: parsed.bark_url ?? '',
        gotify_url: parsed.gotify_url ?? '',
        gotify_token: parsed.gotify_token ?? '',
        gotify_priority: parsed.gotify_priority ?? 5,
        accept_unset_model_ratio_model:
          parsed.accept_unset_model_ratio_model || false,
        record_ip_log: parsed.record_ip_log || false,
        upstream_model_update_notify_enabled:
          parsed.upstream_model_update_notify_enabled || false,
      })
    }
  }, [profile])

  const handleSave = async () => {
    try {
      setLoading(true)
      const response = await updateUserSettings(settings)

      if (response.success) {
        toast.success(t('Settings updated successfully'))
        onUpdate()
      } else {
        toast.error(response.message || t('Failed to update settings'))
      }
    } catch (_error) {
      toast.error(t('Failed to update settings'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='space-y-4 sm:space-y-6'>
      {/* Notification Type — demo UI shows email only */}
      <div className='space-y-2.5'>
        <Label>{t('Notification Method')}</Label>
        <RadioGroup
          value={settings.notify_type}
          onValueChange={(value) => updateField('notify_type', 'email')}
          className='grid max-w-xs grid-cols-1 gap-1.5 sm:gap-3'
        >
          {UI_VISIBLE_NOTIFICATION_METHODS.map((method) => {
            const Icon = NOTIFICATION_ICONS[method.value]
            const isSelected = settings.notify_type === method.value
            return (
              <Label
                key={method.value}
                htmlFor={method.value}
                className={`flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border p-2 text-center transition-colors sm:min-h-20 sm:gap-2 sm:border-2 sm:p-3 ${
                  isSelected
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-muted hover:border-muted-foreground/25 hover:bg-muted/50'
                }`}
              >
                <RadioGroupItem
                  value={method.value}
                  id={method.value}
                  className='sr-only'
                />
                <Icon className='h-4 w-4 sm:h-5 sm:w-5' />
                <span className='max-w-full truncate text-xs font-medium sm:text-sm'>
                  {t(method.label)}
                </span>
              </Label>
            )
          })}
        </RadioGroup>
      </div>

      {/* Warning Threshold */}
      <div className='space-y-1.5'>
        <Label htmlFor='threshold'>{t('Quota Warning Threshold')}</Label>
        <Input
          id='threshold'
          type='number'
          className='h-9'
          value={settings.quota_warning_threshold}
          onChange={(e) =>
            updateField('quota_warning_threshold', Number(e.target.value))
          }
          placeholder={t('Enter threshold')}
        />
        <p className='text-muted-foreground text-xs'>
          {t('Get notified when balance falls below this value')}
        </p>
      </div>

      {/* Email Settings */}
      <div className='space-y-1.5'>
        <Label htmlFor='notifyEmail'>{t('Notification Email')}</Label>
        <Input
          id='notifyEmail'
          type='email'
          className='h-9'
          value={settings.notification_email}
          onChange={(e) => updateField('notification_email', e.target.value)}
          placeholder={t('Leave empty to use account email')}
        />
      </div>

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

        {isAdmin && (
          <div className='flex items-start justify-between gap-3 rounded-lg border p-3 sm:items-center sm:p-4'>
            <div className='space-y-0.5'>
              <Label htmlFor='upstreamModelUpdateNotify'>
                {t('Receive Upstream Model Update Notifications')}
              </Label>
              <p className='text-muted-foreground line-clamp-3 text-xs sm:line-clamp-none sm:text-sm'>
                {t(
                  'Only available for admins. When enabled, you will receive a summary notification via your selected method when the scheduled model check detects upstream model changes or check failures.'
                )}
              </p>
            </div>
            <Switch
              id='upstreamModelUpdateNotify'
              className='shrink-0'
              checked={settings.upstream_model_update_notify_enabled}
              onCheckedChange={(checked) =>
                updateField('upstream_model_update_notify_enabled', checked)
              }
            />
          </div>
        )}

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

        <div className='flex items-start justify-between gap-3 rounded-lg border p-3 sm:items-center sm:p-4'>
          <div className='space-y-0.5'>
            <Label htmlFor='recordIp'>{t('Record IP Address')}</Label>
            <p className='text-muted-foreground text-xs sm:text-sm'>
              {t('Log IP address for usage and error logs')}
            </p>
          </div>
          <Switch
            id='recordIp'
            className='shrink-0'
            checked={settings.record_ip_log}
            onCheckedChange={(checked) => updateField('record_ip_log', checked)}
          />
        </div>
      </div>

      <div className='flex justify-end'>
        <Button onClick={handleSave} disabled={loading}>
          {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
          {loading ? t('Saving...') : t('Save Settings')}
        </Button>
      </div>
    </div>
  )
}
