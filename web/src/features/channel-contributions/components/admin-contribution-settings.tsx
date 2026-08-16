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
import type { TFunction } from 'i18next'
import { Save } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useForm, type UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import * as z from 'zod'

import { MultiSelect } from '@/components/multi-select'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { Textarea } from '@/components/ui/textarea'

import {
  getChannelContributionAdminSettings,
  updateChannelContributionAdminSettings,
} from '../api'

function createSettingsSchema(t: TFunction) {
  const integerMessage = t('Enter a whole number within the allowed range')
  return z.object({
    tag: z
      .string()
      .trim()
      .min(1, t('Channel tag is required'))
      .max(64, t('Channel tag must not exceed 64 characters')),
    allowed_groups: z
      .array(z.string().trim().min(1))
      .min(1, t('Select at least one allowed group')),
    allowed_channel_types: z
      .array(z.number().int().positive())
      .min(1, t('Select at least one allowed channel type')),
    priority: z
      .number()
      .int(integerMessage)
      .min(0, integerMessage)
      .max(2_147_483_647, integerMessage),
    weight: z
      .number()
      .int(integerMessage)
      .min(0, integerMessage)
      .max(2_147_483_647, integerMessage),
    health_check_interval_minutes: z
      .number()
      .int(integerMessage)
      .min(1, integerMessage)
      .max(10_080, integerMessage),
    unavailable_delete_hours: z
      .number()
      .int(integerMessage)
      .min(1, integerMessage)
      .max(8_760, integerMessage),
    reward_bps: z
      .number()
      .int(integerMessage)
      .min(0, integerMessage)
      .max(10_000, integerMessage),
    agreement_version: z
      .string()
      .trim()
      .min(1, t('Agreement version is required'))
      .max(64, t('Agreement version must not exceed 64 characters')),
    agreement_content: z
      .string()
      .trim()
      .min(1, t('Agreement content is required')),
  })
}

type SettingsFormValues = z.infer<ReturnType<typeof createSettingsSchema>>

