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
import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import * as z from 'zod'
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
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Combobox } from '@/components/ui/combobox'
import {
  SideDrawerSection,
  sideDrawerContentClassName,
  sideDrawerFooterClassName,
  sideDrawerFormClassName,
  sideDrawerHeaderClassName,
} from '@/components/drawer-layout'
import { getAllModels } from '@/features/channels/api'

const ruleSchema = z.object({
  entryModel: z.string().min(1),
  visionModel: z.string().min(1),
  codingModel: z.string().min(1),
})

export type ImageAwareRouteRuleForm = z.infer<typeof ruleSchema>

type ImageAwareRoutingRuleDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'add' | 'edit'
  initialValues?: ImageAwareRouteRuleForm | null
  onSave: (rule: ImageAwareRouteRuleForm) => Promise<void> | void
}

export function ImageAwareRoutingRuleDrawer({
  open,
  onOpenChange,
  mode,
  initialValues,
  onSave,
}: ImageAwareRoutingRuleDrawerProps) {
  const { t } = useTranslation()
  const isEdit = mode === 'edit'

  const { data: allModelsData } = useQuery({
    queryKey: ['channel_models'],
    queryFn: getAllModels,
  })

  const modelOptions = useMemo(
    () =>
      (allModelsData?.data ?? [])
        .map((model) => ({ value: model.id, label: model.id }))
        .filter((option) => Boolean(option.value)),
    [allModelsData]
  )

  const form = useForm<ImageAwareRouteRuleForm>({
    resolver: zodResolver(ruleSchema),
    defaultValues: { entryModel: '', visionModel: '', codingModel: '' },
  })

  useEffect(() => {
    if (open) {
      form.reset(
        initialValues ?? { entryModel: '', visionModel: '', codingModel: '' }
      )
    }
  }, [open, initialValues, form])

  const handleSubmit = async (values: ImageAwareRouteRuleForm) => {
    const trimmed = {
      entryModel: values.entryModel.trim(),
      visionModel: values.visionModel.trim(),
      codingModel: values.codingModel.trim(),
    }
    await onSave(trimmed)
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={sideDrawerContentClassName('sm:max-w-xl')}>
        <SheetHeader className={sideDrawerHeaderClassName()}>
          <SheetTitle>
            {isEdit ? t('Edit Routing Rule') : t('Add Routing Rule')}
          </SheetTitle>
          <SheetDescription>
            {t(
              'Map a virtual entry model to a vision model and a coding model based on whether the request contains an image.'
            )}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            id='image-aware-routing-rule-form'
            onSubmit={form.handleSubmit(handleSubmit)}
            className={sideDrawerFormClassName()}
          >
            <SideDrawerSection>
              <FormField
                control={form.control}
                name='entryModel'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Entry Model')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('e.g. auto-coder')}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'The virtual model name clients send. Not a real model.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='visionModel'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Vision Model')}</FormLabel>
                    <FormControl>
                      <Combobox
                        options={modelOptions}
                        value={field.value || undefined}
                        onValueChange={(value) =>
                          field.onChange(value ?? '')
                        }
                        allowCustomValue
                        placeholder={t('Select vision model')}
                        searchPlaceholder={t('Search models...')}
                        emptyText={t('No models found')}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Used when the last user message contains an image.')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='codingModel'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Coding Model')}</FormLabel>
                    <FormControl>
                      <Combobox
                        options={modelOptions}
                        value={field.value || undefined}
                        onValueChange={(value) =>
                          field.onChange(value ?? '')
                        }
                        allowCustomValue
                        placeholder={t('Select coding model')}
                        searchPlaceholder={t('Search models...')}
                        emptyText={t('No models found')}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Used when no image is present in the request.')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </SideDrawerSection>
          </form>
        </Form>

        <SheetFooter className={sideDrawerFooterClassName()}>
          <SheetClose
            render={
              <Button type='button' variant='outline' />
            }
          >
            {t('Cancel')}
          </SheetClose>
          <Button type='submit' form='image-aware-routing-rule-form'>
            {isEdit ? t('Save changes') : t('Add')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
