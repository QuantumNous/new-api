import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form'
import { SettingsSection } from '../components/settings-section'
import { useResetForm } from '../hooks/use-reset-form'
import { useUpdateOption } from '../hooks/use-update-option'

const XAI_VIOLATION_FEE_DOC_URL =
  'https://docs.x.ai/docs/models#usage-guidelines-violation-fee'

const grokSchema = z.object({
  'grok.violation_deduction_enabled': z.boolean(),
  'grok.violation_deduction_amount': z.coerce.number().min(0),
})

type GrokFormValues = z.infer<typeof grokSchema>

interface Props {
  defaultValues: GrokFormValues
}

export function GrokSettingsCard(props: Props) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const form = useForm<GrokFormValues>({
    resolver: zodResolver(grokSchema),
    defaultValues: props.defaultValues,
  })

  useResetForm(form, props.defaultValues)

  const onSubmit = async (data: GrokFormValues) => {
    const entries = Object.entries(data) as [string, unknown][]
    const updates = entries.filter(
      ([key, value]) =>
        value !== props.defaultValues[key as keyof GrokFormValues]
    )
    for (const [key, value] of updates) {
      await updateOption.mutateAsync({ key, value })
    }
  }

  const enabled = form.watch('grok.violation_deduction_enabled')

  return (
    <SettingsSection
      title={t('Grok 设置')}
      description={t('配置 xAI Grok 模型特定设置')}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
          <FormField
            control={form.control}
            name='grok.violation_deduction_enabled'
            render={({ field }) => (
              <FormItem className='flex items-center gap-2'>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div>
                  <FormLabel>{t('启用违规扣费')}</FormLabel>
                  <FormDescription>
                    {t('开启后，违规请求将额外扣费。')}{' '}
                    <a
                      href={XAI_VIOLATION_FEE_DOC_URL}
                      target='_blank'
                      rel='noreferrer'
                      className='underline'
                    >
                      {t('官方说明')}
                    </a>
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='grok.violation_deduction_amount'
            render={({ field }) => (
              <FormItem className='max-w-xs'>
                <FormLabel>{t('违规扣费金额')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    step={0.01}
                    min={0}
                    {...field}
                    disabled={!enabled}
                  />
                </FormControl>
                <FormDescription>
                  {t('基础金额，实际扣费 = 基础金额 × 系统分组倍率。')}
                </FormDescription>
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
