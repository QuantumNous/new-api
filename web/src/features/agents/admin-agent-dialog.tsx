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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { drawingErrorMessage } from '@/features/ai-drawing/api'

import { getAdminAgent, saveAdminAgent, type AgentProfile } from './api'
import { priceCents } from './money'

function AgentSettings(props: { profile: AgentProfile; onSaved: () => void }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [enabled, setEnabled] = useState(props.profile.enabled)
  const [price, setPrice] = useState(
    (props.profile.price_cents / 100).toFixed(2)
  )
  const [busy, setBusy] = useState(false)
  const cents = priceCents(price)
  const save = async () => {
    if (cents === null) return
    setBusy(true)
    try {
      await saveAdminAgent({ ...props.profile, enabled, price_cents: cents })
      await Promise.all([
        client.invalidateQueries({
          queryKey: ['admin-agent', props.profile.user_id],
        }),
        client.invalidateQueries({ queryKey: ['agent-self'] }),
        client.invalidateQueries({ queryKey: ['agent-customer-price'] }),
      ])
      props.onSaved()
      toast.success(t('Agent settings saved'))
    } catch (error) {
      toast.error(t(drawingErrorMessage(error, 'Request failed')))
      await client.invalidateQueries({
        queryKey: ['admin-agent', props.profile.user_id],
      })
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className='grid gap-4'>
      <div className='flex items-center justify-between'>
        <Label htmlFor='agent-enabled'>{t('Enable agent access')}</Label>
        <Switch
          id='agent-enabled'
          checked={enabled}
          onCheckedChange={setEnabled}
          disabled={busy}
        />
      </div>
      <div className='grid gap-2'>
        <Label htmlFor='agent-admin-price'>
          gpt-image-2 · {t('CNY per image')}
        </Label>
        <Input
          id='agent-admin-price'
          type='number'
          min='0.02'
          max='0.06'
          step='0.01'
          value={price}
          disabled={busy}
          onChange={(event) => setPrice(event.target.value)}
        />
        <p className='text-muted-foreground text-xs'>
          {t(
            'This price applies to the agent personally and initially to historical customers. Generated links keep their own prices.'
          )}
        </p>
      </div>
      <Button disabled={busy || cents === null} onClick={save}>
        {t('Save')}
      </Button>
    </div>
  )
}
export function AdminAgentDialog(props: {
  userId: number
  username: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: ['admin-agent', props.userId],
    queryFn: () => getAdminAgent(props.userId),
    enabled: props.open,
  })
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {props.username} · {t('Agent access')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'Enabling includes all existing direct invitees. This does not grant administrator permissions.'
            )}
          </DialogDescription>
        </DialogHeader>
        {query.isLoading && <p>{t('Loading')}</p>}
        {query.error && <p>{t('Unable to load agent data')}</p>}
        {query.data && (
          <AgentSettings
            key={`${query.data.version}:${props.open}`}
            profile={query.data}
            onSaved={() => props.onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
