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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'

import {
  getStatusPageSettings,
  updateStatusPageSettings,
} from './api'
import type { StatusPageGroupConfig, StatusPageSettingsPayload } from './types'

const DEFAULT_PAYLOAD: StatusPageSettingsPayload = {
  enabled: false,
  refresh_seconds: 60,
  degraded_latency_ms: 5000,
  enable_ping_probe: true,
  ping_probe_timeout_ms: 3000,
  groups: [],
  available_groups: [],
}

export function StatusPageAdminSettings() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['status-page-settings'],
    queryFn: async () => {
      // Sanity check via raw fetch (bypasses axios interceptors entirely).
      try {
        const rawRes = await fetch('/api/status/settings', {
          method: 'GET',
          credentials: 'include',
        })
        const rawBody = await rawRes.text()
        // eslint-disable-next-line no-console
        console.log('[status-page-settings raw-fetch]', {
          status: rawRes.status,
          statusText: rawRes.statusText,
          url: rawRes.url,
          body: rawBody.slice(0, 500),
        })
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[status-page-settings raw-fetch] threw', e)
      }
      try {
        const data = await getStatusPageSettings()
        // eslint-disable-next-line no-console
        console.log('[status-page-settings axios] success', data)
        return data
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[status-page-settings axios] failed', {
          message: (e as Error)?.message,
          responseStatus: (e as { response?: { status?: number } })?.response
            ?.status,
          responseData: (e as { response?: { data?: unknown } })?.response?.data,
          configUrl: (e as { config?: { url?: string } })?.config?.url,
          configBaseURL: (e as { config?: { baseURL?: string } })?.config
            ?.baseURL,
        })
        throw e
      }
    },
    retry: false,
  })

  const [form, setForm] = useState<StatusPageSettingsPayload>(DEFAULT_PAYLOAD)

  useEffect(() => {
    if (query.data) {
      setForm(query.data)
    }
  }, [query.data])

  const mutation = useMutation({
    mutationFn: updateStatusPageSettings,
    onSuccess: (data) => {
      setForm(data)
      queryClient.invalidateQueries({ queryKey: ['status-page-settings'] })
      queryClient.invalidateQueries({ queryKey: ['status-cards'] })
      toast.success(t('Saved'))
    },
    onError: (err: Error) => {
      toast.error(err.message || t('Save failed'))
    },
  })

  const availableGroups = useMemo(() => {
    const set = new Map<string, StatusPageGroupConfig>()
    for (const g of form.groups) {
      set.set(g.group.toLowerCase(), g)
    }
    const groupList: StatusPageGroupConfig[] = form.groups.map((g) => ({ ...g }))
    for (const name of form.available_groups ?? []) {
      const key = name.toLowerCase()
      if (!set.has(key)) {
        groupList.push({
          group: name,
          enabled: false,
          display_name: '',
          provider: '',
          display_model: '',
        })
        set.set(key, groupList[groupList.length - 1])
      }
    }
    return groupList
  }, [form.groups, form.available_groups])

  const updateGroup = (
    groupName: string,
    patch: Partial<StatusPageGroupConfig>
  ) => {
    setForm((prev) => {
      const key = groupName.toLowerCase()
      const existing = prev.groups.find(
        (g) => g.group.toLowerCase() === key
      )
      let nextGroups: StatusPageGroupConfig[]
      if (existing) {
        nextGroups = prev.groups.map((g) =>
          g.group.toLowerCase() === key ? { ...g, ...patch } : g
        )
      } else {
        nextGroups = [
          ...prev.groups,
          {
            group: groupName,
            enabled: false,
            display_name: '',
            provider: '',
            display_model: '',
            ...patch,
          },
        ]
      }
      return { ...prev, groups: nextGroups }
    })
  }

  const handleSave = () => {
    // 仅保留已勾选的分组，避免持久化空数据
    const cleaned: StatusPageSettingsPayload = {
      ...form,
      groups: form.groups
        .filter((g) => g.group.trim() !== '')
        .map((g) => ({
          group: g.group.trim(),
          enabled: g.enabled,
          display_name: g.display_name?.trim() ?? '',
          provider: g.provider?.trim() ?? '',
          display_model: g.display_model?.trim() ?? '',
        })),
    }
    mutation.mutate(cleaned)
  }

  if (query.isLoading) {
    return (
      <div className='space-y-4'>
        <Skeleton className='h-32 w-full' />
        <Skeleton className='h-64 w-full' />
      </div>
    )
  }

  if (query.isError) {
    const err = query.error as (Error & {
      response?: { status?: number; config?: { url?: string; baseURL?: string } }
      config?: { url?: string; baseURL?: string }
    })
    const status = err?.response?.status
    const cfg = err?.response?.config || err?.config
    const failedUrl =
      (cfg?.baseURL ? cfg.baseURL : '') + (cfg?.url ?? '')
    return (
      <Card>
        <CardContent className='py-8 text-center text-sm'>
          <div className='text-destructive font-medium'>
            {t('无法加载状态页设置')}
          </div>
          <div className='text-muted-foreground mt-2'>{err?.message}</div>
          <div className='text-muted-foreground mt-1 text-xs font-mono'>
            status={String(status ?? 'n/a')} url={failedUrl || 'n/a'}
          </div>
          <Button
            variant='outline'
            size='sm'
            className='mt-4'
            onClick={() => query.refetch()}
          >
            {t('Retry')}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle>{t('状态页设置')}</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div>
              <Label>{t('启用状态页')}</Label>
              <p className='text-muted-foreground mt-1 text-xs'>
                {t('启用后登录用户可访问 /status')}
              </p>
            </div>
            <Switch
              checked={form.enabled}
              onCheckedChange={(v) =>
                setForm((prev) => ({ ...prev, enabled: v }))
              }
            />
          </div>

          <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
            <div className='space-y-1'>
              <Label>{t('刷新间隔（秒）')}</Label>
              <Input
                type='number'
                min={10}
                max={600}
                value={form.refresh_seconds}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    refresh_seconds: Number(e.target.value) || 60,
                  }))
                }
              />
            </div>
            <div className='space-y-1'>
              <Label>{t('降级延迟阈值（毫秒）')}</Label>
              <Input
                type='number'
                min={100}
                value={form.degraded_latency_ms}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    degraded_latency_ms: Number(e.target.value) || 5000,
                  }))
                }
              />
            </div>
            <div className='space-y-1'>
              <Label>{t('PING 探测超时（毫秒）')}</Label>
              <Input
                type='number'
                min={500}
                max={15000}
                value={form.ping_probe_timeout_ms}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    ping_probe_timeout_ms: Number(e.target.value) || 3000,
                  }))
                }
                disabled={!form.enable_ping_probe}
              />
            </div>
          </div>

          <div className='flex items-center justify-between'>
            <div>
              <Label>{t('启用端点 PING 探测')}</Label>
              <p className='text-muted-foreground mt-1 text-xs'>
                {t('渠道测试前对 BaseURL 做一次短超时 TCP 拨号')}
              </p>
            </div>
            <Switch
              checked={form.enable_ping_probe}
              onCheckedChange={(v) =>
                setForm((prev) => ({ ...prev, enable_ping_probe: v }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('展示分组')}</CardTitle>
        </CardHeader>
        <CardContent>
          {availableGroups.length === 0 ? (
            <div className='text-muted-foreground space-y-2 py-6 text-center text-sm'>
              <div>{t('暂无可选分组')}</div>
              <div className='text-xs'>
                {t('分组来源于：1) 渠道管理里各渠道的 Group 字段；2) 系统设置 · 分组倍率里配置的分组')}
              </div>
              <div className='text-xs opacity-70'>
                {t('如果确认已经配置了分组仍然为空，请刷新一次页面。')}
              </div>
            </div>
          ) : (
            <div className='space-y-2'>
              <div className='text-muted-foreground grid grid-cols-[auto_1.5fr_1fr_1fr_1fr] gap-3 border-b pb-2 text-xs sm:grid-cols-[auto_1.5fr_1fr_1fr_1fr]'>
                <div>{t('启用')}</div>
                <div>{t('分组名 / 展示名')}</div>
                <div>{t('厂商')}</div>
                <div>{t('展示模型')}</div>
                <div />
              </div>
              {availableGroups.map((g) => (
                <div
                  key={g.group}
                  className='grid grid-cols-[auto_1.5fr_1fr_1fr_1fr] items-center gap-3 border-b py-2 last:border-b-0'
                >
                  <Checkbox
                    checked={g.enabled}
                    onCheckedChange={(v) =>
                      updateGroup(g.group, { enabled: Boolean(v) })
                    }
                  />
                  <div className='space-y-1'>
                    <div className='text-xs font-mono'>{g.group}</div>
                    <Input
                      value={g.display_name}
                      onChange={(e) =>
                        updateGroup(g.group, { display_name: e.target.value })
                      }
                      placeholder={t('展示名（可选）')}
                    />
                  </div>
                  <Input
                    value={g.provider}
                    onChange={(e) =>
                      updateGroup(g.group, { provider: e.target.value })
                    }
                    placeholder={t('如 OpenAI')}
                  />
                  <Input
                    value={g.display_model}
                    onChange={(e) =>
                      updateGroup(g.group, { display_model: e.target.value })
                    }
                    placeholder={t('如 gpt-4o')}
                  />
                  <div />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className='flex justify-end gap-2'>
        <Button
          onClick={handleSave}
          disabled={mutation.isPending || query.isLoading}
        >
          {mutation.isPending ? t('Saving...') : t('Save')}
        </Button>
      </div>
    </div>
  )
}
