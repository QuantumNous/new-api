import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { createVendor, updateVendor, getVendor } from '../../api'
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../../constants'
import {
  vendorFormSchema,
  type VendorFormValues,
  VENDOR_FORM_DEFAULT_VALUES,
  transformVendorFormDataToPayload,
  transformVendorToFormDefaults,
} from '../../lib'
import { type Vendor } from '../../types'
import { useModels } from '../models-provider'

type VendorMutateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: Vendor | null
}

export function VendorMutateDialog({
  open,
  onOpenChange,
  currentRow,
}: VendorMutateDialogProps) {
  const isUpdate = !!currentRow
  const { triggerRefresh } = useModels()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<VendorFormValues>({
    resolver: zodResolver(vendorFormSchema),
    defaultValues: VENDOR_FORM_DEFAULT_VALUES,
  })

  // Load existing data when updating
  useEffect(() => {
    if (open && isUpdate && currentRow) {
      getVendor(currentRow.id).then((result) => {
        if (result.success && result.data) {
          form.reset(transformVendorToFormDefaults(result.data))
        }
      })
    } else if (open && !isUpdate) {
      form.reset(VENDOR_FORM_DEFAULT_VALUES)
    }
  }, [open, isUpdate, currentRow, form])

  const onSubmit = async (data: VendorFormValues) => {
    setIsSubmitting(true)
    try {
      const payload = transformVendorFormDataToPayload(data)

      if (isUpdate && currentRow) {
        const result = await updateVendor({
          ...payload,
          id: currentRow.id,
        })
        if (result.success) {
          toast.success(SUCCESS_MESSAGES.VENDOR_UPDATED)
          onOpenChange(false)
          triggerRefresh()
        } else {
          toast.error(result.message || ERROR_MESSAGES.VENDOR_UPDATE_FAILED)
        }
      } else {
        const result = await createVendor(payload)
        if (result.success) {
          toast.success(SUCCESS_MESSAGES.VENDOR_CREATED)
          onOpenChange(false)
          triggerRefresh()
        } else {
          toast.error(result.message || ERROR_MESSAGES.VENDOR_CREATE_FAILED)
        }
      }
    } catch (error) {
      toast.error(ERROR_MESSAGES.UNEXPECTED)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) {
          form.reset()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isUpdate ? 'Update' : 'Create'} Vendor</DialogTitle>
          <DialogDescription>
            {isUpdate
              ? 'Update the vendor information.'
              : 'Add a new vendor to the system.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vendor Name *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder='e.g. OpenAI' />
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
                      placeholder='Vendor description'
                    />
                  </FormControl>
                  <FormMessage />
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
                      Enable or disable this vendor
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

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type='submit' disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
