import { useEffect, useState } from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Edit, Trash2, Save } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/status-badge'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

type ApiInfo = {
  id: number
  url: string
  route: string
  description: string
  color: string
}

type ApiInfoSectionProps = {
  enabled: boolean
  data: string
}

const createApiInfoSchema = (t: (key: string) => string) =>
  z.object({
    url: z.string().url(t('Must be a valid URL')),
    route: z.string().min(1, t('Route is required')),
    description: z.string().min(1, t('Description is required')),
    color: z.string().min(1, t('Color is required')),
  })

type ApiInfoFormValues = z.infer<ReturnType<typeof createApiInfoSchema>>

const colorOptions = [
  { value: 'blue', label: 'Blue', bgClass: 'bg-blue-500' },
  { value: 'green', label: 'Green', bgClass: 'bg-green-500' },
  { value: 'cyan', label: 'Cyan', bgClass: 'bg-cyan-500' },
  { value: 'purple', label: 'Purple', bgClass: 'bg-purple-500' },
  { value: 'pink', label: 'Pink', bgClass: 'bg-pink-500' },
  { value: 'red', label: 'Red', bgClass: 'bg-red-500' },
  { value: 'orange', label: 'Orange', bgClass: 'bg-orange-500' },
  { value: 'amber', label: 'Amber', bgClass: 'bg-amber-500' },
  { value: 'yellow', label: 'Yellow', bgClass: 'bg-yellow-500' },
  { value: 'lime', label: 'Lime', bgClass: 'bg-lime-500' },
  { value: 'teal', label: 'Teal', bgClass: 'bg-teal-500' },
  { value: 'indigo', label: 'Indigo', bgClass: 'bg-indigo-500' },
  { value: 'violet', label: 'Violet', bgClass: 'bg-violet-500' },
  { value: 'slate', label: 'Slate', bgClass: 'bg-slate-500' },
]

