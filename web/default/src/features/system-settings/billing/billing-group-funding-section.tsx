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
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

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

import { SettingsForm } from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const schema = z.object({
  personalFundingGroups: z.string(),
})

type Values = z.infer<typeof schema>

// 将 JSON 字符串解析为分组名数组
function parseGroups(jsonStr: string): string[] {
  if (!jsonStr || !jsonStr.trim()) return []
  try {
    const parsed = JSON.parse(jsonStr)
    if (Array.isArray(parsed)) {
      return parsed.filter((s) => typeof s === 'string' && s.trim())
    }
  } catch {
    // 不是合法 JSON，按逗号/换行分隔处理
    return jsonStr
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return []
}

// 将分组名数组序列化为 JSON 字符串
function formatGroups(groups: string[]): string {
  if (!groups || groups.length === 0) return '[]'
  return JSON.stringify(groups)
}

export function BillingGroupFundingSection({
  defaultValues,
}: {
  defaultValues: {
    personalFundingGroups: string
  }
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  // 后端存储为 JSON 字符串，这里转换为可读的换行分隔文本
  const initialGroups = parseGroups(defaultValues.personalFundingGroups)
  const initialText = initialGroups.join('\n')

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      personalFundingGroups: initialText,
    },
  })

  const { isDirty, isSubmitting } = form.formState

  async function onSubmit(values: Values) {
    const currentGroups = values.personalFundingGroups
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)

    const currentValue = formatGroups(currentGroups)
    const originalValue = formatGroups(initialGroups)

    if (currentValue === originalValue) {
      toast.info(t('No changes to save'))
      return
    }

    await updateOption.mutateAsync({
      key: 'billing_group_setting.personal_funding_groups',
      value: currentValue,
    })

    form.reset({ personalFundingGroups: values.personalFundingGroups })
  }

  return (
    <SettingsSection title={t('Billing Group Funding Policy')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending || isSubmitting}
            isSaveDisabled={!isDirty}
            saveLabel='Save billing group settings'
          />
          <FormField
            control={form.control}
            name='personalFundingGroups'
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t('Personal Funding Groups')}
                </FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={6}
                    placeholder={'paid_model\nimage_model\npremium_model'}
                    disabled={updateOption.isPending || isSubmitting}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'List group names (one per line) that require personal payment. Requests using these groups will exclude company-assigned subscriptions (source=bind_group) and only use personal subscriptions or wallet balance.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
