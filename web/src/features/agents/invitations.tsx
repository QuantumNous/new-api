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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { drawingErrorMessage } from '@/features/ai-drawing/api'

import {
  createAgentInvitation,
  getAgentInvitations,
  type AgentInvitation,
  type AgentProfile,
} from './api'
import { priceCents } from './money'

export function AgentInvitations(props: { profile: AgentProfile }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [price, setPrice] = useState(
    (props.profile.price_cents / 100).toFixed(2)
  )
  const key = ['agent-invitations', props.profile.user_id]
  const query = useQuery({
    queryKey: key,
    queryFn: getAgentInvitations,
    refetchInterval: 30000,
  })
  const cents = priceCents(price)
  const create = useMutation({
    mutationFn: createAgentInvitation,
    onSuccess: (link) => {
      client.setQueryData<AgentInvitation[]>(key, (previous) => [
        link,
        ...(previous ?? []).filter((item) => item.token !== link.token),
      ])
      toast.success(t('Registration link created'))
    },
    onError: (error) =>
      toast.error(t(drawingErrorMessage(error, 'Request failed'))),
  })
  const copy = async (link: AgentInvitation) => {
    if (Date.now() >= link.expires_at * 1000) {
      toast.error(
        t(
          'Registration link is invalid or expired. Ask your agent for a new link.'
        )
      )
      await client.invalidateQueries({ queryKey: key })
      return
    }
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/sign-up?invite=${link.token}`
      )
      toast.success(t('Copied'))
    } catch {
      toast.error(t('Copy failed'))
    }
  }
  return (
    <div className='grid gap-4 md:grid-cols-2'>
      <Card className='min-w-0'>
        <CardHeader>
          <CardTitle>{t('My registration links')}</CardTitle>
        </CardHeader>
        <CardContent className='grid gap-3'>
          <p className='text-muted-foreground text-xs'>
            {t(
              'Links are valid for 2 hours. Registered customers keep the price from their link.'
            )}
          </p>
          {query.isLoading && <p>{t('Loading')}</p>}
          {query.error && <p role='alert'>{t('Unable to load agent data')}</p>}
          {query.data?.length === 0 && (
            <p className='text-muted-foreground py-3 text-sm'>
              {t('Set a price and generate a registration link.')}
            </p>
          )}
          <div className='grid max-h-56 gap-3 overflow-y-auto'>
            {query.data?.map((link) => (
              <div key={link.token} className='grid gap-1.5'>
                <div className='flex flex-wrap justify-between gap-1 text-xs'>
                  <span className='font-medium'>
                    ¥{(link.price_cents / 100).toFixed(2)} / {t('Image unit')}
                  </span>
                  <span className='text-muted-foreground'>
                    {t('Valid until')}{' '}
                    {new Date(link.expires_at * 1000).toLocaleTimeString()}
                  </span>
                </div>
                <div className='flex gap-2'>
                  <Input
                    aria-label={`${t('My registration link')} ¥${(link.price_cents / 100).toFixed(2)}`}
                    className='min-w-0'
                    readOnly
                    value={`${window.location.origin}/sign-up?invite=${link.token}`}
                  />
                  <Button onClick={() => void copy(link)}>{t('Copy')}</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('Customer image price')}</CardTitle>
        </CardHeader>
        <CardContent className='grid gap-3'>
          <Label htmlFor='agent-image-price'>
            gpt-image-2 · {t('CNY per image')}
          </Label>
          <div className='flex flex-wrap gap-2'>
            <Input
              className='min-w-24 flex-1'
              id='agent-image-price'
              type='number'
              min='0.02'
              max='0.06'
              step='0.01'
              value={price}
              disabled={create.isPending}
              onChange={(event) => setPrice(event.target.value)}
            />
            <Button
              disabled={create.isPending || cents === null}
              onClick={() => {
                if (cents !== null) create.mutate(cents)
              }}
            >
              {t('Generate link')}
            </Button>
          </div>
          <p className='text-muted-foreground text-xs'>
            {t(
              'New links use this price. Existing links and customers are not changed.'
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
