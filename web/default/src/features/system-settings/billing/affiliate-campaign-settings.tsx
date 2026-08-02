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
import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'

import { getAffiliateCampaign, updateAffiliateCampaign } from '../api'
import { SettingsForm } from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import type { AffiliateCampaign } from '../types'

const SECONDS_PER_DAY = 86_400

type CampaignDraft = {
  name: string
  enabled: boolean
  startsAt: string
  endsAt: string
  holdDays: string
}

function timestampToInput(timestamp: number): string {
  if (timestamp <= 0) return ''
  const date = new Date(timestamp * 1000)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function inputToTimestamp(value: string): number {
  if (!value) return 0
  return Math.floor(new Date(value).getTime() / 1000)
}

function campaignToDraft(campaign: AffiliateCampaign): CampaignDraft {
  return {
    name: campaign.name,
    enabled: campaign.enabled,
    startsAt: timestampToInput(campaign.starts_at),
    endsAt: timestampToInput(campaign.ends_at),
    holdDays: String(campaign.hold_seconds / SECONDS_PER_DAY),
  }
}

export function AffiliateCampaignSettings() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['admin', 'affiliate', 'campaign'],
    queryFn: getAffiliateCampaign,
    select: (response) => response.data,
  })
  const [draft, setDraft] = useState<CampaignDraft>()
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!query.data) return
    setDraft(campaignToDraft(query.data))
    setDirty(false)
  }, [query.data])

  const mutation = useMutation({
    mutationFn: updateAffiliateCampaign,
    onSuccess: async (response) => {
      if (!response.success || !response.data) return
      setDraft(campaignToDraft(response.data))
      setDirty(false)
      toast.success(t('Referral campaign saved'))
      await queryClient.invalidateQueries({ queryKey: ['admin', 'affiliate'] })
    },
  })

  function submit(event?: FormEvent) {
    event?.preventDefault()
    if (!draft || !query.data) return
    const startsAt = inputToTimestamp(draft.startsAt)
    const endsAt = inputToTimestamp(draft.endsAt)
    const holdDays = Number(draft.holdDays)
    if (
      !draft.name.trim() ||
      !Number.isInteger(holdDays) ||
      holdDays < 0 ||
      holdDays > 365 ||
      (draft.enabled && (startsAt <= 0 || endsAt <= startsAt))
    ) {
      toast.error(t('Check the campaign dates and try again'))
      return
    }
    mutation.mutate({
      ...query.data,
      name: draft.name.trim(),
      enabled: draft.enabled,
      starts_at: startsAt,
      ends_at: endsAt,
      inviter_cashback_rate_bps: 2500,
      invitee_bonus_rate_bps: 2000,
      hold_seconds: holdDays * SECONDS_PER_DAY,
    })
  }

  if (!draft) return <Spinner className='mx-auto my-12' />

  const update = <K extends keyof CampaignDraft>(
    key: K,
    value: CampaignDraft[K]
  ) => {
    setDraft({ ...draft, [key]: value })
    setDirty(true)
  }

  return (
    <SettingsForm onSubmit={submit} autoComplete='off'>
      <SettingsPageFormActions
        onSave={() => submit()}
        isSaving={mutation.isPending}
        isSaveDisabled={!dirty}
        saveLabel='Save referral campaign'
      />
      <FieldGroup>
        <Field orientation='horizontal'>
          <div>
            <FieldLabel>{t('Enable referral campaign')}</FieldLabel>
            <FieldDescription>
              {t(
                'Only successful online top-ups completed during the campaign are rewarded.'
              )}
            </FieldDescription>
          </div>
          <Switch
            checked={draft.enabled}
            onCheckedChange={(checked) => update('enabled', checked)}
            disabled={mutation.isPending}
          />
        </Field>
        <Field>
          <FieldLabel>{t('Campaign name')}</FieldLabel>
          <InputGroup>
            <InputGroupInput
              value={draft.name}
              maxLength={120}
              onChange={(event) => update('name', event.target.value)}
              disabled={mutation.isPending}
            />
          </InputGroup>
        </Field>
        <div className='grid gap-4 md:grid-cols-2'>
          <Field>
            <FieldLabel>{t('Campaign starts')}</FieldLabel>
            <InputGroup>
              <InputGroupInput
                type='datetime-local'
                value={draft.startsAt}
                onChange={(event) => update('startsAt', event.target.value)}
                disabled={mutation.isPending}
              />
            </InputGroup>
          </Field>
          <Field>
            <FieldLabel>{t('Campaign ends')}</FieldLabel>
            <InputGroup>
              <InputGroupInput
                type='datetime-local'
                value={draft.endsAt}
                onChange={(event) => update('endsAt', event.target.value)}
                disabled={mutation.isPending}
              />
            </InputGroup>
          </Field>
        </div>
        <div className='grid gap-4 md:grid-cols-3'>
          <Field>
            <FieldLabel>{t('Inviter cashback')}</FieldLabel>
            <InputGroup>
              <InputGroupInput value='25' disabled />
              <InputGroupAddon align='inline-end'>
                <InputGroupText>%</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </Field>
          <Field>
            <FieldLabel>{t('Invitee bonus quota')}</FieldLabel>
            <InputGroup>
              <InputGroupInput value='20' disabled />
              <InputGroupAddon align='inline-end'>
                <InputGroupText>%</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </Field>
          <Field>
            <FieldLabel>{t('Cashback hold period')}</FieldLabel>
            <InputGroup>
              <InputGroupInput
                type='number'
                min={0}
                max={365}
                step={1}
                value={draft.holdDays}
                onChange={(event) => update('holdDays', event.target.value)}
                disabled={mutation.isPending}
              />
              <InputGroupAddon align='inline-end'>
                <InputGroupText>{t('days')}</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </Field>
        </div>
      </FieldGroup>
    </SettingsForm>
  )
}
