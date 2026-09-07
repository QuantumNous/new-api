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
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Main } from '@/components/layout'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

import {
  getSchedulerConfig,
  testSchedulerConnection,
  updateSchedulerConfig,
  type SchedulerConfig,
} from '../api'

const defaults: SchedulerConfig = {
  enabled: false,
  bootstrap_urls: '',
  local_url: 'http://127.0.0.1:18080',
  token_set: false,
  mode: 'shadow',
  canary_percent: 0,
  canary_salt: 'scheduler-v2',
  shadow_timeout_ms: 100,
  runtime_prefix: 'new-api:scheduler:runtime',
  runtime_high_watermark: 0.8,
  signing_secret_set: false,
  catalog_token_set: false,
  emergency_native_routing: false,
  emergency_max_duration_seconds: 600,
  emergency_groups: '',
  emergency_models: '',
  emergency_local_switch: false,
  kill_switch: false,
}

const clampRuntimeHighWatermark = (value: number) =>
  Number.isFinite(value) ? Math.min(0.99, Math.max(0.5, value)) : 0.8

export function SchedulerConfigPage() {
  const { t } = useTranslation()
  const [config, setConfig] = useState(defaults)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [schedulerToken, setSchedulerToken] = useState('')
  const [signingSecret, setSigningSecret] = useState('')
  const [pendingEnabled, setPendingEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    void getSchedulerConfig()
      .then((response) => setConfig({ ...defaults, ...response.data }))
      .catch(() => toast.error(t('Failed to load scheduler configuration')))
      .finally(() => setLoading(false))
  }, [t])

  const save = async () => {
    setSaving(true)
    try {
      const runtimeHighWatermark = clampRuntimeHighWatermark(
        config.runtime_high_watermark
      )
      const payload: Partial<SchedulerConfig> & Record<string, unknown> = {
        ...config,
        runtime_high_watermark: runtimeHighWatermark,
        token: schedulerToken || undefined,
        signing_secret: signingSecret || undefined,
      }
      delete payload.bootstrap_urls
      delete payload.local_url
      const response = await updateSchedulerConfig(payload)
      if (!response.success) throw new Error(t('Update failed'))
      setConfig({ ...defaults, ...response.data })
      setSchedulerToken('')
      setSigningSecret('')
      toast.success(t('Scheduler configuration saved'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('Update failed'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Main>
        <div className='text-muted-foreground p-6'>{t('Loading...')}</div>
      </Main>
    )
  }
  return (
    <Main className='overflow-y-auto'>
      <div className='mx-auto w-full max-w-4xl space-y-4 p-4 sm:p-6'>
        <Card>
          <CardHeader>
            <CardTitle>{t('Scheduling Configuration')}</CardTitle>
            <CardDescription>
              {t(
                'Configure how new-api connects to and consumes Scheduler decisions.'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-6'>
            <div className='flex items-center justify-between rounded-lg border p-4'>
              <div>
                <Label>{t('Enable Scheduler')}</Label>
                <p className='text-muted-foreground text-sm'>
                  {t('When disabled, new-api keeps native routing.')}
                </p>
              </div>
              <Switch
                checked={config.enabled}
                onCheckedChange={(enabled) => setPendingEnabled(enabled)}
              />
            </div>
            <div className='space-y-4 rounded-lg border p-4'>
              <div className='flex items-center justify-between gap-4'>
                <div>
                  <Label>{t('Emergency native routing')}</Label>
                  <p className='text-muted-foreground text-sm'>
                    {t(
                      'When Scheduler has a transient outage, enforced traffic may temporarily use native Priority/Weight routing.'
                    )}
                  </p>
                </div>
                <Switch
                  checked={config.emergency_native_routing}
                  onCheckedChange={(emergency_native_routing) =>
                    setConfig({ ...config, emergency_native_routing })
                  }
                />
              </div>
              <p className='text-muted-foreground text-sm'>
                {config.emergency_local_switch
                  ? t('The local process switch is enabled.')
                  : t(
                      'The local process switch is disabled. Set SCHEDULER_EMERGENCY_NATIVE_ROUTING=true and restart new-api before this option can take effect.'
                    )}
              </p>
              <div className='grid gap-4 sm:grid-cols-2'>
                <div className='space-y-2'>
                  <Label>{t('Maximum emergency duration (seconds)')}</Label>
                  <Input
                    type='number'
                    min={1}
                    max={86400}
                    value={config.emergency_max_duration_seconds}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        emergency_max_duration_seconds: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className='space-y-2'>
                  <Label>{t('Allowed groups')}</Label>
                  <Input
                    placeholder={t('Comma-separated; blank allows all groups')}
                    value={config.emergency_groups}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        emergency_groups: e.target.value,
                      })
                    }
                  />
                </div>
                <div className='space-y-2 sm:col-span-2'>
                  <Label>{t('Allowed models')}</Label>
                  <Input
                    placeholder={t('Comma-separated; blank allows all models')}
                    value={config.emergency_models}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        emergency_models: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </div>
            <div className='border-destructive/50 flex items-center justify-between rounded-lg border p-4'>
              <div>
                <Label>{t('Scheduler kill switch')}</Label>
                <p className='text-muted-foreground text-sm'>
                  {t(
                    'Immediately stop new Scheduler decisions and use native routing. In-flight Scheduler reservations continue to be released.'
                  )}
                </p>
              </div>
              <Switch
                checked={config.kill_switch}
                onCheckedChange={(kill_switch) =>
                  setConfig({ ...config, kill_switch })
                }
              />
            </div>
            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='space-y-2 sm:col-span-2'>
                <Label>{t('Scheduler bootstrap list')}</Label>
                <Input value={config.bootstrap_urls} readOnly />
                <p className='text-muted-foreground text-sm'>
                  {t('Local Scheduler: ')}
                  {config.local_url || t('not configured')}
                </p>
              </div>
              <div className='space-y-2'>
                <Label>{t('Mode')}</Label>
                <Select
                  value={config.mode}
                  onValueChange={(mode) => {
                    if (mode) setConfig({ ...config, mode })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='shadow'>{t('Shadow')}</SelectItem>
                    <SelectItem value='enforced'>{t('Enforced')}</SelectItem>
                    <SelectItem value='canary'>{t('Canary')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {config.mode === 'canary' && (
                <>
                  <div className='space-y-2'>
                    <Label>{t('Canary percentage')}</Label>
                    <Input
                      type='number'
                      min={0}
                      max={100}
                      value={config.canary_percent}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          canary_percent: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className='space-y-2'>
                    <Label>{t('Canary salt')}</Label>
                    <Input
                      value={config.canary_salt}
                      onChange={(e) =>
                        setConfig({ ...config, canary_salt: e.target.value })
                      }
                    />
                  </div>
                </>
              )}
              <div className='space-y-2'>
                <Label>{t('Shadow timeout (ms)')}</Label>
                <Input
                  type='number'
                  min={1}
                  value={config.shadow_timeout_ms}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      shadow_timeout_ms: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className='space-y-2'>
                <Label>{t('Runtime Redis prefix')}</Label>
                <Input
                  value={config.runtime_prefix}
                  onChange={(e) =>
                    setConfig({ ...config, runtime_prefix: e.target.value })
                  }
                />
              </div>
              <div className='space-y-2'>
                <Label>{t('Runtime soft watermark')}</Label>
                <Input
                  type='number'
                  min={0.5}
                  max={0.99}
                  step={0.05}
                  value={config.runtime_high_watermark}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      runtime_high_watermark: Number(e.target.value),
                    })
                  }
                  onBlur={() =>
                    setConfig({
                      ...config,
                      runtime_high_watermark: clampRuntimeHighWatermark(
                        config.runtime_high_watermark
                      ),
                    })
                  }
                />
                <p className='text-muted-foreground text-sm'>
                  {t(
                    'Endpoints at or above this load ratio are demoted before lower-load endpoints. Hard capacity remains 100%.'
                  )}
                </p>
              </div>
            </div>
            <div className='space-y-3 rounded-lg border p-4'>
              <div>
                <Label>{t('Sensitive credentials')}</Label>
                <p className='text-muted-foreground text-sm'>
                  {t(
                    'Existing values are never displayed. Leave blank to keep the current value.'
                  )}
                </p>
              </div>
              <div className='space-y-2'>
                <Label htmlFor='scheduler-access-token'>
                  {t('Scheduler access token')}
                </Label>
                <p className='text-muted-foreground text-sm'>
                  {t(
                    'Bearer token shared by Scheduler service and management APIs (/v1 and /admin).'
                  )}
                </p>
                <Input
                  id='scheduler-access-token'
                  type='password'
                  placeholder={
                    config.token_set
                      ? t('Scheduler access token configured')
                      : t('Scheduler access token')
                  }
                  value={schedulerToken}
                  onChange={(e) => setSchedulerToken(e.target.value)}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='scheduler-hmac-secret'>
                  {t('HMAC secret')}
                </Label>
                <p className='text-muted-foreground text-sm'>
                  {t(
                    'Optional shared secret for signing Scheduler service requests.'
                  )}
                </p>
                <Input
                  id='scheduler-hmac-secret'
                  type='password'
                  placeholder={
                    config.signing_secret_set
                      ? t('HMAC secret configured')
                      : t('HMAC secret')
                  }
                  value={signingSecret}
                  onChange={(e) => setSigningSecret(e.target.value)}
                />
              </div>
            </div>
            <div className='flex justify-end gap-2'>
              <Button
                variant='outline'
                onClick={() =>
                  void testSchedulerConnection()
                    .then((r) =>
                      r.success
                        ? toast.success(t('Scheduler connection is healthy'))
                        : toast.error(r.message || t('Connection failed'))
                    )
                    .catch(() => toast.error(t('Connection failed')))
                }
              >
                {t('Test connection')}
              </Button>
              <Button disabled={saving} onClick={() => void save()}>
                {saving ? t('Saving...') : t('Save')}
              </Button>
            </div>
          </CardContent>
        </Card>
        <AlertDialog
          open={pendingEnabled !== null}
          onOpenChange={(open) => {
            if (!open) setPendingEnabled(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {pendingEnabled
                  ? t('Confirm enabling Scheduler')
                  : t('Confirm disabling Scheduler')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {pendingEnabled
                  ? t(
                      'Scheduler will be used according to the selected mode after saving.'
                    )
                  : t(
                      'new-api will stop calling Scheduler and fall back to native routing after saving.'
                    )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (pendingEnabled !== null) {
                    setConfig({ ...config, enabled: pendingEnabled })
                  }
                  setPendingEnabled(null)
                }}
              >
                {t('Confirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Main>
  )
}
