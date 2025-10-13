import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
import { Textarea } from '@/components/ui/textarea'
import { MultiSelect } from '@/components/multi-select'
import {
  createPrefillGroup,
  updatePrefillGroup,
  getPrefillGroup,
} from '../../api'
import {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  PREFILL_GROUP_TYPE_OPTIONS,
  ENDPOINT_TEMPLATE,
} from '../../constants'
import {
  prefillGroupFormSchema,
  type PrefillGroupFormValues,
  PREFILL_GROUP_FORM_DEFAULT_VALUES,
  transformPrefillGroupFormDataToPayload,
  transformPrefillGroupToFormDefaults,
} from '../../lib'
import { type PrefillGroup } from '../../types'
import { useModels } from '../models-provider'

type PrefillGroupMutateDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: PrefillGroup | null
}

export function PrefillGroupMutateDrawer({
  open,
  onOpenChange,
  currentRow,
}: PrefillGroupMutateDrawerProps) {
  const isUpdate = !!currentRow
  const { triggerRefresh } = useModels()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<PrefillGroupFormValues>({
    resolver: zodResolver(prefillGroupFormSchema),
    defaultValues: PREFILL_GROUP_FORM_DEFAULT_VALUES,
  })

  const selectedType = form.watch('type')

  // Load existing data when updating
  useEffect(() => {
    if (open && isUpdate && currentRow) {
      getPrefillGroup(currentRow.id).then((result) => {
        if (result.success && result.data) {
          form.reset(transformPrefillGroupToFormDefaults(result.data))
        }
      })
    } else if (open && !isUpdate) {
      form.reset(PREFILL_GROUP_FORM_DEFAULT_VALUES)
    }
  }, [open, isUpdate, currentRow, form])

  const onSubmit = async (data: PrefillGroupFormValues) => {
    setIsSubmitting(true)
    try {
      const payload = transformPrefillGroupFormDataToPayload(data)

      if (isUpdate && currentRow) {
        const result = await updatePrefillGroup({
          ...payload,
          id: currentRow.id,
        })
        if (result.success) {
          toast.success(SUCCESS_MESSAGES.PREFILL_GROUP_UPDATED)
          onOpenChange(false)
          triggerRefresh()
        } else {
          toast.error(
            result.message || ERROR_MESSAGES.PREFILL_GROUP_UPDATE_FAILED
          )
        }
      } else {
        const result = await createPrefillGroup(payload)
        if (result.success) {
          toast.success(SUCCESS_MESSAGES.PREFILL_GROUP_CREATED)
          onOpenChange(false)
          triggerRefresh()
        } else {
          toast.error(
            result.message || ERROR_MESSAGES.PREFILL_GROUP_CREATE_FAILED
          )
        }
      }
    } catch (error) {
      toast.error(ERROR_MESSAGES.UNEXPECTED)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleApplyTemplate = () => {
    form.setValue('items', JSON.stringify(ENDPOINT_TEMPLATE, null, 2))
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
      <SheetContent className='flex flex-col overflow-y-auto sm:max-w-[600px]'>
        <SheetHeader className='text-start'>
          <SheetTitle>
            {isUpdate ? 'Update' : 'Create'} Prefill Group
          </SheetTitle>
          <SheetDescription>
            {isUpdate
              ? 'Update the prefill group configuration.'
              : 'Create a new prefill group for quick filling.'}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            id='prefill-group-form'
            onSubmit={form.handleSubmit(onSubmit)}
            className='flex-1 space-y-6 px-4'
          >
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Group Name *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder='e.g. Common Tags' />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='type'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Select group type' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PREFILL_GROUP_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
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
              name='description'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={3}
                      placeholder='Group description'
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='items'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Items *</FormLabel>
                  {selectedType === 'endpoint' ? (
                    <>
                      <FormControl>
                        <Textarea
                          value={field.value as string}
                          onChange={field.onChange}
                          rows={8}
                          placeholder='{"openai": {"path": "/v1/chat/completions", "method": "POST"}}'
                          className='font-mono text-sm'
                        />
                      </FormControl>
                      <div className='mt-2 flex gap-2'>
                        <Badge
                          variant='secondary'
                          className='hover:bg-secondary/80 cursor-pointer'
                          onClick={handleApplyTemplate}
                        >
                          + Template
                        </Badge>
                      </div>
                      <FormDescription>
                        JSON object mapping endpoint types to path and method
                      </FormDescription>
                    </>
                  ) : (
                    <>
                      <FormControl>
                        <MultiSelect
                          options={(field.value as string[]).map((item) => ({
                            label: item,
                            value: item,
                          }))}
                          selected={field.value as string[]}
                          onChange={field.onChange}
                          placeholder={`Add ${selectedType === 'model' ? 'model names' : 'tags'}`}
                        />
                      </FormControl>
                      <FormDescription>
                        {selectedType === 'model'
                          ? 'Add model names (e.g. gpt-4, claude-3)'
                          : 'Add tags for categorization'}
                      </FormDescription>
                    </>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <SheetFooter className='gap-2'>
          <SheetClose asChild>
            <Button variant='outline'>Cancel</Button>
          </SheetClose>
          <Button
            form='prefill-group-form'
            type='submit'
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Save'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
