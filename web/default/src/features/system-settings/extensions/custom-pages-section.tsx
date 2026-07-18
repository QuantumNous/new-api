/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
    70|but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import * as z from 'zod'

import { StaticDataTable } from '@/components/data-table/static/static-data-table'
import { StaticRowActions } from '@/components/data-table/static/static-row-actions'
import { Dialog } from '@/components/dialog'
import { StatusBadge } from '@/components/status-badge'
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
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import {
  CUSTOM_PAGE_ICON_OPTIONS,
  CUSTOM_PAGE_OPEN_MODES,
  DEFAULT_CUSTOM_PAGE_ICON,
  DEFAULT_CUSTOM_PAGE_OPEN_MODE,
  DEFAULT_EXTENSION_VISIBILITY,
  EXTENSION_VISIBILITY_OPTIONS,
  createCustomPageId,
  resolveCustomPageIcon,
  resolveCustomPageOpenMode,
  resolveExtensionVisibility,
  type CustomPage,
} from './constants'

type CustomPagesSectionProps = {
  data: string
}

const customPageSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(100, 'Title must be less than 100 characters'),
  icon: z.string().min(1, 'Icon is required'),
  url: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || /^https?:\/\//i.test(value),
      'URL must start with http:// or https://'
    )
    .max(500, 'URL must be less than 500 characters'),
  open_mode: z.enum(['embed', 'external']),
  visibility: z.enum(['all', 'admin']),
  enabled: z.boolean(),
  sort: z.number().int(),
})

type CustomPageFormValues = z.infer<typeof customPageSchema>

const CUSTOM_PAGE_FORM_ID = 'custom-page-form'

