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
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { NativeSelect } from '@/components/ui/native-select'

import {
  createCanvasShare,
  getCanvasShareStatus,
  revokeCanvasShare,
} from '../api'

export function CanvasShareDialog(props: {
  projectId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const [days, setDays] = useState<0 | 7 | 30>(7)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const status = useQuery({
    queryKey: ['canvas-share', props.projectId],
    queryFn: () => getCanvasShareStatus(props.projectId),
    enabled: props.open,
  })
  const issue = async (rotate: boolean) => {
    setBusy(true)
    try {
      const result = await createCanvasShare(props.projectId, days, rotate)
      const nextUrl = `${window.location.origin}/share/canvas/${result.token}`
      setUrl(nextUrl)
      await navigator.clipboard.writeText(nextUrl)
      await status.refetch()
      toast.success(t('Share link copied'))
    } catch {
      toast.error(t('Failed to update sharing'))
    } finally {
      setBusy(false)
    }
  }
  const revoke = async () => {
    setBusy(true)
    try {
      await revokeCanvasShare(props.projectId)
      setUrl('')
      await status.refetch()
      toast.success(t('Share link revoked'))
    } catch {
      toast.error(t('Failed to update sharing'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('Share canvas')}</DialogTitle>
          <DialogDescription>
            {t(
              'Anyone with the link can view this canvas until it expires or is revoked.'
            )}
          </DialogDescription>
        </DialogHeader>
        <label className='space-y-2 text-sm'>
          <span>{t('Expiration')}</span>
          <NativeSelect
            value={String(days)}
            onChange={(event) =>
              setDays(Number(event.target.value) as 0 | 7 | 30)
            }
          >
            <option value='7'>{t('7 days')}</option>
            <option value='30'>{t('30 days')}</option>
            <option value='0'>{t('Never expires')}</option>
          </NativeSelect>
        </label>
        {url ? (
          <div className='bg-muted rounded p-3 text-sm break-all'>{url}</div>
        ) : null}
        {status.data?.active && status.data.expires_at ? (
          <p className='text-muted-foreground text-sm'>
            {t('Expires {{date}}', {
              date: new Date(status.data.expires_at * 1000).toLocaleString(),
            })}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            variant='outline'
            disabled={busy || !status.data?.active}
            onClick={() => void revoke()}
          >
            {t('Revoke')}
          </Button>
          <Button
            variant='outline'
            disabled={busy || !status.data?.active}
            onClick={() => void issue(true)}
          >
            {t('Rotate link')}
          </Button>
          <Button disabled={busy} onClick={() => void issue(false)}>
            {t(status.data?.active ? 'Create new link' : 'Create share link')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
