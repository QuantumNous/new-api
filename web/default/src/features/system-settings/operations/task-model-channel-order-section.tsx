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
import { Textarea } from '@/components/ui/textarea'
import { SettingsSection } from '../components/settings-section'
import { useResetForm } from '../hooks/use-reset-form'
import { useUpdateOption } from '../hooks/use-update-option'

const orderSchema = z.object({
  TaskModelChannelOrder: z.string().refine((value) => {
    try {
      const parsed = JSON.parse(value || '{}') as unknown
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return false
      }
      for (const ids of Object.values(parsed as Record<string, unknown>)) {
        if (!Array.isArray(ids) || !ids.every((id) => Number.isInteger(id))) {
          return false
        }
      }
      return true
    } catch {
      return false
    }
  }, 'Must be a JSON object of model name to channel id arrays'),
})

type OrderFormValues = z.infer<typeof orderSchema>

type TaskModelChannelOrderSectionProps = {
  defaultValues: OrderFormValues
}

export function TaskModelChannelOrderSection({
  defaultValues,
}: TaskModelChannelOrderSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const form = useForm({
    resolver: zodResolver(orderSchema),
    defaultValues,
  })

  useResetForm(form, defaultValues)

  const onSubmit = async (data: OrderFormValues) => {
    if (data.TaskModelChannelOrder === defaultValues.TaskModelChannelOrder) {
      return
    }
    await updateOption.mutateAsync({
      key: 'TaskModelChannelOrder',
      value: data.TaskModelChannelOrder,
    })
  }

  return (
    <SettingsSection
      title={t('Task Model Channel Order')}
      description={t(
        'Optional ordered channel lists per model for async task failover (overrides Priority)'
      )}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
          <FormField
            control={form.control}
            name='TaskModelChannelOrder'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Model → Channel ID Order (JSON)')}</FormLabel>
                <FormControl>
                  <Textarea
                    className='min-h-40 font-mono text-sm'
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                    placeholder='{"seedance2":[3,1,2]}'
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Example: {"seedance2":[3,1,2]}. Empty object uses channel Priority. Channels must support the model.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type='submit' disabled={updateOption.isPending}>
            {updateOption.isPending ? t('Saving...') : t('Save Changes')}
          </Button>
        </form>
      </Form>
    </SettingsSection>
  )
}
