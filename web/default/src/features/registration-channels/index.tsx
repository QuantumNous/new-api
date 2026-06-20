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
import { Copy, Pencil, Plus, RefreshCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { SectionPageLayout } from '@/components/layout'

type RegistrationChannel = {
  id: string
  code: string
  name: string
  description: string
  landing_path: string
  enabled: boolean
  created_by: string
  created_at: string
  updated_at: string
  registered_count: number
  paying_count: number
  topup_amount: number
}

type ChannelForm = {
  code: string
  name: string
  description: string
  landing_path: string
  enabled: boolean
}

const emptyForm: ChannelForm = {
  code: '',
  name: '',
  description: '',
  landing_path: '/register',
  enabled: true,
}

const normalizeCode = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, '-')

const buildChannelUrl = (channel: RegistrationChannel) => {
  const base = typeof window === 'undefined' ? '' : window.location.origin
  const landingPath = channel.landing_path || '/register'
  const sep = landingPath.includes('?') ? '&' : '?'
  return `${base}${landingPath}${sep}ch=${encodeURIComponent(channel.code)}`
}

export function RegistrationChannels() {
  const { t } = useTranslation()
  const [channels, setChannels] = useState<RegistrationChannel[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<RegistrationChannel | null>(null)
  const [form, setForm] = useState<ChannelForm>(emptyForm)

  const activeCount = useMemo(
    () => channels.filter((channel) => channel.enabled).length,
    [channels]
  )

  const fetchChannels = async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/admin/registration-channels')
      if (res.data?.success) {
        setChannels(res.data.data?.items ?? [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchChannels()
  }, [])

  const openCreateDialog = () => {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEditDialog = (channel: RegistrationChannel) => {
    setEditing(channel)
    setForm({
      code: channel.code,
      name: channel.name,
      description: channel.description || '',
      landing_path: channel.landing_path || '/register',
      enabled: channel.enabled,
    })
    setDialogOpen(true)
  }

  const copyChannelUrl = async (channel: RegistrationChannel) => {
    await navigator.clipboard.writeText(buildChannelUrl(channel))
    toast.success(t('Copied'))
  }

  const submitForm = async () => {
    const payload = {
      ...form,
      code: normalizeCode(form.code),
      landing_path: form.landing_path.trim() || '/register',
    }
    if (!payload.code || !payload.name.trim()) {
      toast.error(t('Please complete required fields'))
      return
    }

    setSaving(true)
    try {
      const res = await api.post('/api/admin/registration-channels', payload)
      if (res.data?.success) {
        toast.success(
          t(editing ? 'Updated successfully' : 'Created successfully')
        )
        setDialogOpen(false)
        await fetchChannels()
      }
    } finally {
      setSaving(false)
    }
  }

  const toggleChannel = async (channel: RegistrationChannel) => {
    const nextEnabled = !channel.enabled
    const previous = channels
    setChannels(
      channels.map((item) =>
        item.code === channel.code ? { ...item, enabled: nextEnabled } : item
      )
    )
    try {
      const res = await api.patch('/api/admin/registration-channels/status', {
        code: channel.code,
        enabled: nextEnabled,
      })
      if (res.data?.success) {
        toast.success(t('Updated successfully'))
      } else {
        setChannels(previous)
      }
    } catch {
      setChannels(previous)
    }
  }

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>
          {t('Registration Channels')}
        </SectionPageLayout.Title>
        <SectionPageLayout.Description>
          {t(
            'Create channel-coded registration links and review user sources.'
          )}
        </SectionPageLayout.Description>
        <SectionPageLayout.Actions>
          <div className='flex items-center gap-2'>
            <Button
              variant='outline'
              onClick={fetchChannels}
              disabled={loading}
            >
              <RefreshCcw className={cn(loading && 'animate-spin')} />
              {t('Refresh')}
            </Button>
            <Button onClick={openCreateDialog}>
              <Plus />
              {t('New Channel')}
            </Button>
          </div>
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <div className='mb-3 flex flex-wrap items-center gap-2 text-sm'>
            <Badge variant='secondary'>
              {t('Total')}: {channels.length}
            </Badge>
            <Badge variant='outline'>
              {t('Enabled')}: {activeCount}
            </Badge>
          </div>
          <div className='rounded-lg border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Channel')}</TableHead>
                  <TableHead>{t('Registration Link')}</TableHead>
                  <TableHead>{t('Registered Users')}</TableHead>
                  <TableHead>{t('Paying Users')}</TableHead>
                  <TableHead>{t('Topup Amount (USD)')}</TableHead>
                  <TableHead>{t('Status')}</TableHead>
                  <TableHead className='text-right'>{t('Actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className='text-muted-foreground h-24 text-center'
                    >
                      {loading ? t('Loading...') : t('No data')}
                    </TableCell>
                  </TableRow>
                )}
                {channels.map((channel) => (
                  <TableRow key={channel.code}>
                    <TableCell>
                      <div className='flex min-w-[180px] flex-col gap-1'>
                        <div className='font-medium'>{channel.name}</div>
                        <code className='text-muted-foreground text-xs'>
                          {channel.code}
                        </code>
                        {channel.description && (
                          <div className='text-muted-foreground max-w-[260px] truncate text-xs'>
                            {channel.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {channel.id ? (
                        <div className='flex max-w-[360px] items-center gap-2'>
                          <code className='bg-muted min-w-0 truncate rounded px-2 py-1 text-xs'>
                            {buildChannelUrl(channel)}
                          </code>
                          <Button
                            variant='ghost'
                            size='icon-sm'
                            onClick={() => copyChannelUrl(channel)}
                            aria-label={t('Copy')}
                          >
                            <Copy />
                          </Button>
                        </div>
                      ) : (
                        <span className='text-muted-foreground text-xs'>
                          {t('Auto-detected')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{channel.registered_count}</TableCell>
                    <TableCell>{channel.paying_count}</TableCell>
                    <TableCell>
                      {channel.topup_amount > 0
                        ? `$${channel.topup_amount}`
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {channel.id ? (
                        <div className='flex items-center gap-2'>
                          <Switch
                            checked={channel.enabled}
                            onCheckedChange={() => toggleChannel(channel)}
                          />
                          <span className='text-sm'>
                            {channel.enabled ? t('Enabled') : t('Disabled')}
                          </span>
                        </div>
                      ) : (
                        <Badge variant='secondary'>{t('Auto')}</Badge>
                      )}
                    </TableCell>
                    <TableCell className='text-right'>
                      {channel.id ? (
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() => openEditDialog(channel)}
                        >
                          <Pencil />
                          {t('Edit')}
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>
              {editing ? t('Edit Channel') : t('New Channel')}
            </DialogTitle>
            <DialogDescription>
              {t(
                'Use a stable code so existing registration links keep working.'
              )}
            </DialogDescription>
          </DialogHeader>
          <div className='grid gap-4'>
            <div className='grid gap-2'>
              <Label htmlFor='registration-channel-code'>
                {t('Channel Code')}
              </Label>
              <Input
                id='registration-channel-code'
                value={form.code}
                disabled={Boolean(editing)}
                placeholder='google_ads'
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    code: normalizeCode(event.target.value),
                  }))
                }
              />
            </div>
            <div className='grid gap-2'>
              <Label htmlFor='registration-channel-name'>
                {t('Channel Name')}
              </Label>
              <Input
                id='registration-channel-name'
                value={form.name}
                placeholder={t('Channel Name')}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </div>
            <div className='grid gap-2'>
              <Label htmlFor='registration-channel-path'>
                {t('Landing Path')}
              </Label>
              <Input
                id='registration-channel-path'
                value={form.landing_path}
                placeholder='/register'
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    landing_path: event.target.value,
                  }))
                }
              />
            </div>
            <div className='grid gap-2'>
              <Label htmlFor='registration-channel-description'>
                {t('Description')}
              </Label>
              <Textarea
                id='registration-channel-description'
                value={form.description}
                rows={3}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </div>
            <label className='flex items-center justify-between rounded-lg border p-3'>
              <span className='font-medium'>{t('Enabled')}</span>
              <Switch
                checked={form.enabled}
                onCheckedChange={(enabled) =>
                  setForm((current) => ({ ...current, enabled }))
                }
              />
            </label>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              {t('Cancel')}
            </Button>
            <Button onClick={submitForm} disabled={saving}>
              {saving ? t('Saving...') : t('Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
