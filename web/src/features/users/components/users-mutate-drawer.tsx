import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { formatQuota, parseQuotaFromDollars } from '@/lib/format'
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
import { createUser, updateUser, getUser, getGroups } from '../api'
import { BINDING_FIELDS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants'
import {
  userFormSchema,
  type UserFormValues,
  USER_FORM_DEFAULT_VALUES,
  transformFormDataToPayload,
  transformUserToFormDefaults,
} from '../lib'
import { type User } from '../types'
import { UserQuotaDialog } from './user-quota-dialog'
import { useUsers } from './users-provider'

type UsersMutateDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: User
}

export function UsersMutateDrawer({
  open,
  onOpenChange,
  currentRow,
}: UsersMutateDrawerProps) {
  const isUpdate = !!currentRow
  const { triggerRefresh } = useUsers()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [quotaDialogOpen, setQuotaDialogOpen] = useState(false)

  // Fetch groups
  const { data: groupsData } = useQuery({
    queryKey: ['groups'],
    queryFn: getGroups,
    staleTime: 5 * 60 * 1000,
  })

  const groups = groupsData?.data || []

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: USER_FORM_DEFAULT_VALUES,
  })

  // Load existing data when updating
  useEffect(() => {
    if (open && isUpdate && currentRow) {
      // For update, fetch fresh data
      getUser(currentRow.id).then((result) => {
        if (result.success && result.data) {
          form.reset(transformUserToFormDefaults(result.data))
        }
      })
    } else if (open && !isUpdate) {
      // For create, reset to defaults
      form.reset(USER_FORM_DEFAULT_VALUES)
    }
  }, [open, isUpdate, currentRow, form])

  const onSubmit = async (data: UserFormValues) => {
    setIsSubmitting(true)
    try {
      const payload = transformFormDataToPayload(data, currentRow?.id)
      const result = isUpdate
        ? await updateUser(payload as typeof payload & { id: number })
        : await createUser(payload)

      if (result.success) {
        toast.success(
          isUpdate
            ? SUCCESS_MESSAGES.USER_UPDATED
            : SUCCESS_MESSAGES.USER_CREATED
        )
        onOpenChange(false)
        triggerRefresh()
      } else {
        toast.error(
          result.message ||
            (isUpdate
              ? ERROR_MESSAGES.UPDATE_FAILED
              : ERROR_MESSAGES.CREATE_FAILED)
        )
      }
    } catch (error) {
      toast.error(ERROR_MESSAGES.UNEXPECTED)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddQuota = (delta: number) => {
    const current = form.getValues('quota_dollars') || 0
    const newQuota = Math.max(0, current + delta)
    form.setValue('quota_dollars', newQuota)
  }

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(v) => {
          onOpenChange(v)
          if (!v) {
            form.reset()
          }
        }}
      >
        <SheetContent className='flex flex-col sm:max-w-[600px]'>
          <SheetHeader className='text-start'>
            <SheetTitle>{isUpdate ? 'Update' : 'Create'} User</SheetTitle>
            <SheetDescription>
              {isUpdate
                ? 'Update the user by providing necessary info.'
                : 'Add a new user by providing necessary info.'}
              Click save when you&apos;re done.
            </SheetDescription>
          </SheetHeader>
          <Form {...form}>
            <form
              id='user-form'
              onSubmit={form.handleSubmit(onSubmit)}
              className='flex-1 space-y-6 overflow-y-auto px-4'
            >
              {/* Basic Information */}
              <div className='space-y-4'>
                <h3 className='text-sm font-medium'>Basic Information</h3>

                <FormField
                  control={form.control}
                  name='username'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder='Enter username'
                          disabled={isUpdate}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {!isUpdate && (
                  <FormField
                    control={form.control}
                    name='role'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select
                          onValueChange={(value) =>
                            field.onChange(parseInt(value))
                          }
                          value={String(field.value)}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder='Select a role' />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value='1'>Common User</SelectItem>
                            <SelectItem value='10'>Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Set the user's role (cannot be Root)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name='display_name'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder='Enter display name' />
                      </FormControl>
                      <FormDescription>
                        Leave empty to use username
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='password'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type='password'
                          placeholder={
                            isUpdate
                              ? 'Leave empty to keep unchanged'
                              : 'Enter password (min 8 characters)'
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Group & Quota Settings (Update only) */}
              {isUpdate && (
                <div className='space-y-4'>
                  <h3 className='text-sm font-medium'>Group & Quota</h3>

                  <FormField
                    control={form.control}
                    name='group'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Group</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder='Select a group' />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {groups.map((group) => (
                              <SelectItem key={group} value={group}>
                                {group}
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
                    name='quota_dollars'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Remaining Quota (USD)</FormLabel>
                        <div className='flex gap-2'>
                          <FormControl>
                            <Input
                              {...field}
                              type='number'
                              step='0.01'
                              placeholder='Enter quota in dollars'
                              onChange={(e) =>
                                field.onChange(parseFloat(e.target.value) || 0)
                              }
                              className='flex-1'
                            />
                          </FormControl>
                          <Button
                            type='button'
                            variant='outline'
                            size='icon'
                            onClick={() => setQuotaDialogOpen(true)}
                          >
                            <Plus className='h-4 w-4' />
                          </Button>
                        </div>
                        <FormDescription>
                          Current:{' '}
                          {formatQuota(parseQuotaFromDollars(field.value || 0))}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name='remark'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Remark</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder='Admin notes (only visible to admins)'
                            rows={3}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Binding Information (Read-only) */}
              {isUpdate && (
                <div className='space-y-4'>
                  <h3 className='text-sm font-medium'>Binding Information</h3>
                  <p className='text-muted-foreground text-xs'>
                    Third-party account bindings (read-only, managed by user in
                    profile settings)
                  </p>

                  <div className='space-y-3'>
                    {BINDING_FIELDS.map(({ key, label }) => (
                      <div key={key}>
                        <label className='text-muted-foreground text-xs font-medium'>
                          {label}
                        </label>
                        <Input
                          value={
                            (currentRow?.[key as keyof User] as string) || '-'
                          }
                          disabled
                          className='mt-1'
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </form>
          </Form>
          <SheetFooter className='gap-2'>
            <SheetClose asChild>
              <Button variant='outline'>Close</Button>
            </SheetClose>
            <Button form='user-form' type='submit' disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save changes'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Add Quota Dialog */}
      <UserQuotaDialog
        open={quotaDialogOpen}
        onOpenChange={setQuotaDialogOpen}
        currentQuotaDollars={form.watch('quota_dollars') || 0}
        onConfirm={handleAddQuota}
      />
    </>
  )
}
