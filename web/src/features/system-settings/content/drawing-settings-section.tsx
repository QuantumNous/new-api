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
import { SettingsAccordion } from '../components/settings-accordion'
import { useUpdateOption } from '../hooks/use-update-option'

const drawingSchema = z.object({
  DrawingEnabled: z.boolean(),
  MjNotifyEnabled: z.boolean(),
  MjAccountFilterEnabled: z.boolean(),
  MjForwardUrlEnabled: z.boolean(),
  MjModeClearEnabled: z.boolean(),
  MjActionCheckSuccessEnabled: z.boolean(),
})

type DrawingFormValues = z.infer<typeof drawingSchema>

type DrawingSettingsSectionProps = {
  defaultValues: DrawingFormValues
}

export function DrawingSettingsSection({
  defaultValues,
}: DrawingSettingsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const form = useForm<DrawingFormValues>({
    resolver: zodResolver(drawingSchema),
    defaultValues,
  })

  useEffect(() => {
    form.reset(defaultValues)
  }, [defaultValues, form])

  const onSubmit = async (values: DrawingFormValues) => {
    const updates = Object.entries(values).filter(
      ([key, value]) => value !== defaultValues[key as keyof DrawingFormValues]
    )

    for (const [key, value] of updates) {
      await updateOption.mutateAsync({ key, value })
    }
  }

  const switches: Array<{
    name: keyof DrawingFormValues
    label: string
    description: string
  }> = [
    {
      name: 'DrawingEnabled',
      label: 'Enable drawing features',
      description:
        'Required to expose Midjourney-style image generation to end users.',
    },
    {
      name: 'MjNotifyEnabled',
      label: 'Allow upstream callbacks',
      description:
        'When enabled, Midjourney callbacks are accepted (reveals server IP).',
    },
    {
      name: 'MjAccountFilterEnabled',
      label: 'Allow accountFilter parameter',
      description:
        'Keep enabled if you need to proxy requests for different upstream accounts.',
    },
    {
      name: 'MjForwardUrlEnabled',
      label: 'Rewrite callback URLs to the local server',
      description:
        'Automatically replaces upstream callback URLs with the server address.',
    },
    {
      name: 'MjModeClearEnabled',
      label: 'Clear mode flags in prompts',
      description:
        'Removes Midjourney flags such as --fast, --relax, and --turbo from user prompts.',
    },
    {
      name: 'MjActionCheckSuccessEnabled',
      label: 'Require job success before follow-up actions',
      description:
        'Users must wait for a successful drawing before upscales or variations.',
    },
  ]

  return (
    <SettingsAccordion
      value='drawing-settings'
      title={t('Drawing')}
      description={t('Fine-tune Midjourney integration and guardrails.')}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
          <div className='space-y-4'>
            {switches.map((item) => (
              <FormField
                key={item.name}
                control={form.control}
                name={item.name}
                render={({ field }) => (
                  <FormItem className='flex flex-row items-start justify-between rounded-lg border p-4'>
                    <div className='space-y-0.5 pe-4'>
                      <FormLabel className='text-base'>
                        {t(item.label)}
                      </FormLabel>
                      <FormDescription>{t(item.description)}</FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </div>

          <Button type='submit' disabled={updateOption.isPending}>
            {updateOption.isPending
              ? t('Saving...')
              : t('Save drawing settings')}
          </Button>
        </form>
      </Form>
    </SettingsAccordion>
  )
}
