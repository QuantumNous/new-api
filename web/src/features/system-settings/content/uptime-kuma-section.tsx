import { useEffect, useState } from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Edit, Trash2, Save } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SettingsAccordion } from '../components/settings-accordion'
import { useUpdateOption } from '../hooks/use-update-option'

type UptimeKumaGroup = {
  id: number
  categoryName: string
  url: string
  slug: string
}

type UptimeKumaSectionProps = {
  enabled: boolean
  data: string
}

const uptimeKumaSchema = z.object({
  categoryName: z
    .string()
    .min(1, 'Category name is required')
    .max(50, 'Category name must be less than 50 characters'),
  url: z.string().url('Must be a valid URL'),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(100, 'Slug must be less than 100 characters')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Slug can only contain letters, numbers, hyphens, and underscores'
    ),
})

type UptimeKumaFormValues = z.infer<typeof uptimeKumaSchema>

export function UptimeKumaSection({ enabled, data }: UptimeKumaSectionProps) {
  const updateOption = useUpdateOption()
  const [groups, setGroups] = useState<UptimeKumaGroup[]>([])
  const [isEnabled, setIsEnabled] = useState(enabled)
  const [hasChanges, setHasChanges] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [showDialog, setShowDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [editingGroup, setEditingGroup] = useState<UptimeKumaGroup | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<'single' | 'batch'>('single')

  const form = useForm<UptimeKumaFormValues>({
    resolver: zodResolver(uptimeKumaSchema),
    defaultValues: {
      categoryName: '',
      url: '',
      slug: '',
    },
  })

  useEffect(() => {
    try {
      const parsed = JSON.parse(data || '[]')
      if (Array.isArray(parsed)) {
        setGroups(
          parsed.map((item, idx) => ({
            ...item,
            id: item.id || idx + 1,
          }))
        )
      }
    } catch {
      setGroups([])
    }
  }, [data])

  useEffect(() => {
    setIsEnabled(enabled)
  }, [enabled])

  const handleToggleEnabled = async (checked: boolean) => {
    try {
      await updateOption.mutateAsync({
        key: 'console_setting.uptime_kuma_enabled',
        value: checked,
      })
      setIsEnabled(checked)
      toast.success('Setting saved')
    } catch {
      toast.error('Failed to update setting')
    }
  }

  const handleAdd = () => {
    setEditingGroup(null)
    form.reset({
      categoryName: '',
      url: '',
      slug: '',
    })
    setShowDialog(true)
  }

  const handleEdit = (group: UptimeKumaGroup) => {
    setEditingGroup(group)
    form.reset({
      categoryName: group.categoryName,
      url: group.url,
      slug: group.slug,
    })
    setShowDialog(true)
  }

  const handleDelete = (group: UptimeKumaGroup) => {
    setEditingGroup(group)
    setDeleteTarget('single')
    setShowDeleteDialog(true)
  }

  const handleBatchDelete = () => {
    if (selectedIds.length === 0) {
      toast.error('Please select items to delete')
      return
    }
    setDeleteTarget('batch')
    setShowDeleteDialog(true)
  }

  const confirmDelete = () => {
    if (deleteTarget === 'single' && editingGroup) {
      setGroups((prev) => prev.filter((item) => item.id !== editingGroup.id))
      setHasChanges(true)
      toast.success('Group deleted. Click "Save Settings" to apply.')
    } else if (deleteTarget === 'batch') {
      setGroups((prev) => prev.filter((item) => !selectedIds.includes(item.id)))
      setSelectedIds([])
      setHasChanges(true)
      toast.success(
        `${selectedIds.length} groups deleted. Click "Save Settings" to apply.`
      )
    }
    setShowDeleteDialog(false)
    setEditingGroup(null)
  }

  const handleSubmitForm = (values: UptimeKumaFormValues) => {
    if (editingGroup) {
      setGroups((prev) =>
        prev.map((item) =>
          item.id === editingGroup.id ? { ...item, ...values } : item
        )
      )
      toast.success('Group updated. Click "Save Settings" to apply.')
    } else {
      const newId = Math.max(...groups.map((item) => item.id), 0) + 1
      setGroups((prev) => [...prev, { id: newId, ...values }])
      toast.success('Group added. Click "Save Settings" to apply.')
    }
    setHasChanges(true)
    setShowDialog(false)
  }

  const handleSaveAll = async () => {
    try {
      await updateOption.mutateAsync({
        key: 'console_setting.uptime_kuma_groups',
        value: JSON.stringify(groups),
      })
      setHasChanges(false)
      toast.success('Uptime Kuma groups saved successfully')
    } catch {
      toast.error('Failed to save Uptime Kuma groups')
    }
  }

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? groups.map((item) => item.id) : [])
  }

  const toggleSelectOne = (id: number, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((item) => item !== id)
    )
  }

  return (
    <SettingsAccordion
      value='uptime-kuma'
      title='Uptime Kuma'
      description='Expose grouped Uptime Kuma status pages directly on the dashboard'
    >
      <div className='space-y-4'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <div className='flex flex-wrap items-center gap-2'>
            <Button onClick={handleAdd} size='sm'>
              <Plus className='mr-2 h-4 w-4' />
              Add Group
            </Button>
            <Button
              onClick={handleBatchDelete}
              size='sm'
              variant='destructive'
              disabled={selectedIds.length === 0}
            >
              <Trash2 className='mr-2 h-4 w-4' />
              Delete ({selectedIds.length})
            </Button>
            <Button
              onClick={handleSaveAll}
              size='sm'
              variant='secondary'
              disabled={!hasChanges || updateOption.isPending}
            >
              <Save className='mr-2 h-4 w-4' />
              {updateOption.isPending ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
          <div className='flex items-center gap-2'>
            <span className='text-muted-foreground text-sm'>Enabled</span>
            <Switch checked={isEnabled} onCheckedChange={handleToggleEnabled} />
          </div>
        </div>

        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-12'>
                  <Checkbox
                    checked={
                      selectedIds.length === groups.length && groups.length > 0
                    }
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Category Name</TableHead>
                <TableHead>Uptime Kuma URL</TableHead>
                <TableHead>Status Page Slug</TableHead>
                <TableHead className='w-32'>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className='h-24 text-center'>
                    No Uptime Kuma groups yet. Click "Add Group" to create one.
                  </TableCell>
                </TableRow>
              ) : (
                groups.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(group.id)}
                        onCheckedChange={(checked) =>
                          toggleSelectOne(group.id, checked as boolean)
                        }
                      />
                    </TableCell>
                    <TableCell className='font-medium'>
                      {group.categoryName}
                    </TableCell>
                    <TableCell
                      className='text-primary max-w-xs truncate font-mono text-sm'
                      title={group.url}
                    >
                      {group.url}
                    </TableCell>
                    <TableCell className='text-muted-foreground font-mono text-sm'>
                      {group.slug}
                    </TableCell>
                    <TableCell>
                      <div className='flex gap-2'>
                        <Button
                          onClick={() => handleEdit(group)}
                          size='sm'
                          variant='ghost'
                        >
                          <Edit className='h-4 w-4' />
                        </Button>
                        <Button
                          onClick={() => handleDelete(group)}
                          size='sm'
                          variant='ghost'
                        >
                          <Trash2 className='h-4 w-4' />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingGroup
                ? 'Edit Uptime Kuma Group'
                : 'Add Uptime Kuma Group'}
            </DialogTitle>
            <DialogDescription>
              Configure monitoring status page groups for the dashboard
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmitForm)}
              className='space-y-4'
            >
              <FormField
                control={form.control}
                name='categoryName'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='e.g., Core APIs, OpenAI, Claude'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Display name for this monitoring group (max 50 characters)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='url'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Uptime Kuma URL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='https://status.example.com'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Base URL of your Uptime Kuma instance
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='slug'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status Page Slug</FormLabel>
                    <FormControl>
                      <Input placeholder='my-status' {...field} />
                    </FormControl>
                    <FormDescription>
                      The slug is appended to the URL: {'{url}'}/status/
                      {'{slug}'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => setShowDialog(false)}
                >
                  Cancel
                </Button>
                <Button type='submit'>{editingGroup ? 'Update' : 'Add'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget === 'single'
                ? 'This Uptime Kuma group will be removed from the list.'
                : `${selectedIds.length} Uptime Kuma groups will be removed from the list.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsAccordion>
  )
}
