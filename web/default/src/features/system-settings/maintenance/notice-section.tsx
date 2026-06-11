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
import { useEffect } from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const noticeSchema = z.object({
  Notice: z.string().optional(),
  NoticeForcePopup: z.boolean(),
})

type NoticeFormValues = z.infer<typeof noticeSchema>

type NoticeSectionProps = {
  defaultValue: string
  defaultForcePopup: boolean
}

export function NoticeSection({
  defaultValue,
  defaultForcePopup,
}: NoticeSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const form = useForm<NoticeFormValues>({
    resolver: zodResolver(noticeSchema),
    defaultValues: {
      Notice: defaultValue ?? '',
      NoticeForcePopup: defaultForcePopup,
    },
  })

  useEffect(() => {
    form.reset({
      Notice: defaultValue ?? '',
      NoticeForcePopup: defaultForcePopup,
    })
  }, [defaultForcePopup, defaultValue, form])

  const onSubmit = async (values: NoticeFormValues) => {
    const normalized = values.Notice ?? ''
    const updates: Array<{ key: string; value: string | boolean }> = []

    if (normalized !== (defaultValue ?? '')) {
      updates.push({
        key: 'Notice',
        value: normalized,
      })
    }

    if (values.NoticeForcePopup !== defaultForcePopup) {
      updates.push({
        key: 'NoticeForcePopup',
        value: values.NoticeForcePopup,
      })
    }

    if (updates.length === 0) {
      return
    }

    for (const update of updates) {
      await updateOption.mutateAsync(update)
    }
  }

  return (
    <SettingsSection
      title={t('System Notice')}
      description={t(
        'Broadcast a global banner to users. Markdown is supported.'
      )}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
          <FormField
            control={form.control}
            name='Notice'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Announcement content')}</FormLabel>
                <FormControl>
                  <Textarea
                    rows={8}
                    placeholder={t(
                      'Planned maintenance on Friday at 22:00 UTC...'
                    )}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='NoticeForcePopup'
            render={({ field }) => (
              <FormItem className='flex flex-row items-center justify-between rounded-md border p-3'>
                <div className='space-y-1'>
                  <FormLabel>{t('Force popup')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Automatically open this notice whenever users enter the home page'
                    )}
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value === true}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <Button type='submit' disabled={updateOption.isPending}>
            {updateOption.isPending ? t('Saving...') : t('Save notice')}
          </Button>
        </form>
      </Form>
    </SettingsSection>
  )
}