function parseCustomPages(data: string): CustomPage[] {
  try {
    const parsed = JSON.parse(data || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.map((item, idx) => ({
      id:
        typeof item?.id === 'string' && item.id.trim()
          ? item.id.trim()
          : createCustomPageId(),
      title: typeof item?.title === 'string' ? item.title : '',
      icon:
        typeof item?.icon === 'string' && item.icon.trim()
          ? item.icon
          : DEFAULT_CUSTOM_PAGE_ICON,
      url: typeof item?.url === 'string' ? item.url : '',
      open_mode: resolveCustomPageOpenMode(item?.open_mode),
      visibility: resolveExtensionVisibility(item?.visibility),
      enabled: Boolean(item?.enabled),
      sort: Number.isFinite(Number(item?.sort)) ? Number(item.sort) : idx,
    }))
  } catch {
    return []
  }
}

export function CustomPagesSection(props: CustomPagesSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [pages, setPages] = useState<CustomPage[]>([])
  const [hasChanges, setHasChanges] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [showDialog, setShowDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [editingPage, setEditingPage] = useState<CustomPage | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<'single' | 'batch'>('single')

  const form = useForm<CustomPageFormValues>({
    resolver: zodResolver(customPageSchema),
    defaultValues: {
      title: '',
      icon: DEFAULT_CUSTOM_PAGE_ICON,
      url: '',
      open_mode: DEFAULT_CUSTOM_PAGE_OPEN_MODE,
      visibility: DEFAULT_EXTENSION_VISIBILITY,
      enabled: true,
      sort: 0,
    },
  })

  useEffect(() => {
    setPages(parseCustomPages(props.data))
    setHasChanges(false)
    setSelectedIds([])
  }, [props.data])

  const sortedPages = useMemo(
    () =>
      [...pages].sort((a, b) => {
        if (a.sort !== b.sort) return a.sort - b.sort
        return a.id.localeCompare(b.id)
      }),
    [pages]
  )

  const handleAdd = () => {
    setEditingPage(null)
    const nextSort =
      pages.reduce((max, page) => Math.max(max, page.sort), -1) + 1
    form.reset({
      title: '',
      icon: DEFAULT_CUSTOM_PAGE_ICON,
      url: '',
      open_mode: DEFAULT_CUSTOM_PAGE_OPEN_MODE,
      visibility: DEFAULT_EXTENSION_VISIBILITY,
      enabled: true,
      sort: nextSort,
    })
    setShowDialog(true)
  }

  const handleEdit = (page: CustomPage) => {
    setEditingPage(page)
    form.reset({
      title: page.title,
      icon: page.icon || DEFAULT_CUSTOM_PAGE_ICON,
      url: page.url,
      open_mode: page.open_mode || DEFAULT_CUSTOM_PAGE_OPEN_MODE,
      visibility: page.visibility || DEFAULT_EXTENSION_VISIBILITY,
      enabled: page.enabled,
      sort: page.sort,
    })
    setShowDialog(true)
  }

  const handleDelete = (page: CustomPage) => {
    setEditingPage(page)
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
    if (deleteTarget === 'single' && editingPage) {
      setPages((prev) => prev.filter((item) => item.id !== editingPage.id))
      setHasChanges(true)
      toast.success(
        t('Custom page deleted. Click "Save Settings" to apply.')
      )
    } else if (deleteTarget === 'batch') {
      setPages((prev) =>
        prev.filter((item) => !selectedIds.includes(item.id))
      )
      setSelectedIds([])
      setHasChanges(true)
      toast.success(
        t(
          '{{count}} custom pages deleted. Click "Save Settings" to apply.',
          { count: selectedIds.length }
        )
      )
    }
    setShowDeleteDialog(false)
    setEditingPage(null)
  }

  const handleSubmitForm = (values: CustomPageFormValues) => {
    if (editingPage) {
      setPages((prev) =>
        prev.map((item) =>
          item.id === editingPage.id ? { ...item, ...values } : item
        )
      )
      toast.success(
        t('Custom page updated. Click "Save Settings" to apply.')
      )
    } else {
      setPages((prev) => [
        ...prev,
        {
          id: createCustomPageId(),
          ...values,
        },
      ])
      toast.success(t('Custom page added. Click "Save Settings" to apply.'))
    }
    setHasChanges(true)
    setShowDialog(false)
  }

  const handleSaveAll = async () => {
    try {
      await updateOption.mutateAsync({
        key: 'console_setting.custom_pages',
        value: JSON.stringify(pages),
      })
      setHasChanges(false)
      toast.success(t('Custom pages saved successfully'))
    } catch {
      toast.error(t('Failed to save custom pages'))
    }
  }

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? sortedPages.map((item) => item.id) : [])
  }

  const toggleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((item) => item !== id)
    )
  }

  return (
    <SettingsSection title={t('Custom Pages')}>
      <div className='space-y-4'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <div className='flex flex-wrap items-center gap-2'>
            <Button onClick={handleAdd} size='sm'>
              <Plus className='mr-2 h-4 w-4' />
              {t('Add Custom Page')}
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
        </div>

        <p className='text-muted-foreground text-sm'>
          {t(
            'Enabled pages with a URL appear under the Extensions group in the console sidebar and open as embedded pages.'
          )}
        </p>

        <StaticDataTable
          data={sortedPages}
          getRowKey={(page) => page.id}
          emptyContent={t(
            'No custom pages yet. Click "Add Custom Page" to create one.'
          )}
          columns={[
            {
              id: 'select',
              header: (
                <Checkbox
                  checked={
                    selectedIds.length === sortedPages.length &&
                    sortedPages.length > 0
                  }
                  onCheckedChange={toggleSelectAll}
                />
              ),
              className: 'w-12',
              cell: (page) => (
                <Checkbox
                  checked={selectedIds.includes(page.id)}
                  onCheckedChange={(checked) =>
                    toggleSelectOne(page.id, checked as boolean)
                  }
                />
              ),
            },
            {
              id: 'title',
              header: t('Title'),
              cellClassName: 'max-w-xs truncate font-medium',
              cell: (page) => {
                const Icon = resolveCustomPageIcon(page.icon)
                return (
                  <span className='inline-flex items-center gap-2'>
                    <Icon className='text-muted-foreground h-4 w-4 shrink-0' />
                    <span className='truncate'>{page.title}</span>
                  </span>
                )
              },
            },
            {
              id: 'url',
              header: t('URL'),
              cellClassName: 'text-muted-foreground max-w-md truncate',
              cell: (page) => page.url || '—',
            },
            {
              id: 'open_mode',
              header: t('Open mode'),
              className: 'w-36',
              cell: (page) =>
                page.open_mode === 'external'
                  ? t('Open in new tab')
                  : t('Embed in console'),
            },
            {
              id: 'visibility',
              header: t('Visibility'),
              className: 'w-32',
              cell: (page) =>
                page.visibility === 'admin'
                  ? t('Admins only')
                  : t('Everyone'),
            },
            {
              id: 'sort',
              header: t('Sort'),
              className: 'w-20',
              cell: (page) => page.sort,
            },
            {
              id: 'enabled',
              header: t('Status'),
              className: 'w-28',
              cell: (page) => (
                <StatusBadge
                  label={page.enabled ? t('Enabled') : t('Disabled')}
                  variant={page.enabled ? 'success' : 'neutral'}
                  copyable={false}
                />
              ),
            },
            {
              id: 'actions',
              header: t('Actions'),
              cell: (page) => (
                <StaticRowActions
                  editLabel={t('Edit')}
                  deleteLabel={t('Delete')}
                  menuLabel={t('Open menu')}
                  onEdit={() => handleEdit(page)}
                  onDelete={() => handleDelete(page)}
                />
              ),
            },
          ]}
        />
      </div>

      <Dialog
        open={showDialog}
        onOpenChange={setShowDialog}
        title={editingPage ? t('Edit Custom Page') : t('Add Custom Page')}
        description={t(
          'Configure the sidebar title, icon, URL, open mode, status, and sort order.'
        )}
        contentClassName='max-w-2xl'
        contentHeight='auto'
        bodyClassName='space-y-4'
        footer={
          <>
            <Button
              type='button'
              variant='outline'
              onClick={() => setShowDialog(false)}
            >
              {t('Cancel')}
            </Button>
            <Button type='submit' form={CUSTOM_PAGE_FORM_ID}>
              {editingPage ? t('Update') : t('Add')}
            </Button>
          </>
        }
      >
        <Form {...form}>
          <form
            id={CUSTOM_PAGE_FORM_ID}
            onSubmit={form.handleSubmit(handleSubmitForm)}
            className='space-y-4'
          >
            <FormField
              control={form.control}
              name='title'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Title')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('Documentation')} {...field} />
                  </FormControl>
                  <FormDescription>
                    {t('Shown in the console sidebar. Maximum 100 characters.')}
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
                  <FormLabel>{t('Icon')}</FormLabel>
                  <Select
                    items={CUSTOM_PAGE_ICON_OPTIONS.map((option) => ({
                      value: option.value,
                      label: (
                        <div className='flex items-center gap-2'>
                          <option.icon className='h-4 w-4' />
                          {option.value}
                        </div>
                      ),
                    }))}
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('Select an icon')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {CUSTOM_PAGE_ICON_OPTIONS.map((option) => {
                          const Icon = option.icon
                          return (
                            <SelectItem key={option.value} value={option.value}>
                              <div className='flex items-center gap-2'>
                                <Icon className='h-4 w-4' />
                                {option.value}
                              </div>
                            </SelectItem>
                          )
                        })}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='url'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('URL')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='https://example.com/docs'
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Must be http(s). Leave empty to keep the page hidden from the sidebar.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='open_mode'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Open mode')}</FormLabel>
                  <Select
                    items={CUSTOM_PAGE_OPEN_MODES.map((option) => ({
                      value: option.value,
                      label: t(option.labelKey),
                    }))}
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('Select open mode')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {CUSTOM_PAGE_OPEN_MODES.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {t(option.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {t(
                      'Use “Open in new tab” for sites that block iframe embedding (for example Taobao / Xianyu short links).'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='visibility'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Visibility')}</FormLabel>
                  <Select
                    items={EXTENSION_VISIBILITY_OPTIONS.map((option) => ({
                      value: option.value,
                      label: t(option.labelKey),
                    }))}
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('Select visibility')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {EXTENSION_VISIBILITY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {t(option.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {t(
                      'Choose who can see this page in the Extensions sidebar.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='sort'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Sort')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      value={Number.isFinite(field.value) ? field.value : 0}
                      onChange={(event) => {
                        const next = event.target.valueAsNumber
                        field.onChange(Number.isFinite(next) ? next : 0)
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Lower numbers appear first in the sidebar.')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='enabled'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between rounded-lg border p-3'>
                  <div className='space-y-0.5'>
                    <FormLabel>{t('Enabled')}</FormLabel>
                    <FormDescription>
                      {t(
                        'Only enabled pages with a URL are shown in the Extensions sidebar group.'
                      )}
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
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Are you sure?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget === 'single'
                ? t('This custom page will be removed from the list.')
                : t(
                    '{{count}} custom pages will be removed from the list.',
                    { count: selectedIds.length }
                  )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction variant='destructive' onClick={confirmDelete}>
              {t('Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsSection>
  )
}
