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

import { Button } from '@/components/design-system/button'
import { Input } from '@/components/design-system/input'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/design-system/toggle-group'
import { PasswordInput } from '@/components/password-input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { TitledCard } from '@/components/ui/titled-card'
import { ROLE } from '@/lib/roles'

import { updateUserSettings } from '../api'
import {
  DEFAULT_QUOTA_WARNING_THRESHOLD,
  NOTIFICATION_METHODS,
} from '../constants'
import { parseUserSettings } from '../lib'
import type { UserProfile, UserSettings, NotifyType } from '../types'

const NOTIFICATION_ICONS: Record<NotifyType, typeof Mail> = {
  email: Mail,
  webhook: Webhook,
  bark: Bell,
  gotify: Server,
}

const NOTIFICATION_VALUES = new Set<NotifyType>(
  NOTIFICATION_METHODS.map((method) => method.value)
)

function normalizeNotifyType(value: unknown): NotifyType {
  return typeof value === 'string' &&
    NOTIFICATION_VALUES.has(value as NotifyType)
    ? (value as NotifyType)
    : 'email'
}

interface NotificationSettingsCardProps {
  profile: UserProfile | null
  loading: boolean
  onUpdate: () => void
}

export function NotificationSettingsCard({
  profile,
  loading: pageLoading,
  onUpdate,
}: NotificationSettingsCardProps) {
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

  // Update form field helper
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
        notify_type: normalizeNotifyType(parsed.notify_type),
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
    } catch {
      toast.error(t('Failed to update settings'))
    } finally {
      setLoading(false)
    }
  }

  const notifyType = normalizeNotifyType(settings.notify_type)

  if (pageLoading) {
    return (
      <Card data-card-hover='false' className='gap-0 overflow-hidden py-0'>
        <CardHeader className='border-b p-4 !pb-4 sm:p-5 sm:!pb-5'>
          <Skeleton className='h-6 w-40' />
          <Skeleton className='mt-2 h-4 w-64' />
        </CardHeader>
        <CardContent className='space-y-4 p-4 sm:p-5'>
          <Skeleton className='h-14 w-full' />
          <Skeleton className='h-9 w-full' />
          <Skeleton className='h-9 w-full' />
        </CardContent>
      </Card>
    )
  }

  return (
    <TitledCard
      title={t('Notification Settings')}
      description={t('Choose how you receive alerts and account notices')}
      disableHoverEffect
      contentClassName='space-y-5 sm:space-y-6'
    >
      {/* Notification Type */}
      <div className='space-y-2.5'>
        <Label>{t('Notification Method')}</Label>
        <ToggleGroup
          value={[notifyType]}
          onValueChange={(value) => {
            const nextValue = value.find((item) => item !== notifyType)
            if (nextValue) {
              updateField('notify_type', normalizeNotifyType(nextValue))
            }
          }}
          aria-label={t('Notification Method')}
          variant='outline'
          size='lg'
          spacing={2}
          className='grid w-full grid-cols-2 gap-2 sm:grid-cols-4'
        >
          {NOTIFICATION_METHODS.map((method) => {
            const Icon = NOTIFICATION_ICONS[method.value]
            return (
              <ToggleGroupItem
                key={method.value}
                value={method.value}
                className='h-auto min-h-14 w-full flex-col gap-1.5 px-3 py-2.5 sm:h-auto'
              >
                <Icon className='size-4' />
                <span className='max-w-full truncate text-xs font-medium'>
                  {t(method.label)}
                </span>
              </ToggleGroupItem>
            )
          })}
        </ToggleGroup>
      </div>

      {/* Warning Threshold */}
      <div className='space-y-1.5'>
        <Label htmlFor='threshold'>{t('Quota Warning Threshold')}</Label>
        <Input
          id='threshold'
          type='number'
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
      {notifyType === 'email' && (
        <div className='space-y-1.5'>
          <Label htmlFor='notifyEmail'>{t('Notification Email')}</Label>
          <Input
            id='notifyEmail'
            type='email'
            value={settings.notification_email}
            onChange={(e) => updateField('notification_email', e.target.value)}
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
              onChange={(e) => updateField('webhook_secret', e.target.value)}
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
            value={settings.bark_url}
            onChange={(e) => updateField('bark_url', e.target.value)}
            placeholder={t('https://api.day.app/yourkey/{{title}}/{{content}}')}
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
              value={settings.gotify_url}
              onChange={(e) => updateField('gotify_url', e.target.value)}
              placeholder={t('https://gotify.example.com')}
            />
            <p className='text-muted-foreground text-xs'>
              {t('Enter the full URL of your Gotify server')}
            </p>
          </div>
          <div className='space-y-1.5'>
            <Label htmlFor='gotifyToken'>{t('Gotify Application Token')}</Label>
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
          <div className='bg-muted/30 rounded-lg border p-3 sm:p-4'>
            <h5 className='mb-1.5 text-sm font-medium'>
              {t('Setup Instructions')}
            </h5>
            <ol className='text-muted-foreground space-y-1 text-xs'>
              <li>{t('1. Create an application in your Gotify server')}</li>
              <li>{t('2. Copy the application token')}</li>
              <li>{t('3. Enter your Gotify server URL and token above')}</li>
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

      {/* Preferences Section */}
      <div className='space-y-3 border-t pt-5 sm:pt-6'>
        <div>
          <h4 className='text-sm font-medium'>{t('Preferences')}</h4>
          <p className='text-muted-foreground mt-0.5 text-xs'>
            {t('Configure your account behavior preferences')}
          </p>
        </div>

        <div className='divide-border/60 divide-y rounded-lg border'>
          {/* Receive Upstream Model Update Notifications (admin only) */}
          {isAdmin && (
            <div className='flex items-start justify-between gap-3 p-3 sm:items-center sm:p-4'>
              <div className='space-y-0.5'>
                <Label htmlFor='upstreamModelUpdateNotify'>
                  {t('Receive Upstream Model Update Notifications')}
                </Label>
                <p className='text-muted-foreground line-clamp-3 text-xs sm:line-clamp-none'>
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

          {/* Accept Unset Model Price */}
          <div className='flex items-start justify-between gap-3 p-3 sm:items-center sm:p-4'>
            <div className='space-y-0.5'>
              <Label htmlFor='acceptUnsetPrice'>
                {t('Accept Unpriced Models')}
              </Label>
              <p className='text-muted-foreground text-xs'>
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

          {/* Record IP Log */}
          <div className='flex items-start justify-between gap-3 p-3 sm:items-center sm:p-4'>
            <div className='space-y-0.5'>
              <Label htmlFor='recordIp'>{t('Record IP Address')}</Label>
              <p className='text-muted-foreground text-xs'>
                {t('Log IP address for usage and error logs')}
              </p>
            </div>
            <Switch
              id='recordIp'
              className='shrink-0'
              checked={settings.record_ip_log}
              onCheckedChange={(checked) =>
                updateField('record_ip_log', checked)
              }
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className='flex justify-end'>
        <Button onClick={handleSave} disabled={loading}>
          {loading && <Loader2 className='mr-2 size-4 animate-spin' />}
          {loading ? t('Saving...') : t('Save Settings')}
        </Button>
      </div>
    </TitledCard>
  )
}
