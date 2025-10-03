import { useEffect, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { Plus, Minus } from 'lucide-react'
import { toast } from 'sonner'
import { formatQuota, parseQuotaFromDollars } from '@/lib/format'
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
import {
  createUser,
  updateUser,
  getUser,
  getGroups,
  type UserFormData,
} from '../api'
import { type User } from '../data/schema'
import { useUsers } from './users-provider'

type UsersMutateDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: User
}

const formSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  display_name: z.string().optional(),
  password: z.string().optional(),
  email: z.string().optional(),
  quota_dollars: z.number().min(0).optional(),
  group: z.string().min(1, 'Group is required'),
  remark: z.string().optional(),
})

type UserForm = z.infer<typeof formSchema>

export function UsersMutateDrawer({
  open,
  onOpenChange,
  currentRow,
}: UsersMutateDrawerProps) {
  const isUpdate = !!currentRow
  const { triggerRefresh } = useUsers()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [quotaDialogOpen, setQuotaDialogOpen] = useState(false)
  const [quotaDelta, setQuotaDelta] = useState('')

  // Fetch groups
  const { data: groupsData } = useQuery({
    queryKey: ['groups'],
    queryFn: getGroups,
    staleTime: 5 * 60 * 1000,
  })

  const groups = groupsData?.data || []

  const form = useForm<UserForm>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: '',
      display_name: '',
      password: '',
      email: '',
      quota_dollars: 0,
      group: 'default',
      remark: '',
    },
  })

  // Load existing data when updating
  useEffect(() => {
    if (open && isUpdate && currentRow) {
      // For update, fetch fresh data
      getUser(currentRow.id).then((result) => {
        if (result.success && result.data) {
          const data = result.data
          form.reset({
            username: data.username,
            display_name: data.display_name,
            password: '',
            email: data.email || '',
            quota_dollars: data.quota / 500000,
            group: data.group || 'default',
            remark: data.remark || '',
          })
        }
      })
    } else if (open && !isUpdate) {
      // For create, reset to defaults
      form.reset({
        username: '',
        display_name: '',
        password: '',
        email: '',
        quota_dollars: 0,
        group: 'default',
        remark: '',
      })
    }
  }, [open, isUpdate, currentRow, form])

  const onSubmit = async (data: UserForm) => {
    setIsSubmitting(true)
    try {
      const payload = {
        username: data.username,
        display_name: data.display_name || data.username,
        password: data.password || undefined,
        email: data.email,
        quota: parseQuotaFromDollars(data.quota_dollars || 0),
        group: data.group,
        remark: data.remark,
      }

      if (isUpdate && currentRow) {
        const result = await updateUser({
          ...payload,
          id: currentRow.id,
        })
        if (result.success) {
          toast.success('User updated successfully')
          onOpenChange(false)
          triggerRefresh()
        } else {
          toast.error(result.message || 'Failed to update user')
        }
      } else {
        const result = await createUser(payload)
        if (result.success) {
          toast.success('User created successfully')
          onOpenChange(false)
          triggerRefresh()
        } else {
          toast.error(result.message || 'Failed to create user')
        }
      }
    } catch (error) {
      toast.error('An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddQuota = () => {
    const current = form.getValues('quota_dollars') || 0
    const delta = parseFloat(quotaDelta) || 0
    const newQuota = current + delta
    form.setValue('quota_dollars', Math.max(0, newQuota))
    setQuotaDialogOpen(false)
    setQuotaDelta('')
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

                <FormField
                  control={form.control}
                  name='email'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type='email'
                          placeholder='Enter email (optional)'
                          disabled={isUpdate}
                        />
                      </FormControl>
                      <FormDescription>
                        {isUpdate
                          ? 'Email binding is managed by user settings'
                          : 'Optional email address'}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Group & Quota Settings */}
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
                    <div>
                      <label className='text-muted-foreground text-xs font-medium'>
                        GitHub ID
                      </label>
                      <Input
                        value={currentRow?.github_id || '-'}
                        disabled
                        className='mt-1'
                      />
                    </div>
                    <div>
                      <label className='text-muted-foreground text-xs font-medium'>
                        OIDC ID
                      </label>
                      <Input
                        value={currentRow?.oidc_id || '-'}
                        disabled
                        className='mt-1'
                      />
                    </div>
                    <div>
                      <label className='text-muted-foreground text-xs font-medium'>
                        WeChat ID
                      </label>
                      <Input
                        value={currentRow?.wechat_id || '-'}
                        disabled
                        className='mt-1'
                      />
                    </div>
                    <div>
                      <label className='text-muted-foreground text-xs font-medium'>
                        Email
                      </label>
                      <Input
                        value={currentRow?.email || '-'}
                        disabled
                        className='mt-1'
                      />
                    </div>
                    <div>
                      <label className='text-muted-foreground text-xs font-medium'>
                        Telegram ID
                      </label>
                      <Input
                        value={currentRow?.telegram_id || '-'}
                        disabled
                        className='mt-1'
                      />
                    </div>
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
      <Dialog open={quotaDialogOpen} onOpenChange={setQuotaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Quota</DialogTitle>
            <DialogDescription>
              Enter a positive or negative amount to adjust the quota
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='text-muted-foreground text-sm'>
              Current:{' '}
              {formatQuota(
                parseQuotaFromDollars(form.watch('quota_dollars') || 0)
              )}
              {quotaDelta && (
                <>
                  {' + '}
                  {formatQuota(
                    parseQuotaFromDollars(parseFloat(quotaDelta) || 0)
                  )}
                  {' = '}
                  {formatQuota(
                    parseQuotaFromDollars(
                      (form.watch('quota_dollars') || 0) +
                        (parseFloat(quotaDelta) || 0)
                    )
                  )}
                </>
              )}
            </div>
            <Input
              type='number'
              step='0.01'
              placeholder='Enter amount (supports negative)'
              value={quotaDelta}
              onChange={(e) => setQuotaDelta(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setQuotaDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddQuota}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
