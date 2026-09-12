import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { type Resolver, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/design-system/button'
import { Input } from '@/components/design-system/input'
import { Dialog } from '@/components/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

import {
  SettingsForm,
  SettingsSwitchField,
} from '../../../components/settings-form-layout'
import { useCreateInternalKey, useUpdateInternalKey } from '../hooks'
import {
  internalKeyFormSchema,
  INTERNAL_KEY_STATUS,
  type InternalKey,
  type InternalKeyFormValues,
} from '../types'

type InternalKeyFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  keyRecord?: InternalKey | null
}

const INTERNAL_KEY_FORM_ID = 'internal-key-form'

export function InternalKeyFormDialog(props: InternalKeyFormDialogProps) {
  const { t } = useTranslation()
  const isEditing = !!props.keyRecord
  const createKey = useCreateInternalKey()
  const updateKey = useUpdateInternalKey()

  const form = useForm<InternalKeyFormValues>({
    resolver: zodResolver(
      internalKeyFormSchema
    ) as unknown as Resolver<InternalKeyFormValues>,
    defaultValues: {
      key_id: '',
      name: '',
      key: '',
      enabled: true,
    },
  })

  useEffect(() => {
    if (!props.open) return
    if (props.keyRecord) {
      form.reset({
        key_id: props.keyRecord.key_id,
        name: props.keyRecord.name,
        key: '',
        enabled: props.keyRecord.status === INTERNAL_KEY_STATUS.ENABLED,
      })
    } else {
      form.reset({
        key_id: '',
        name: '',
        key: '',
        enabled: true,
      })
    }
  }, [props.open, props.keyRecord, form])

  const onSubmit = async (values: InternalKeyFormValues) => {
    if (isEditing && props.keyRecord) {
      const res = await updateKey.mutateAsync({
        id: props.keyRecord.id,
        name: values.name,
        status: values.enabled
          ? INTERNAL_KEY_STATUS.ENABLED
          : INTERNAL_KEY_STATUS.DISABLED,
        key: values.key === '' ? undefined : values.key,
      })
      if (res.success) {
        props.onOpenChange(false)
      }
    } else {
      const res = await createKey.mutateAsync({
        key_id: values.key_id,
        name: values.name,
        status: values.enabled
          ? INTERNAL_KEY_STATUS.ENABLED
          : INTERNAL_KEY_STATUS.DISABLED,
        key: values.key === '' ? undefined : values.key,
      })
      if (res.success) {
        props.onOpenChange(false)
      }
    }
  }

  const isPending = createKey.isPending || updateKey.isPending

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={isEditing ? t('Edit Key') : t('Add Key')}
      description={
        isEditing
          ? t('Update the name, status or key of this internal key.')
          : t('Create a key pair for an internal system to call this instance.')
      }
      contentClassName='sm:max-w-lg'
      contentHeight='auto'
      footer={
        <>
          <Button
            type='button'
            variant='outline'
            onClick={() => props.onOpenChange(false)}
            disabled={isPending}
          >
            {t('Cancel')}
          </Button>
          <Button
            type='submit'
            form={INTERNAL_KEY_FORM_ID}
            disabled={isPending}
          >
            {isEditing ? t('Save') : t('Create')}
          </Button>
        </>
      }
    >
      <Form {...form}>
        <SettingsForm
          id={INTERNAL_KEY_FORM_ID}
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <FormField
            control={form.control}
            name='key_id'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Key ID')}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    disabled={isEditing}
                    placeholder={
                      isEditing ? undefined : t('Leave blank to auto-generate')
                    }
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Letters, digits, hyphens and underscores, up to 64 characters.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='name'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Name')}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormDescription>
                  {t(
                    'A short remark so you know which system this key belongs to.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='key'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Key')}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    autoComplete='off'
                    placeholder={
                      isEditing ? '' : t('Leave blank to auto-generate')
                    }
                    className='font-mono'
                  />
                </FormControl>
                <FormDescription>
                  {isEditing
                    ? t('Leave blank to keep the current key.')
                    : t('Sent as-is with the X-Key header.')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <SettingsSwitchField
            checked={form.watch('enabled')}
            onCheckedChange={(checked) => form.setValue('enabled', checked)}
            label={t('Enabled')}
            description={t('Disabled keys are rejected immediately.')}
          />
        </SettingsForm>
      </Form>
    </Dialog>
  )
}
