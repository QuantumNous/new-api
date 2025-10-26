import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { JsonEditor } from '@/components/json-editor'
import { TagInput } from '@/components/tag-input'
import { createModel, updateModel, getModel, getVendors } from '../../api'
import { NAME_RULE_OPTIONS, ENDPOINT_TEMPLATES } from '../../constants'
import { modelsQueryKeys, vendorsQueryKeys, parseModelTags } from '../../lib'
import { modelFormSchema, type Model } from '../../types'

type ModelMutateDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: Model | null
}

export function ModelMutateDrawer({
  open,
  onOpenChange,
  currentRow,
}: ModelMutateDrawerProps) {
  const queryClient = useQueryClient()
  const isEditing = Boolean(currentRow?.id)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch vendors for dropdown
  const { data: vendorsData } = useQuery({
    queryKey: vendorsQueryKeys.list(),
    queryFn: () => getVendors({ page_size: 1000 }),
    enabled: open,
  })

  const vendors = vendorsData?.data?.items || []

  // Fetch model detail if editing
  const { data: modelData } = useQuery({
    queryKey: modelsQueryKeys.detail(currentRow?.id || 0),
    queryFn: () => getModel(currentRow!.id),
    enabled: open && isEditing,
  })

  const form = useForm({
    resolver: zodResolver(modelFormSchema),
    defaultValues: {
      model_name: '',
      description: '',
      icon: '',
      tags: [],
      vendor_id: undefined,
      endpoints: '',
      name_rule: 0,
      status: true,
      sync_official: true,
    },
  })

  // Load model data for editing
  useEffect(() => {
    if (open && isEditing && modelData?.data) {
      const model = modelData.data
      form.reset({
        id: model.id,
        model_name: model.model_name,
        description: model.description || '',
        icon: model.icon || '',
        tags: parseModelTags(model.tags),
        vendor_id: model.vendor_id,
        endpoints: model.endpoints || '',
        name_rule: model.name_rule || 0,
        status: model.status === 1,
        sync_official: model.sync_official === 1,
      })
    } else if (open && !isEditing) {
      // Pre-fill model name if passed from missing models
      form.reset({
        model_name: currentRow?.model_name || '',
        description: '',
        icon: '',
        tags: [],
        vendor_id: undefined,
        endpoints: '',
        name_rule: 0,
        status: true,
        sync_official: true,
      })
    }
  }, [open, isEditing, modelData, currentRow, form])

  const onSubmit = useCallback(
    async (values: any) => {
      setIsSubmitting(true)
      try {
        const submitData = {
          ...values,
          id: isEditing ? currentRow!.id : undefined,
          tags: Array.isArray(values.tags) ? values.tags.join(',') : '',
          status: values.status ? 1 : 0,
          sync_official: values.sync_official ? 1 : 0,
        }

        const response = isEditing
          ? await updateModel({ ...submitData, id: currentRow!.id })
          : await createModel(submitData)

        if (response.success) {
          toast.success(
            isEditing
              ? 'Model updated successfully'
              : 'Model created successfully'
          )
          queryClient.invalidateQueries({ queryKey: modelsQueryKeys.lists() })
          onOpenChange(false)
        } else {
          toast.error(response.message || 'Operation failed')
        }
      } catch (error: any) {
        toast.error(error?.message || 'Operation failed')
      } finally {
        setIsSubmitting(false)
      }
    },
    [isEditing, currentRow, queryClient, onOpenChange]
  )

  const handleFillEndpointTemplate = (templateKey: string) => {
    const template = ENDPOINT_TEMPLATES[templateKey]
    if (template) {
      const templateJson = JSON.stringify({ [templateKey]: template }, null, 2)
      form.setValue('endpoints', templateJson)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col sm:max-w-2xl'>
        <SheetHeader className='text-start'>
          <SheetTitle>{isEditing ? 'Edit Model' : 'Create Model'}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? 'Update model configuration and click save when you&apos;re done.'
              : 'Add a new model to the system by providing the necessary information.'}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            id='model-form'
            onSubmit={form.handleSubmit(onSubmit)}
            className='flex-1 space-y-6 overflow-y-auto px-4'
          >
            {/* Basic Information */}
            <div className='space-y-4'>
              <h3 className='text-sm font-semibold'>Basic Information</h3>

              <FormField
                control={form.control}
                name='model_name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='gpt-4, claude-3-opus, etc.'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      The unique identifier for this model
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
                        placeholder='Describe this model...'
                        rows={3}
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
                    <FormLabel>Icon</FormLabel>
                    <FormControl>
                      <Input placeholder='OpenAI, Anthropic, etc.' {...field} />
                    </FormControl>
                    <FormDescription className='text-xs'>
                      @lobehub/icons key
                    </FormDescription>
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
                      onValueChange={(value) =>
                        field.onChange(value ? parseInt(value) : undefined)
                      }
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
                name='tags'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tags</FormLabel>
                    <FormControl>
                      <TagInput
                        value={field.value || []}
                        onChange={field.onChange}
                        placeholder='Add tags...'
                      />
                    </FormControl>
                    <FormDescription>
                      Press Enter or comma to add tags
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Matching Configuration */}
            <div className='space-y-4'>
              <h3 className='text-sm font-semibold'>Matching Rules</h3>

              <FormField
                control={form.control}
                name='name_rule'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name Rule</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={(value) =>
                          field.onChange(parseInt(value))
                        }
                        value={String(field.value)}
                        className='grid grid-cols-2 gap-4'
                      >
                        {NAME_RULE_OPTIONS.map((option) => (
                          <div
                            key={option.value}
                            className='flex items-center space-x-2'
                          >
                            <RadioGroupItem
                              value={String(option.value)}
                              id={`rule-${option.value}`}
                            />
                            <label
                              htmlFor={`rule-${option.value}`}
                              className='cursor-pointer text-sm font-normal'
                            >
                              {option.label}
                            </label>
                          </div>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormDescription>
                      How this model name should match requests
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Endpoints Configuration */}
            <div className='space-y-4'>
              <div className='flex items-center justify-between'>
                <h3 className='text-sm font-semibold'>Endpoints</h3>
                <Select onValueChange={handleFillEndpointTemplate}>
                  <SelectTrigger size='sm' className='w-[200px]'>
                    <SelectValue placeholder='Load template...' />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(ENDPOINT_TEMPLATES).map((key) => (
                      <SelectItem key={key} value={key}>
                        {key}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <FormField
                control={form.control}
                name='endpoints'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endpoint Configuration</FormLabel>
                    <FormControl>
                      <JsonEditor
                        value={field.value || ''}
                        onChange={field.onChange}
                        keyPlaceholder='endpoint_type'
                        valuePlaceholder='{"path": "/v1/...", "method": "POST"}'
                        keyLabel='Endpoint Type'
                        valueLabel='Configuration'
                        valueType='any'
                        emptyMessage='No endpoints configured. Switch to JSON mode or add rows to define endpoints.'
                      />
                    </FormControl>
                    <FormDescription>
                      Define API endpoints for this model (JSON format)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Status & Sync */}
            <div className='space-y-4'>
              <h3 className='text-sm font-semibold'>Status & Sync</h3>

              <FormField
                control={form.control}
                name='status'
                render={({ field }) => (
                  <FormItem className='flex items-center justify-between rounded-lg border p-4'>
                    <div className='space-y-0.5'>
                      <FormLabel className='text-base'>Enabled</FormLabel>
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

              <FormField
                control={form.control}
                name='sync_official'
                render={({ field }) => (
                  <FormItem className='flex items-center justify-between rounded-lg border p-4'>
                    <div className='space-y-0.5'>
                      <FormLabel className='text-base'>Official Sync</FormLabel>
                      <FormDescription>
                        Sync this model with official upstream
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
            </div>
          </form>
        </Form>

        <SheetFooter className='gap-2'>
          <SheetClose asChild>
            <Button variant='outline' disabled={isSubmitting}>
              Cancel
            </Button>
          </SheetClose>
          <Button form='model-form' type='submit' disabled={isSubmitting}>
            {isSubmitting && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {isEditing ? 'Update Model' : 'Save changes'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
