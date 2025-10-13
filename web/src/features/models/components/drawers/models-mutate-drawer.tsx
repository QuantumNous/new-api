import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
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
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { MultiSelect } from '@/components/multi-select'
import {
  createModel,
  updateModel,
  getModel,
  getVendors,
  getPrefillGroups,
} from '../../api'
import {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  NAME_RULE_OPTIONS,
  ENDPOINT_TEMPLATE,
} from '../../constants'
import {
  modelFormSchema,
  type ModelFormValues,
  MODEL_FORM_DEFAULT_VALUES,
  transformFormDataToPayload,
  transformModelToFormDefaults,
} from '../../lib'
import { type Model } from '../../types'
import { useModels } from '../models-provider'

type ModelsMutateDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: Model | null
}

export function ModelsMutateDrawer({
  open,
  onOpenChange,
  currentRow,
}: ModelsMutateDrawerProps) {
  const isUpdate = !!currentRow
  const { triggerRefresh } = useModels()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch vendors
  const { data: vendorsData } = useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const result = await getVendors({ page_size: 1000 })
      if (!result.success || !result.data) return []
      return result.data.items || []
    },
    enabled: open,
    initialData: [],
  })

  // Fetch tag prefill groups
  const { data: tagGroups } = useQuery({
    queryKey: ['prefill-groups', 'tag'],
    queryFn: async () => {
      const result = await getPrefillGroups({ type: 'tag' })
      return result.data || []
    },
    enabled: open,
    initialData: [],
  })

  // Fetch endpoint prefill groups
  const { data: endpointGroups } = useQuery({
    queryKey: ['prefill-groups', 'endpoint'],
    queryFn: async () => {
      const result = await getPrefillGroups({ type: 'endpoint' })
      return result.data || []
    },
    enabled: open,
    initialData: [],
  })

  const vendors = Array.isArray(vendorsData) ? vendorsData : []

  const form = useForm<ModelFormValues>({
    resolver: zodResolver(modelFormSchema),
    defaultValues: MODEL_FORM_DEFAULT_VALUES,
  })

  // Load existing data when updating
  useEffect(() => {
    if (open && isUpdate && currentRow) {
      getModel(currentRow.id).then((result) => {
        if (result.success && result.data) {
          form.reset(transformModelToFormDefaults(result.data))
        }
      })
    } else if (open && !isUpdate) {
      // For create, check if model_name is pre-filled (from missing models)
      const modelName = (currentRow as any)?.model_name || ''
      form.reset({
        ...MODEL_FORM_DEFAULT_VALUES,
        model_name: modelName,
      })
    }
  }, [open, isUpdate, currentRow, form])

  const onSubmit = async (data: ModelFormValues) => {
    setIsSubmitting(true)
    try {
      const payload = transformFormDataToPayload(data)

      if (isUpdate && currentRow) {
        const result = await updateModel({
          ...payload,
          id: currentRow.id,
        })
        if (result.success) {
          toast.success(SUCCESS_MESSAGES.MODEL_UPDATED)
          onOpenChange(false)
          triggerRefresh()
        } else {
          toast.error(result.message || ERROR_MESSAGES.UPDATE_FAILED)
        }
      } else {
        const result = await createModel(payload)
        if (result.success) {
          toast.success(SUCCESS_MESSAGES.MODEL_CREATED)
          onOpenChange(false)
          triggerRefresh()
        } else {
          toast.error(result.message || ERROR_MESSAGES.CREATE_FAILED)
        }
      }
    } catch (error) {
      toast.error(ERROR_MESSAGES.UNEXPECTED)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleApplyTagGroup = (groupItems: string | string[]) => {
    const currentTags = form.getValues('tags') || []
    const newTags = Array.isArray(groupItems) ? groupItems : []
    const uniqueTags = Array.from(new Set([...currentTags, ...newTags]))
    form.setValue('tags', uniqueTags)
  }

  const handleApplyEndpointTemplate = (template: string) => {
    form.setValue('endpoints', template)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) {
          form.reset()
        }
      }}
    >
      <SheetContent className='flex flex-col overflow-y-auto sm:max-w-[700px]'>
        <SheetHeader className='text-start'>
          <SheetTitle>{isUpdate ? 'Update' : 'Create'} Model</SheetTitle>
          <SheetDescription>
            {isUpdate
              ? 'Update the model configuration.'
              : 'Add a new model to the system.'}
            Click save when you&apos;re done.
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            id='model-form'
            onSubmit={form.handleSubmit(onSubmit)}
            className='flex-1 space-y-6 px-4'
          >
            <FormField
              control={form.control}
              name='model_name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Model Name *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder='e.g. gpt-4' />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='name_rule'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Match Type *</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(Number(value))}
                    value={String(field.value)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Select match type' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {NAME_RULE_OPTIONS.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={String(option.value)}
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Priority: Exact &gt; Prefix &gt; Suffix &gt; Contains
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='icon'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Icon</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder='e.g. OpenAI' />
                  </FormControl>
                  <FormDescription>
                    Use @lobehub/icons library. See{' '}
                    <a
                      href='https://icons.lobehub.com/components/lobe-hub'
                      target='_blank'
                      rel='noreferrer'
                      className='text-primary underline'
                    >
                      documentation
                    </a>
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
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={3}
                      placeholder='Model description'
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='tags'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags</FormLabel>
                  <FormControl>
                    <MultiSelect
                      options={field.value.map((tag) => ({
                        label: tag,
                        value: tag,
                      }))}
                      selected={field.value}
                      onChange={field.onChange}
                      placeholder='Add tags'
                    />
                  </FormControl>
                  {tagGroups && tagGroups.length > 0 && (
                    <div className='mt-2 flex flex-wrap gap-2'>
                      {tagGroups.map((group) => (
                        <Badge
                          key={group.id}
                          variant='secondary'
                          className='hover:bg-secondary/80 cursor-pointer'
                          onClick={() => handleApplyTagGroup(group.items)}
                        >
                          + {group.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='vendor_id'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vendor</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(Number(value))}
                    value={field.value ? String(field.value) : undefined}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Select vendor' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {vendors.map((vendor) => (
                        <SelectItem key={vendor.id} value={String(vendor.id)}>
                          {vendor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='endpoints'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endpoints (JSON)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={6}
                      placeholder='{"openai": {"path": "/v1/chat/completions", "method": "POST"}}'
                      className='font-mono text-sm'
                    />
                  </FormControl>
                  <FormDescription>
                    Leave empty to use default endpoints
                  </FormDescription>
                  <div className='mt-2 flex flex-wrap gap-2'>
                    <Badge
                      variant='secondary'
                      className='hover:bg-secondary/80 cursor-pointer'
                      onClick={() =>
                        handleApplyEndpointTemplate(
                          JSON.stringify(ENDPOINT_TEMPLATE, null, 2)
                        )
                      }
                    >
                      + Template
                    </Badge>
                    {endpointGroups &&
                      endpointGroups.map((group) => (
                        <Badge
                          key={group.id}
                          variant='secondary'
                          className='hover:bg-secondary/80 cursor-pointer'
                          onClick={() => {
                            const groupItems =
                              typeof group.items === 'string'
                                ? group.items
                                : JSON.stringify(group.items, null, 2)
                            handleApplyEndpointTemplate(groupItems)
                          }}
                        >
                          + {group.name}
                        </Badge>
                      ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='sync_official'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>Official Sync</FormLabel>
                    <FormDescription>
                      Participate in official model synchronization
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='status'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>Status</FormLabel>
                    <FormDescription>
                      Enable or disable this model
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </form>
        </Form>
        <SheetFooter className='gap-2'>
          <SheetClose asChild>
            <Button variant='outline'>Cancel</Button>
          </SheetClose>
          <Button form='model-form' type='submit' disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