function NumberSetting(props: {
  form: UseFormReturn<SettingsFormValues>
  name:
    | 'priority'
    | 'weight'
    | 'health_check_interval_minutes'
    | 'unavailable_delete_hours'
    | 'reward_bps'
  label: string
  description: string
  min: number
  max: number
}) {
  return (
    <FormField
      control={props.form.control}
      name={props.name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{props.label}</FormLabel>
          <FormControl>
            <Input
              type='number'
              min={props.min}
              max={props.max}
              step={1}
              value={field.value ?? ''}
              onChange={(event) =>
                field.onChange(
                  event.target.value === ''
                    ? undefined
                    : event.target.valueAsNumber
                )
              }
            />
          </FormControl>
          <FormDescription>{props.description}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export function AdminContributionSettings() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const settingsSchema = useMemo(() => createSettingsSchema(t), [t])
  const settingsQuery = useQuery({
    queryKey: ['channel-contributions', 'admin', 'settings'],
    queryFn: async () => {
      const response = await getChannelContributionAdminSettings()
      if (!response.success || !response.data) {
        throw new Error(
          response.message || t('Failed to load contribution settings')
        )
      }
      return response.data
    },
  })
  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      tag: 'donate',
      allowed_groups: [],
      allowed_channel_types: [],
      priority: 100,
      weight: 0,
      health_check_interval_minutes: 10,
      unavailable_delete_hours: 48,
      reward_bps: 0,
      agreement_version: '',
      agreement_content: '',
    },
  })

  useEffect(() => {
    if (settingsQuery.data) form.reset(settingsQuery.data)
  }, [form, settingsQuery.data])

  const updateMutation = useMutation({
    mutationFn: updateChannelContributionAdminSettings,
  })
  const handleSubmit = async (values: SettingsFormValues) => {
    try {
      const response = await updateMutation.mutateAsync(values)
      if (!response.success || !response.data) {
        toast.error(
          response.message || t('Failed to save contribution settings')
        )
        return
      }
      form.reset(response.data)
      await queryClient.invalidateQueries({
        queryKey: ['channel-contributions'],
      })
      toast.success(t('Contribution settings saved'))
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('Failed to save contribution settings')
      )
    }
  }

  const typeOptions = (settingsQuery.data?.supported_channel_types ?? []).map(
    (option) => ({
      label: t(option.label),
      value: String(option.value),
    })
  )

  if (settingsQuery.isLoading) {
    return (
      <div className='text-muted-foreground flex min-h-64 items-center justify-center text-sm'>
        {t('Loading...')}
      </div>
    )
  }
  if (settingsQuery.error) {
    return (
      <p className='text-destructive py-12 text-center text-sm'>
        {settingsQuery.error instanceof Error
          ? settingsQuery.error.message
          : t('Failed to load contribution settings')}
      </p>
    )
  }

  return (
    <Card className='gap-0 py-0'>
      <CardHeader className='border-b py-4'>
        <CardTitle>{t('Channel contribution settings')}</CardTitle>
        <CardDescription>
          {t(
            'Control eligibility, routing defaults, health removal, rewards, and the agreement.'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className='py-5'>
        <Form {...form}>
          <form
            className='space-y-7'
            onSubmit={form.handleSubmit(handleSubmit)}
          >
            <section className='space-y-4'>
              <div className='grid gap-4 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='tag'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Approved channel tag')}</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder='donate' />
                      </FormControl>
                      <FormDescription>
                        {t(
                          'Applied automatically when a contribution is approved.'
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='agreement_version'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Agreement version')}</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder='2026-08-16' />
                      </FormControl>
                      <FormDescription>
                        {t(
                          'Changing the version requires acceptance on the next submission.'
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <section className='space-y-4 border-t pt-6'>
              <div>
                <h3 className='text-sm font-semibold'>
                  {t('Contribution eligibility')}
                </h3>
                <p className='text-muted-foreground text-sm'>
                  {t('Only these groups and provider types can be submitted.')}
                </p>
              </div>
              <FormField
                control={form.control}
                name='allowed_groups'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Allowed groups')}</FormLabel>
                    <FormControl>
                      <MultiSelect
                        options={field.value.map((group) => ({
                          label: group,
                          value: group,
                        }))}
                        selected={field.value}
                        onChange={field.onChange}
                        allowCreate
                        placeholder={t('Add an allowed group')}
                        createLabel={t('Add "{{value}}"')}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='allowed_channel_types'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Allowed channel types')}</FormLabel>
                    <FormControl>
                      <MultiSelect
                        options={typeOptions}
                        selected={field.value.map(String)}
                        onChange={(values) =>
                          field.onChange(values.map(Number))
                        }
                        maxVisibleChips={10}
                        placeholder={t('Select channel types')}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            <section className='space-y-4 border-t pt-6'>
              <div>
                <h3 className='text-sm font-semibold'>
                  {t('Routing and health')}
                </h3>
                <p className='text-muted-foreground text-sm'>
                  {t(
                    'Approved channels are created with these routing and removal defaults.'
                  )}
                </p>
              </div>
              <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                <NumberSetting
                  form={form}
                  name='priority'
                  label={t('Priority')}
                  description={t('Higher values are selected first.')}
                  min={0}
                  max={2_147_483_647}
                />
                <NumberSetting
                  form={form}
                  name='weight'
                  label={t('Weight')}
                  description={t(
                    'Default is 0 until routing is intentionally enabled.'
                  )}
                  min={0}
                  max={2_147_483_647}
                />
                <NumberSetting
                  form={form}
                  name='reward_bps'
                  label={t('Reward basis points')}
                  description={t('100 basis points equals 1% of billed quota.')}
                  min={0}
                  max={10_000}
                />
                <NumberSetting
                  form={form}
                  name='health_check_interval_minutes'
                  label={t('Health check interval (minutes)')}
                  description={t('How often contributed channels are checked.')}
                  min={1}
                  max={10_080}
                />
                <NumberSetting
                  form={form}
                  name='unavailable_delete_hours'
                  label={t('Unavailable deletion threshold (hours)')}
                  description={t(
                    'Continuous failure time before automatic deletion.'
                  )}
                  min={1}
                  max={8_760}
                />
              </div>
            </section>

            <section className='space-y-3 border-t pt-6'>
              <FormField
                control={form.control}
                name='agreement_content'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Agreement Markdown')}</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={18}
                        className='min-h-80 font-mono text-xs leading-5'
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Users review this exact content before every first submission or resubmission.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            <div className='flex justify-end border-t pt-5'>
              <Button type='submit' disabled={updateMutation.isPending}>
                <Save data-icon='inline-start' />
                {t('Save settings')}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
