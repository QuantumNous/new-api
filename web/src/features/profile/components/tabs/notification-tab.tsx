import { useState, useEffect, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { updateUserSettings } from '../../api'
import {
  DEFAULT_QUOTA_WARNING_THRESHOLD,
  NOTIFICATION_METHODS,
} from '../../constants'
import { parseUserSettings } from '../../lib'
import type { UserProfile, UserSettings, NotifyType } from '../../types'

// ============================================================================
// Settings Tab Component
// ============================================================================
// Combines notification settings and user preferences

interface NotificationTabProps {
  profile: UserProfile | null
  onUpdate: () => void
}

export function NotificationTab({ profile, onUpdate }: NotificationTabProps) {
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState<UserSettings>({
    notify_type: 'email',
    quota_warning_threshold: DEFAULT_QUOTA_WARNING_THRESHOLD,
    notification_email: '',
    webhook_url: '',
    webhook_secret: '',
    bark_url: '',
    accept_unset_model_ratio_model: false,
    record_ip_log: false,
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
        notify_type: parsed.notify_type || 'email',
        quota_warning_threshold:
          parsed.quota_warning_threshold ?? DEFAULT_QUOTA_WARNING_THRESHOLD,
        notification_email: parsed.notification_email ?? '',
        webhook_url: parsed.webhook_url ?? '',
        webhook_secret: parsed.webhook_secret ?? '',
        bark_url: parsed.bark_url ?? '',
        accept_unset_model_ratio_model:
          parsed.accept_unset_model_ratio_model || false,
        record_ip_log: parsed.record_ip_log || false,
      })
    }
  }, [profile])

  const handleSave = async () => {
    try {
      setLoading(true)
      const response = await updateUserSettings(settings)

      if (response.success) {
        toast.success('Settings updated successfully')
        onUpdate()
      } else {
        toast.error(response.message || 'Failed to update settings')
      }
    } catch (error) {
      toast.error('Failed to update settings')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='space-y-6'>
      {/* Notification Type */}
      <div className='space-y-3'>
        <Label>Notification Method</Label>
        <RadioGroup
          value={settings.notify_type}
          onValueChange={(value) =>
            updateField('notify_type', value as NotifyType)
          }
        >
          {NOTIFICATION_METHODS.map((method) => (
            <div key={method.value} className='flex items-center space-x-2'>
              <RadioGroupItem value={method.value} id={method.value} />
              <Label htmlFor={method.value} className='font-normal'>
                {method.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* Warning Threshold */}
      <div className='space-y-2'>
        <Label htmlFor='threshold'>Quota Warning Threshold</Label>
        <Input
          id='threshold'
          type='number'
          value={settings.quota_warning_threshold}
          onChange={(e) =>
            updateField('quota_warning_threshold', Number(e.target.value))
          }
          placeholder='Enter threshold'
        />
        <p className='text-muted-foreground text-xs'>
          Get notified when balance falls below this value
        </p>
      </div>

      {/* Email Settings */}
      {settings.notify_type === 'email' && (
        <div className='space-y-2'>
          <Label htmlFor='notifyEmail'>Notification Email</Label>
          <Input
            id='notifyEmail'
            type='email'
            value={settings.notification_email}
            onChange={(e) => updateField('notification_email', e.target.value)}
            placeholder='Leave empty to use account email'
          />
        </div>
      )}

      {/* Webhook Settings */}
      {settings.notify_type === 'webhook' && (
        <>
          <div className='space-y-2'>
            <Label htmlFor='webhookUrl'>Webhook URL</Label>
            <Input
              id='webhookUrl'
              type='url'
              value={settings.webhook_url}
              onChange={(e) => updateField('webhook_url', e.target.value)}
              placeholder='https://example.com/webhook'
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='webhookSecret'>Webhook Secret</Label>
            <Input
              id='webhookSecret'
              type='password'
              value={settings.webhook_secret}
              onChange={(e) => updateField('webhook_secret', e.target.value)}
              placeholder='Enter secret key'
            />
          </div>
        </>
      )}

      {/* Bark Settings */}
      {settings.notify_type === 'bark' && (
        <div className='space-y-2'>
          <Label htmlFor='barkUrl'>Bark Push URL</Label>
          <Input
            id='barkUrl'
            type='url'
            value={settings.bark_url}
            onChange={(e) => updateField('bark_url', e.target.value)}
            placeholder='https://api.day.app/yourkey/{{title}}/{{content}}'
          />
          <p className='text-muted-foreground text-xs'>
            Template variables: {'{{title}}'}, {'{{content}}'}
          </p>
        </div>
      )}

      {/* Divider */}
      <div className='border-t' />

      {/* Preferences Section */}
      <div className='space-y-4'>
        <div>
          <h4 className='text-sm font-medium'>Preferences</h4>
          <p className='text-muted-foreground mt-1 text-xs'>
            Configure your account behavior preferences
          </p>
        </div>

        {/* Accept Unset Model Price */}
        <div className='flex items-center justify-between rounded-lg border p-4'>
          <div className='space-y-0.5'>
            <Label htmlFor='acceptUnsetPrice'>Accept Unpriced Models</Label>
            <p className='text-muted-foreground text-sm'>
              Allow using models without price configuration
            </p>
          </div>
          <Switch
            id='acceptUnsetPrice'
            checked={settings.accept_unset_model_ratio_model}
            onCheckedChange={(checked) =>
              updateField('accept_unset_model_ratio_model', checked)
            }
          />
        </div>

        {/* Record IP Log */}
        <div className='flex items-center justify-between rounded-lg border p-4'>
          <div className='space-y-0.5'>
            <Label htmlFor='recordIp'>Record IP Address</Label>
            <p className='text-muted-foreground text-sm'>
              Log IP address for usage and error logs
            </p>
          </div>
          <Switch
            id='recordIp'
            checked={settings.record_ip_log}
            onCheckedChange={(checked) => updateField('record_ip_log', checked)}
          />
        </div>
      </div>

      {/* Save Button */}
      <div className='flex justify-end'>
        <Button onClick={handleSave} disabled={loading}>
          {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
          {loading ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  )
}
