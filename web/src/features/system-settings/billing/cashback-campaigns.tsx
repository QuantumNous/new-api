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
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { StaticDataTable } from '@/components/data-table'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertDialogCancel } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { handleServerError } from '@/lib/handle-server-error'
import { createServerError } from '@/lib/server-error-message'

import {
  createCashbackCampaign,
  listCashbackCampaigns,
  stopCashbackCampaign,
} from '../api'
import {
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsSection } from '../components/settings-section'
import type { CashbackCampaign } from '../types'

const campaignKey = ['cashback', 'campaigns'] as const

type CampaignValues = {
  start: string
  end: string
  maxRewardsPerUser: number
  firstTopUpOnly: boolean
}

const emptyCampaign: CampaignValues = {
  start: '',
  end: '',
  maxRewardsPerUser: 1,
  firstTopUpOnly: false,
}

export function CashbackCampaigns() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [stopId, setStopId] = useState<number | null>(null)
  const stopStarted = useRef(false)
  const schema = z
    .object({
      start: z.string().min(1, t('Select a campaign start time')),
      end: z.string().min(1, t('Select a campaign end time')),
      maxRewardsPerUser: z.coerce
        .number<number>({ error: t('Enter a valid reward limit') })
        .int(t('Reward limit must be a whole number'))
        .min(1, t('Reward limit must be between 1 and 100000'))
        .max(100000, t('Reward limit must be between 1 and 100000')),
      firstTopUpOnly: z.boolean(),
    })
    .superRefine((values, context) => {
      if (
        values.start &&
        (!Number.isFinite(Date.parse(values.start)) ||
          Date.parse(values.start) < Date.now())
      ) {
        context.addIssue({
          code: 'custom',
          path: ['start'],
          message: t('Campaign start must be in the future'),
        })
      }
      if (
        values.end &&
        (!Number.isFinite(Date.parse(values.end)) ||
          Date.parse(values.end) <= Date.parse(values.start))
      ) {
        context.addIssue({
          code: 'custom',
          path: ['end'],
          message: t('Campaign end must be after the start'),
        })
      }
    })
  const form = useForm<CampaignValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyCampaign,
  })
  const firstTopUpOnly = form.watch('firstTopUpOnly')
  const query = useQuery({
    queryKey: campaignKey,
    queryFn: async () => {
      const response = await listCashbackCampaigns()
      if (!response.success || !response.data) {
        throw new Error(response.message || t('Failed to load campaigns'))
      }
      return response.data
    },
  })
  const create = useMutation({
    mutationFn: createCashbackCampaign,
    meta: { errorToast: false },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: campaignKey })
    },
  })
  const stop = useMutation({
    mutationFn: async (id: number) => {
      const response = await stopCashbackCampaign(id)
      if (!response.success || !response.data) {
        throw createServerError(response, t('Failed to stop campaign'))
      }
      return response.data
    },
    meta: { errorToast: false },
    onSuccess: async (_campaign, id) => {
      setStopId((current) => (current === id ? null : current))
      toast.success(t('Campaign stopped'))
      await queryClient.invalidateQueries({ queryKey: campaignKey })
    },
    onError: (error) => {
      handleServerError(error, t('Failed to stop campaign'))
    },
    onSettled: () => {
      stopStarted.current = false
    },
  })

  async function submit(values: CampaignValues) {
    try {
      const response = await create.mutateAsync({
        start_at: Math.floor(new Date(values.start).getTime() / 1000),
        end_at: Math.floor(new Date(values.end).getTime() / 1000),
        // A first top-up happens once, so the server requires a limit of 1.
        max_rewards_per_user: values.firstTopUpOnly
          ? 1
          : values.maxRewardsPerUser,
        payer_scope: values.firstTopUpOnly ? 'first_top_up' : '',
      })
      if (!response.success || !response.data) {
        throw createServerError(response, t('Failed to create campaign'))
      }
      form.reset(emptyCampaign)
      toast.success(t('Campaign created'))
    } catch (error) {
      handleServerError(error, t('Failed to create campaign'))
    }
  }

  function confirmStop() {
    if (stopId === null || stopStarted.current) return
    stopStarted.current = true
    stop.mutate(stopId)
  }

  const columns = [
    {
      id: 'id',
      header: t('Campaign ID'),
      cell: (row: CashbackCampaign) => `#${row.id}`,
    },
    {
      id: 'window',
      header: t('Campaign window'),
      cell: (row: CashbackCampaign) => (
        <span>
          {dayjs.unix(row.start_at).format('YYYY-MM-DD HH:mm')} –{' '}
          {dayjs.unix(row.end_at).format('YYYY-MM-DD HH:mm')}
        </span>
      ),
    },
    {
      id: 'scope',
      header: t('Eligible orders'),
      cell: (row: CashbackCampaign) =>
        row.payer_scope === 'first_top_up'
          ? t('First top-up only')
          : t('Every top-up'),
    },
    {
      id: 'limit',
      header: t('Rewards per payer'),
      cell: (row: CashbackCampaign) => row.max_rewards_per_user,
    },
    {
      id: 'status',
      header: t('Status'),
      cell: (row: CashbackCampaign) =>
        t({ active: 'Active', planned: 'Planned', ended: 'Ended' }[row.status]),
    },
    {
      id: 'audit',
      header: t('Created by'),
      cell: (row: CashbackCampaign) => `#${row.created_by}`,
    },
    {
      id: 'stop',
      header: t('Early stop'),
      cell: (row: CashbackCampaign) => {
        if (row.stopped_at) {
          return (
            <span>
              {dayjs.unix(row.stopped_at).format('YYYY-MM-DD HH:mm')} · #
              {row.stopped_by}
            </span>
          )
        }
        if (row.status === 'ended') return '—'
        return (
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => setStopId(row.id)}
          >
            {t('Stop campaign')}
          </Button>
        )
      },
    },
  ]

  let campaignContent
  if (query.isPending) {
    campaignContent = (
      <Skeleton aria-label={t('Loading campaigns')} className='h-24 w-full' />
    )
  } else if (query.isError) {
    campaignContent = (
      <Alert variant='destructive'>
        <AlertTitle>{t('Unable to load campaigns')}</AlertTitle>
        <AlertDescription>
          <Button
            type='button'
            variant='outline'
            onClick={() => query.refetch()}
          >
            {t('Retry')}
          </Button>
        </AlertDescription>
      </Alert>
    )
  } else {
    campaignContent = (
      <StaticDataTable
        columns={columns}
        data={query.data}
        getRowKey={(row) => row.id}
        emptyContent={t('No campaigns created yet')}
      />
    )
  }

  return (
    <SettingsSection title={t('Top-up cashback campaigns')}>
      <p className='text-muted-foreground text-sm'>
        {t(
          'Create a bounded campaign explicitly. Only orders placed and paid during its active window can earn payer cashback; stopping it does not change existing rewards.'
        )}
      </p>
      <Form {...form}>
        <form
          noValidate
          onSubmit={form.handleSubmit(submit)}
          className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'
        >
          <FormField
            control={form.control}
            name='firstTopUpOnly'
            render={({ field }) => (
              <SettingsSwitchItem className='sm:col-span-2 lg:col-span-4'>
                <SettingsSwitchContent>
                  <FormLabel>{t('First top-up only')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Only a payer with no earlier successful top-up qualifies, once. A first top-up below every tier still uses it up.'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />
          <FormField
            control={form.control}
            name='start'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Campaign start')}</FormLabel>
                <FormControl>
                  <Input type='datetime-local' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='end'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Campaign end')}</FormLabel>
                <FormControl>
                  <Input type='datetime-local' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='maxRewardsPerUser'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Rewards per payer')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={1}
                    max={100000}
                    step={1}
                    {...field}
                    value={firstTopUpOnly ? 1 : field.value}
                    disabled={firstTopUpOnly}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className='flex items-end'>
            <Button type='submit' disabled={create.isPending}>
              {t('Create campaign')}
            </Button>
          </div>
        </form>
      </Form>
      {campaignContent}
      <ConfirmDialog
        open={stopId !== null}
        onOpenChange={(open) => {
          if (!open) setStopId(null)
        }}
        title={t('Stop campaign early?')}
        desc={t(
          'Unpaid orders will no longer qualify for this campaign. Existing rewards remain unchanged.'
        )}
        confirmText={t('Stop campaign')}
        destructive
        disabled={stop.isPending}
        handleConfirm={confirmStop}
      >
        <AlertDialogCancel
          aria-label={t('Close')}
          variant='ghost'
          size='icon'
          className='absolute top-3 right-3'
        >
          <X aria-hidden='true' />
        </AlertDialogCancel>
      </ConfirmDialog>
    </SettingsSection>
  )
}
