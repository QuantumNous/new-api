import { useEffect } from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormDescription,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SettingsForm } from '../components/settings-form-layout'
import { useQueryClient } from '@tanstack/react-query'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const customPageSchema = z.object({
  CustomPageTitle: z.string().optional(),
  CustomPageContent: z.string().optional(),
})

type CustomPageFormValues = z.infer<typeof customPageSchema>

type CustomPageSectionProps = {
  defaultTitle: string
  defaultContent: string
}

export function CustomPageSection({
  defaultTitle,
  defaultContent,
}: CustomPageSectionProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const updateOption = useUpdateOption()

  const form = useForm<CustomPageFormValues>({
    resolver: zodResolver(customPageSchema),
    defaultValues: {
      CustomPageTitle: defaultTitle ?? '',
      CustomPageContent: defaultContent ?? '',
    },
  })

  useEffect(() => {
    form.reset({
      CustomPageTitle: defaultTitle ?? '',
      CustomPageContent: defaultContent ?? '',
    })
  }, [defaultTitle, defaultContent, form])

  const onSubmit = async (values: CustomPageFormValues) => {
    const title = values.CustomPageTitle ?? ''
    const content = values.CustomPageContent ?? ''

    if (title !== (defaultTitle ?? '')) {
      await updateOption.mutateAsync({
        key: 'CustomPageTitle',
        value: title,
      })
    }

    if (content !== (defaultContent ?? '')) {
      await updateOption.mutateAsync({
        key: 'CustomPageContent',
        value: content,
      })
      queryClient.invalidateQueries({ queryKey: ['custom-page-content'] })
    }
  }

  return (
    <SettingsSection title={t('Custom Page')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
            saveLabel="Save custom page"
          />
          <FormField
            control={form.control}
            name="CustomPageTitle"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Page Title')}</FormLabel>
                <FormDescription>
                  {t('The name shown in the navigation bar tab.')}
                </FormDescription>
                <FormControl>
                  <Input
                    placeholder={t('Custom Page')}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="CustomPageContent"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Page Content')}</FormLabel>
                <FormDescription>
                  {t('Supports HTML, Markdown, or a URL.')}
                </FormDescription>
                <FormControl>
                  <Textarea
                    rows={12}
                    placeholder="<h1>Welcome</h1><p>Your custom content here...</p>"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
