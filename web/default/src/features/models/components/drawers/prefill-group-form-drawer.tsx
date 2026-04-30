import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { JsonEditor } from '@/components/json-editor'
import { StatusBadge } from '@/components/status-badge'
import { TagInput } from '@/components/tag-input'
import { createPrefillGroup, updatePrefillGroup } from '../../api'
import { ENDPOINT_TEMPLATES } from '../../constants'
import { prefillGroupsQueryKeys } from '../../lib'
import {
  prefillGroupFormSchema,
  type PrefillGroup,
  type PrefillGroupFormValues,
} from '../../types'
import {
  DEFAULT_FORM_VALUES,
  PREFILL_GROUP_TYPE_META,
  PREFILL_GROUP_TYPES,
  type PrefillGroupType,
  parseStringItems,
  serializeEndpointItems,
} from '../prefill-group-shared'

type PrefillGroupFormDrawerProps = {
  open: boolean
  onClose: () => void
  currentGroup: PrefillGroup | null
}

export function PrefillGroupFormDrawer({
  open,
  onClose,
  currentGroup,
}: PrefillGroupFormDrawerProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const isEdit = Boolean(currentGroup?.id)
  const [isSaving, setIsSaving] = useState(false)

  const form = useForm<PrefillGroupFormValues>({
    resolver: zodResolver(prefillGroupFormSchema),
    defaultValues: DEFAULT_FORM_VALUES,
  })

  const selectedType = form.watch('type')

  useEffect(() => {
    if (open) {
      if (isEdit && currentGroup) {
        form.reset({
          id: currentGroup.id,
          name: currentGroup.name,
          description: currentGroup.description || '',
          type: currentGroup.type,
          items:
            currentGroup.type === 'endpoint'
              ? serializeEndpointItems(currentGroup.items)
              : parseStringItems(currentGroup.items),
        })
      } else {
        form.reset(DEFAULT_FORM_VALUES)
      }
    }
  }, [open, isEdit, currentGroup, form])

  useEffect(() => {
    const currentItems = form.getValues('items')
    if (selectedType === 'endpoint' && Array.isArray(currentItems)) {
      form.setValue('items', '', { shouldValidate: false })
    } else if (
      selectedType !== 'endpoint' &&
      typeof currentItems === 'string'
    ) {
      form.setValue('items', [], { shouldValidate: false })
    }
  }, [selectedType, form])

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      onClose()
    }
  }

  const handleSubmit = async (values: PrefillGroupFormValues) => {
    setIsSaving(true)
    const payload = {
      name: values.name.trim(),
      type: values.type,
      description: values.description?.trim() || '',
      items:
        values.type === 'endpoint'
          ? typeof values.items === 'string'
            ? values.items
            : ''
          : Array.isArray(values.items)
            ? values.items
            : [],
    }

    try {
      const response = isEdit
        ? await updatePrefillGroup({
            id: currentGroup!.id,
            ...payload,
          })
        : await createPrefillGroup(payload)

      if (response.success) {
        toast.success(
          isEdit ? 'Prefill group updated' : 'Prefill group created'
        )
        queryClient.invalidateQueries({
          queryKey: prefillGroupsQueryKeys.lists(),
        })
        onClose()
      } else {
        toast.error(response.message || 'Operation failed')
      }
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Operation failed')
    } finally {
      setIsSaving(false)
    }
  }

  const meta =
    PREFILL_GROUP_TYPE_META[selectedType] || PREFILL_GROUP_TYPE_META.model

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className='flex h-dvh w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl'>
        <SheetHeader className='border-b px-4 py-3 text-start sm:px-6 sm:py-4'>
          <SheetTitle>
            {isEdit ? t('Edit Prefill Group') : t('Create Prefill Group')}
          </SheetTitle>
          <SheetDescription>
            {isEdit
              ? t('Update the reusable bundle below.')
              : t('Capture a reusable bundle of models, tags, or endpoints.')}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            id='prefill-group-form'
            onSubmit={form.handleSubmit(handleSubmit)}
            className='flex-1 space-y-4 overflow-y-auto px-3 py-3 pb-4 sm:space-y-6 sm:px-4'
          >
            <div className='space-y-4'>
              <div className='space-y-1'>
                <h3 className='text-sm font-semibold'>{t('Group details')}</h3>
                <p className='text-muted-foreground text-sm'>
                  {t(
                    'Give the group a recognizable name and optional description.'
                  )}
                </p>
              </div>

              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Group Name')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('Premium chat models')}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Give this group a recognizable name.')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='description'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Description')}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t(
                          'Optional notes about when to use this group'
                        )}
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Make it easier for teammates to pick the right group.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            <div className='space-y-4'>
              <div className='space-y-1'>
                <h3 className='text-sm font-semibold'>{t('Configuration')}</h3>
                <p className='text-muted-foreground text-sm'>
                  {t('Choose the bundle type and define the items inside it.')}
                </p>
              </div>

              <FormField
                control={form.control}
                name='type'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Group Type</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value: PrefillGroupType) =>
                        field.onChange(value)
                      }
                    >
                      <FormControl>
                        <SelectTrigger className='[&_[data-slot=select-value]_[data-prefill-description]]:hidden'>
                          <SelectValue placeholder={t('Select a group type')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PREFILL_GROUP_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className='flex flex-col text-left'>
                              <span className='font-medium'>{type.label}</span>
                              <span
                                data-prefill-description
                                className='text-muted-foreground text-xs'
                              >
                                {type.description}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {t('Determines how this group is applied elsewhere.')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className='space-y-2 rounded-lg border p-3 sm:p-4'>
                <div className='flex items-center gap-2'>
                  <h4 className='text-sm font-medium'>{t('Project')}</h4>
                  <StatusBadge
                    label={meta.label}
                    variant={meta.badge}
                    size='sm'
                    copyable={false}
                  />
                </div>
                <FormField
                  control={form.control}
                  name='items'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='sr-only'>{t('Items')}</FormLabel>
                      <FormControl>
                        {selectedType === 'endpoint' ? (
                          <JsonEditor
                            value={(field.value as string) || ''}
                            onChange={field.onChange}
                            keyPlaceholder='provider'
                            valuePlaceholder='{"path": "/v1/...","method": "POST"}'
                            keyLabel={t('Provider')}
                            valueLabel={t('Endpoint config')}
                            valueType='any'
                            template={ENDPOINT_TEMPLATES}
                            emptyMessage={t(
                              'Define endpoint mappings for each provider.'
                            )}
                          />
                        ) : (
                          <TagInput
                            value={
                              Array.isArray(field.value) ? field.value : []
                            }
                            onChange={field.onChange}
                            placeholder={t('Enter a value and press Enter')}
                          />
                        )}
                      </FormControl>
                      <FormDescription>
                        {selectedType === 'endpoint'
                          ? t(
                              'Provide a JSON object where each key maps to an endpoint definition.'
                            )
                          : t('Add each model or tag you want to include.')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </form>
        </Form>

        <SheetFooter className='grid grid-cols-2 gap-2 border-t px-4 py-3 sm:flex sm:px-6 sm:py-4'>
          <SheetClose asChild>
            <Button type='button' variant='outline' disabled={isSaving}>
              {t('Cancel')}
            </Button>
          </SheetClose>
          <Button type='submit' form='prefill-group-form' disabled={isSaving}>
            {isSaving && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {isSaving
              ? t('Saving...')
              : isEdit
                ? t('Save changes')
                : t('Create')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