export function ApiInfoSection({ enabled, data }: ApiInfoSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const apiInfoSchema = createApiInfoSchema(t)
  const [apiInfoList, setApiInfoList] = useState<ApiInfo[]>([])
  const [isEnabled, setIsEnabled] = useState(enabled)
  const [hasChanges, setHasChanges] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [showDialog, setShowDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [editingApiInfo, setEditingApiInfo] = useState<ApiInfo | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<'single' | 'batch'>('single')

  const form = useForm<ApiInfoFormValues>({
    resolver: zodResolver(apiInfoSchema),
    defaultValues: {
      url: '',
      route: '',
      description: '',
      color: 'blue',
    },
  })

  useEffect(() => {
    try {
      const parsed = JSON.parse(data || '[]')
      if (Array.isArray(parsed)) {
        setApiInfoList(
          parsed.map((item, idx) => ({
            ...item,
            id: item.id || idx + 1,
          }))
        )
      }
    } catch {
      setApiInfoList([])
    }
  }, [data])

  useEffect(() => {
    setIsEnabled(enabled)
  }, [enabled])

  const handleToggleEnabled = async (checked: boolean) => {
    try {
      await updateOption.mutateAsync({
        key: 'console_setting.api_info_enabled',
        value: checked,
      })
      setIsEnabled(checked)
      toast.success(t('Setting saved'))
    } catch {
      toast.error(t('Failed to update setting'))
    }
  }

  const handleAdd = () => {
    setEditingApiInfo(null)
    form.reset({
      url: '',
      route: '',
      description: '',
      color: 'blue',
    })
    setShowDialog(true)
  }

  const handleEdit = (apiInfo: ApiInfo) => {
    setEditingApiInfo(apiInfo)
    form.reset({
      url: apiInfo.url,
      route: apiInfo.route,
      description: apiInfo.description,
      color: apiInfo.color,
    })
    setShowDialog(true)
  }

  const handleDelete = (apiInfo: ApiInfo) => {
    setEditingApiInfo(apiInfo)
    setDeleteTarget('single')
    setShowDeleteDialog(true)
  }

  const handleBatchDelete = () => {
    if (selectedIds.length === 0) {
      toast.error(t('Please select items to delete'))
      return
    }
    setDeleteTarget('batch')
    setShowDeleteDialog(true)
  }

  const confirmDelete = () => {
    if (deleteTarget === 'single' && editingApiInfo) {
      setApiInfoList((prev) =>
        prev.filter((item) => item.id !== editingApiInfo.id)
      )
      setHasChanges(true)
      toast.success(t('API info deleted. Click "Save Settings" to apply.'))
    } else if (deleteTarget === 'batch') {
      setApiInfoList((prev) =>
        prev.filter((item) => !selectedIds.includes(item.id))
      )
      setSelectedIds([])
      setHasChanges(true)
      toast.success(
        t('{{count}} API entries deleted. Click "Save Settings" to apply.', {
          count: selectedIds.length,
        })
      )
    }
    setShowDeleteDialog(false)
    setEditingApiInfo(null)
  }

  const handleSubmitForm = (values: ApiInfoFormValues) => {
    if (editingApiInfo) {
      setApiInfoList((prev) =>
        prev.map((item) =>
          item.id === editingApiInfo.id ? { ...item, ...values } : item
        )
      )
      toast.success(t('API info updated. Click "Save Settings" to apply.'))
    } else {
      const newId = Math.max(...apiInfoList.map((item) => item.id), 0) + 1
      setApiInfoList((prev) => [...prev, { id: newId, ...values }])
      toast.success(t('API info added. Click "Save Settings" to apply.'))
    }
    setHasChanges(true)
    setShowDialog(false)
  }

  const handleSaveAll = async () => {
    try {
      await updateOption.mutateAsync({
        key: 'console_setting.api_info',
        value: JSON.stringify(apiInfoList),
      })
      setHasChanges(false)
      toast.success(t('API info saved successfully'))
    } catch {
      toast.error(t('Failed to save API info'))
    }
  }

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? apiInfoList.map((item) => item.id) : [])
  }

  const toggleSelectOne = (id: number, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((item) => item !== id)
    )
  }

  const getColorClass = (color: string) => {
    return (
      colorOptions.find((opt) => opt.value === color)?.bgClass || 'bg-blue-500'
    )
  }

  return (
    <SettingsSection
      title={t('API Addresses')}
      description={t('Curate quick links to your different Domains')}
    >
      <div className='space-y-4'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <div className='flex flex-wrap items-center gap-2'>
            <Button onClick={handleAdd} size='sm'>
              <Plus className='mr-2 h-4 w-4' />
              {t('Add API')}
            </Button>
            <Button
              onClick={handleBatchDelete}
              size='sm'
              variant='destructive'
              disabled={selectedIds.length === 0}
            >
              <Trash2 className='mr-2 h-4 w-4' />
              {t('Delete (')}
              {selectedIds.length})
            </Button>
            <Button
              onClick={handleSaveAll}
              size='sm'
              variant='secondary'
              disabled={!hasChanges || updateOption.isPending}
            >
              <Save className='mr-2 h-4 w-4' />
              {updateOption.isPending ? t('Saving...') : t('Save Settings')}
            </Button>
          </div>
          <div className='flex items-center gap-2'>
            <span className='text-muted-foreground text-sm'>
              {t('Enabled')}
            </span>
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
                      selectedIds.length === apiInfoList.length &&
                      apiInfoList.length > 0
                    }
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>{t('URL')}</TableHead>
                <TableHead>{t('Route')}</TableHead>
                <TableHead>{t('Description')}</TableHead>
                <TableHead>{t('Color')}</TableHead>
                <TableHead className='w-32'>{t('Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apiInfoList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className='h-24 text-center'>
                    {t('No API Domains yet. Click "Add API" to create one.')}
                  </TableCell>
                </TableRow>
              ) : (
                apiInfoList.map((apiInfo) => (
                  <TableRow key={apiInfo.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(apiInfo.id)}
                        onCheckedChange={(checked) =>
                          toggleSelectOne(apiInfo.id, checked as boolean)
                        }
                      />
                    </TableCell>
                    <TableCell
                      className='max-w-xs truncate font-mono text-sm'
                      title={apiInfo.url}
                    >
                      <StatusBadge
                        label={apiInfo.url}
                        variant='neutral'
                        copyable={false}
                      />
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        label={apiInfo.route}
                        variant='neutral'
                        copyable={false}
                      />
                    </TableCell>
                    <TableCell
                      className='max-w-xs truncate'
                      title={apiInfo.description}
                    >
                      {apiInfo.description}
                    </TableCell>
                    <TableCell>
                      <div className='flex items-center gap-2'>
                        <div
                          className={`h-4 w-4 rounded-full ${getColorClass(apiInfo.color)}`}
                        />
                        <span className='text-sm capitalize'>
                          {apiInfo.color}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className='flex gap-2'>
                        <Button
                          onClick={() => handleEdit(apiInfo)}
                          size='sm'
                          variant='ghost'
                        >
                          <Edit className='h-4 w-4' />
                        </Button>
                        <Button
                          onClick={() => handleDelete(apiInfo)}
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
              {editingApiInfo ? t('Edit API Shortcut') : t('Add API Shortcut')}
            </DialogTitle>
            <DialogDescription>
              {t('Configure API documentation links for the dashboard')}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmitForm)}
              className='space-y-4'
            >
              <FormField
                control={form.control}
                name='url'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('API URL')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('https://api.example.com')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='route'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Route Description')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('e.g., CN2 GIA')} {...field} />
                    </FormControl>
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
                      <Input
                        placeholder={t(
                          'e.g., Recommended for China Mainland Users'
                        )}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='color'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Badge Color')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('Select a color')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {colorOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className='flex items-center gap-2'>
                              <div
                                className={`h-4 w-4 rounded-full ${option.bgClass}`}
                              />
                              {option.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {t('Visual indicator color for the API card')}
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
                  {t('Cancel')}
                </Button>
                <Button type='submit'>
                  {editingApiInfo ? t('Update') : t('Add')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Are you sure?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget === 'single'
                ? 'This API shortcut will be removed from the list.'
                : `${selectedIds.length} API shortcuts will be removed from the list.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              {t('Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsSection>
  )
}
