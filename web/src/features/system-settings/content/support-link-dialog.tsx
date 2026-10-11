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
import { Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, type ChangeEvent } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { Dialog } from '@/components/dialog'
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
import { Textarea } from '@/components/ui/textarea'
import { footerRegistrationSchema } from '@/features/footer/types'
import { SupportIcon } from '@/features/support/components/support-icon'
import {
  isUploadedSupportIcon,
  SUPPORT_ICON_IMAGE_TYPES,
  SUPPORT_ICON_MAX_FILE_SIZE,
  type SupportIcon as SupportIconName,
  type SupportLink,
} from '@/features/support/types'

export type SupportLinkFormValues = {
  title: string
  label: string
  description: string
  url: string
  icon: SupportIconName
}

type SupportLinkDialogProps = {
  mode?: 'support' | 'registration'
  open: boolean
  onOpenChange: (open: boolean) => void
  link: SupportLink | null
  onSubmit: (values: SupportLinkFormValues) => void
}

const SUPPORT_LINK_FORM_ID = 'support-link-form'

export function SupportLinkDialog(props: SupportLinkDialogProps) {
  const { t } = useTranslation()
  const iconFileInputRef = useRef<HTMLInputElement | null>(null)
  const schema = useMemo(
    () =>
      z.object({
        title: z
          .string()
          .trim()
          .min(1, t('Link title is required'))
          .max(80, t('Link title must be 80 characters or fewer')),
        label: z.string().max(120, t('Label must be 120 characters or fewer')),
        description: z
          .string()
          .max(240, t('Description must be 240 characters or fewer')),
        url: z
          .url(t('Enter a valid URL'))
          .refine(
            (value) =>
              props.mode === 'registration'
                ? footerRegistrationSchema.shape.url.safeParse(value).success
                : /^https?:\/\//i.test(value),
            t('Only HTTP and HTTPS links are allowed')
          ),
        icon: z
          .string()
          .refine(
            (value) =>
              (props.mode === 'registration' && value === '') ||
              isUploadedSupportIcon(value),
            t('Please upload an icon')
          ),
      }),
    [t, props.mode]
  )
  const form = useForm<SupportLinkFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      label: '',
      description: '',
      url: '',
      icon: '',
    },
  })
  useEffect(() => {
    if (!props.open) return
    const icon = props.link?.icon ?? ''
    form.reset({
      title: props.link?.title ?? '',
      label: props.link?.label ?? '',
      description: props.link?.description ?? '',
      url: props.link?.url ?? '',
      icon: isUploadedSupportIcon(icon) ? icon : '',
    })
  }, [form, props.link, props.open])

  const handleIconFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (
      !SUPPORT_ICON_IMAGE_TYPES.includes(
        file.type as (typeof SUPPORT_ICON_IMAGE_TYPES)[number]
      )
    ) {
      toast.error(t('Please choose a PNG, JPG, WebP, or GIF image'))
      return
    }
    if (file.size > SUPPORT_ICON_MAX_FILE_SIZE) {
      toast.error(t('Icon file must be 100 KB or smaller'))
      return
    }

    const reader = new FileReader()
    reader.addEventListener('load', () => {
      if (
        typeof reader.result !== 'string' ||
        !isUploadedSupportIcon(reader.result)
      ) {
        toast.error(t('Failed to read icon file'))
        return
      }
      form.setValue('icon', reader.result, {
        shouldDirty: true,
        shouldValidate: true,
      })
    })
    reader.addEventListener('error', () => {
      toast.error(t('Failed to read icon file'))
    })
    reader.readAsDataURL(file)
  }

  let title = props.link ? t('Edit support link') : t('Add support link')
  if (props.mode === 'registration') title = t('Registration information')

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={title}
      description={
        props.mode === 'registration'
          ? t(
              'Display registration text and an optional icon in the homepage footer.'
            )
          : t(
              'Configure the destination and the information displayed on its card.'
            )
      }
      footer={
        <>
          <Button variant='outline' onClick={() => props.onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button type='submit' form={SUPPORT_LINK_FORM_ID}>
            {props.link ? t('Update') : t('Add')}
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form
          id={SUPPORT_LINK_FORM_ID}
          className='space-y-4'
          onSubmit={form.handleSubmit(props.onSubmit)}
        >
          <FormField
            control={form.control}
            name='title'
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {props.mode === 'registration'
                    ? t('Registration text')
                    : t('Link title')}
                </FormLabel>
                <FormControl>
                  <Input placeholder='GitHub' maxLength={80} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {props.mode !== 'registration' && (
            <FormField
              control={form.control}
              name='label'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Account or label')}</FormLabel>
                  <FormControl>
                    <Input placeholder='@example' maxLength={120} {...field} />
                  </FormControl>
                  <FormDescription>
                    {t('Optional highlighted text shown below the title')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <FormField
            control={form.control}
            name='url'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Destination URL')}</FormLabel>
                <FormControl>
                  <Input
                    type='url'
                    placeholder='https://example.com'
                    maxLength={500}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='icon'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Icon')}</FormLabel>
                <div className='flex items-start gap-3'>
                  <span
                    data-testid='support-icon-preview'
                    className='bg-primary/8 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg'
                  >
                    {isUploadedSupportIcon(field.value) ? (
                      <SupportIcon name={field.value} className='size-6' />
                    ) : (
                      <Upload className='size-5' aria-hidden='true' />
                    )}
                  </span>
                  <div className='min-w-0 flex-1 space-y-2'>
                    <FormControl>
                      <Input
                        ref={(node) => {
                          field.ref(node)
                          iconFileInputRef.current = node
                        }}
                        type='file'
                        name={field.name}
                        accept={SUPPORT_ICON_IMAGE_TYPES.join(',')}
                        className='sr-only'
                        onBlur={field.onBlur}
                        onChange={handleIconFileChange}
                      />
                    </FormControl>
                    <div className='flex flex-wrap gap-2'>
                      <Button
                        type='button'
                        variant='outline'
                        onClick={() => iconFileInputRef.current?.click()}
                      >
                        <Upload data-icon='inline-start' />
                        {t('Upload')}
                      </Button>
                      {isUploadedSupportIcon(field.value) ? (
                        <Button
                          type='button'
                          variant='outline'
                          onClick={() =>
                            form.setValue('icon', '', {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                          }
                        >
                          {t('Clear')}
                        </Button>
                      ) : null}
                    </div>
                    <FormDescription>
                      {t(
                        'Supports PNG, JPG, WebP, or GIF. Maximum file size: 100 KB.'
                      )}
                    </FormDescription>
                  </div>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          {props.mode !== 'registration' && (
            <FormField
              control={form.control}
              name='description'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Link description')}</FormLabel>
                  <FormControl>
                    <Textarea rows={3} maxLength={240} {...field} />
                  </FormControl>
                  <FormDescription>
                    {t('Optional, up to 240 characters')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </form>
      </Form>
    </Dialog>
  )
}
