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
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { drawingErrorMessage } from '@/features/ai-drawing/api'

import { setAgentPrice, type AgentProfile } from './api'
import { priceCents } from './money'

export function AgentPriceEditor(props: { profile: AgentProfile }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [price, setPrice] = useState(
    (props.profile.price_cents / 100).toFixed(2)
  )
  const [busy, setBusy] = useState(false)
  const cents = priceCents(price)
  const save = async () => {
    if (cents === null) return
    setBusy(true)
    try {
      await setAgentPrice(cents, props.profile.version)
      await Promise.all([
        client.invalidateQueries({ queryKey: ['agent-self'] }),
        client.invalidateQueries({ queryKey: ['agent-customer-price'] }),
      ])
      toast.success(t('Agent price saved'))
    } catch (error) {
      toast.error(t(drawingErrorMessage(error, 'Request failed')))
      await client.invalidateQueries({ queryKey: ['agent-self'] })
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className='grid gap-3'>
      <Label htmlFor='agent-image-price'>
        gpt-image-2 · {t('CNY per image')}
      </Label>
      <div className='flex gap-2'>
        <Input
          id='agent-image-price'
          type='number'
          min='0.02'
          max='0.06'
          step='0.01'
          value={price}
          disabled={busy}
          onChange={(event) => setPrice(event.target.value)}
        />
        <Button
          disabled={
            busy || cents === null || cents === props.profile.price_cents
          }
          onClick={save}
        >
          {t('Save')}
        </Button>
      </div>
      <p className='text-muted-foreground text-xs'>
        {t(
          'Applies to all your direct customers. Submitted batches keep their original price.'
        )}
      </p>
    </div>
  )
}
