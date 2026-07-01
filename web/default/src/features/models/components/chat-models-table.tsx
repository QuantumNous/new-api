/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckSquare, Edit, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Combobox } from '@/components/ui/combobox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  batchCreateChatModels,
  createChatModel,
  deleteChatModel,
  listChatModelCandidates,
  listChatModels,
  updateChatModel,
} from '../api'
import { chatModelsQueryKeys } from '../lib'
import type { ChatModelOption } from '../types'

const PAGE_SIZE = 20

type ChatModelFormState = {
  id?: number
  model: string
  name: string
  enabled: boolean
  is_auto: boolean
  sort: number
}

const emptyForm: ChatModelFormState = {
  model: '',
  name: '',
  enabled: true,
  is_auto: false,
  sort: 0,
}

function formatPrice(price: number) {
  if (!Number.isFinite(price) || price <= 0) {
    return '-'
  }
  return `$${new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 6,
  }).format(price)}`
}

export function ChatModelsTable() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [enabledFilter, setEnabledFilter] = useState('all')
  const [availableFilter, setAvailableFilter] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<ChatModelFormState>(emptyForm)
  const [batchOpen, setBatchOpen] = useState(false)
  const [batchKeyword, setBatchKeyword] = useState('')
  const [selectedBatchModels, setSelectedBatchModels] = useState<string[]>([])
  const [deleteTarget, setDeleteTarget] = useState<ChatModelOption | null>(null)

  const listParams = useMemo(
    () => ({
      p: page,
      page_size: PAGE_SIZE,
      keyword: keyword.trim() || undefined,
      enabled:
        enabledFilter === 'all' ? undefined : enabledFilter === 'enabled',
      available:
        availableFilter === 'all' ? undefined : availableFilter === 'available',
    }),
    [availableFilter, enabledFilter, keyword, page]
  )

  const { data, isLoading, isFetching } = useQuery({
    queryKey: chatModelsQueryKeys.list(listParams),
    queryFn: () => listChatModels(listParams),
    placeholderData: (previousData) => previousData,
  })

  const { data: candidatesData } = useQuery({
    queryKey: chatModelsQueryKeys.candidates(),
    queryFn: () => listChatModelCandidates(),
  })

  const items = data?.data?.items ?? []
  const total = data?.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const candidates = useMemo(
    () => candidatesData?.data?.items ?? [],
    [candidatesData?.data?.items]
  )
  const candidateOptions = useMemo(
    () =>
      candidates.map((candidate) => ({
        value: candidate.model,
        label: `${candidate.model} · ${formatPrice(candidate.price)}${
          candidate.configured ? ` · ${t('Configured')}` : ''
        }`,
      })),
    [candidates, t]
  )
  const batchCandidates = useMemo(() => {
    const normalizedKeyword = batchKeyword.trim().toLowerCase()
    return candidates.filter((candidate) => {
      if (candidate.configured) return false
      if (!normalizedKeyword) return true
      return candidate.model.toLowerCase().includes(normalizedKeyword)
    })
  }, [batchKeyword, candidates])
  const selectedBatchSet = useMemo(
    () => new Set(selectedBatchModels),
    [selectedBatchModels]
  )

  const invalidateChatModels = () =>
    queryClient.invalidateQueries({ queryKey: chatModelsQueryKeys.all })

  const createMutation = useMutation({
    mutationFn: createChatModel,
    onSuccess: (response) => {
      if (!response.success) {
        toast.error(response.message || t('Failed to create chat model'))
        return
      }
      toast.success(t('Chat model created'))
      setFormOpen(false)
      void invalidateChatModels()
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('Request failed'))
    },
  })

  const batchCreateMutation = useMutation({
    mutationFn: batchCreateChatModels,
    onSuccess: (response) => {
      if (!response.success) {
        toast.error(response.message || t('Failed to batch add chat models'))
        return
      }
      const created = response.data?.created_count ?? 0
      const skipped = response.data?.skipped_count ?? 0
      toast.success(
        t('Batch added {{created}} chat model(s), skipped {{skipped}}', {
          created,
          skipped,
        })
      )
      setBatchOpen(false)
      setSelectedBatchModels([])
      setBatchKeyword('')
      void invalidateChatModels()
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('Request failed'))
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number
      payload: Partial<ChatModelFormState>
    }) => updateChatModel(id, payload),
    onSuccess: (response) => {
      if (!response.success) {
        toast.error(response.message || t('Failed to update chat model'))
        return
      }
      toast.success(t('Chat model updated'))
      setFormOpen(false)
      void invalidateChatModels()
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('Request failed'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteChatModel,
    onSuccess: (response) => {
      if (!response.success) {
        toast.error(response.message || t('Failed to delete chat model'))
        return
      }
      toast.success(t('Chat model deleted'))
      setDeleteTarget(null)
      void invalidateChatModels()
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('Request failed'))
    },
  })

  const openCreateDialog = () => {
    setForm(emptyForm)
    setFormOpen(true)
  }

  const openBatchDialog = () => {
    setSelectedBatchModels([])
    setBatchKeyword('')
    setBatchOpen(true)
  }

  const openEditDialog = (item: ChatModelOption) => {
    setForm({
      id: item.id,
      model: item.model,
      name: item.name,
      enabled: item.enabled,
      is_auto: item.is_auto,
      sort: item.sort,
    })
    setFormOpen(true)
  }

  const handleSubmit = () => {
    const modelName = form.model.trim()
    if (!modelName) {
      toast.error(t('Please select a model'))
      return
    }

    const payload = {
      model: modelName,
      name: form.name.trim(),
      enabled: form.enabled,
      is_auto: form.is_auto,
      sort: Number.isFinite(form.sort) ? form.sort : 0,
    }

    if (form.id) {
      updateMutation.mutate({ id: form.id, payload })
    } else {
      createMutation.mutate({ ...payload, model: modelName })
    }
  }

  const handleQuickUpdate = (
    item: ChatModelOption,
    payload: Partial<ChatModelFormState>
  ) => {
    updateMutation.mutate({ id: item.id, payload })
  }

  const toggleBatchModel = (modelName: string, checked: boolean) => {
    setSelectedBatchModels((current) => {
      if (checked) {
        return current.includes(modelName) ? current : [...current, modelName]
      }
      return current.filter((item) => item !== modelName)
    })
  }

  const selectFilteredBatchModels = () => {
    const filteredModels = batchCandidates.map((candidate) => candidate.model)
    setSelectedBatchModels((current) => [
      ...current,
      ...filteredModels.filter((modelName) => !current.includes(modelName)),
    ])
  }

  const selectAllBatchModels = () => {
    setSelectedBatchModels(
      candidates
        .filter((candidate) => !candidate.configured)
        .map((candidate) => candidate.model)
    )
  }

  const clearFilteredBatchModels = () => {
    const filteredModels = new Set(
      batchCandidates.map((candidate) => candidate.model)
    )
    setSelectedBatchModels((current) =>
      current.filter((modelName) => !filteredModels.has(modelName))
    )
  }

  const handleBatchSubmit = () => {
    if (selectedBatchModels.length === 0) {
      toast.error(t('Please select at least one model'))
      return
    }
    batchCreateMutation.mutate({ models: selectedBatchModels })
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending
  const isBatchSubmitting = batchCreateMutation.isPending

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex flex-1 flex-col gap-2 sm:flex-row sm:items-center'>
          <Input
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value)
              setPage(1)
            }}
            placeholder={t('Search chat models...')}
            className='sm:max-w-xs'
          />
          <Select
            value={enabledFilter}
            onValueChange={(value) => {
              setEnabledFilter(value ?? 'all')
              setPage(1)
            }}
          >
            <SelectTrigger className='w-full sm:w-36'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                <SelectItem value='all'>{t('All states')}</SelectItem>
                <SelectItem value='enabled'>{t('Enabled')}</SelectItem>
                <SelectItem value='disabled'>{t('Disabled')}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select
            value={availableFilter}
            onValueChange={(value) => {
              setAvailableFilter(value ?? 'all')
              setPage(1)
            }}
          >
            <SelectTrigger className='w-full sm:w-40'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                <SelectItem value='all'>{t('All availability')}</SelectItem>
                <SelectItem value='available'>{t('Available')}</SelectItem>
                <SelectItem value='unavailable'>{t('Unavailable')}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className='flex items-center gap-2'>
          <Button onClick={openBatchDialog} variant='outline' size='sm'>
            <CheckSquare className='h-4 w-4' />
            {t('Batch Add')}
          </Button>
          <Button onClick={openCreateDialog} size='sm'>
            <Plus className='h-4 w-4' />
            {t('Add Chat Model')}
          </Button>
        </div>
      </div>

      <div className='rounded-lg border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Model')}</TableHead>
              <TableHead>{t('Display Name')}</TableHead>
              <TableHead>{t('Price')}</TableHead>
              <TableHead>{t('Status')}</TableHead>
              <TableHead>{t('Auto')}</TableHead>
              <TableHead>{t('Sort')}</TableHead>
              <TableHead className='text-right'>{t('Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <div className='flex h-32 items-center justify-center'>
                    <Spinner />
                  </div>
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Empty className='border-0'>
                    <EmptyHeader>
                      <EmptyTitle>{t('No chat models found')}</EmptyTitle>
                      <EmptyDescription>{t('Add Chat Model')}</EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <Button onClick={openCreateDialog} size='sm'>
                        <Plus className='h-4 w-4' />
                        {t('Add Chat Model')}
                      </Button>
                    </EmptyContent>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className='font-mono text-xs'>
                    {item.model}
                  </TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{formatPrice(item.price)}</TableCell>
                  <TableCell>
                    <div className='flex items-center gap-2'>
                      <Switch
                        size='sm'
                        checked={item.enabled}
                        disabled={updateMutation.isPending}
                        onCheckedChange={(checked) =>
                          handleQuickUpdate(item, { enabled: checked })
                        }
                      />
                      <Badge
                        variant={item.available ? 'secondary' : 'destructive'}
                      >
                        {item.available ? t('Available') : t('Unavailable')}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      size='sm'
                      checked={item.is_auto}
                      disabled={updateMutation.isPending || !item.available}
                      onCheckedChange={(checked) =>
                        handleQuickUpdate(item, { is_auto: checked })
                      }
                    />
                  </TableCell>
                  <TableCell>{item.sort}</TableCell>
                  <TableCell>
                    <div className='flex justify-end gap-1'>
                      <Button
                        variant='ghost'
                        size='icon-sm'
                        onClick={() => openEditDialog(item)}
                        aria-label={t('Edit')}
                      >
                        <Edit className='h-4 w-4' />
                      </Button>
                      <Button
                        variant='ghost'
                        size='icon-sm'
                        onClick={() => setDeleteTarget(item)}
                        aria-label={t('Delete')}
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

      <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
        <div className='text-muted-foreground text-sm'>
          {t('{{count}} item(s)', { count: total })}
          {isFetching ? ` · ${t('Loading')}` : ''}
        </div>
        <div className='flex items-center justify-end gap-2'>
          <Button
            variant='outline'
            size='sm'
            disabled={page <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            {t('Previous')}
          </Button>
          <span className='text-muted-foreground min-w-16 text-center text-sm'>
            {page} / {pageCount}
          </span>
          <Button
            variant='outline'
            size='sm'
            disabled={page >= pageCount}
            onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
          >
            {t('Next')}
          </Button>
        </div>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>
              {form.id ? t('Edit Chat Model') : t('Add Chat Model')}
            </DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>{t('Model')}</FieldLabel>
              <Combobox
                options={candidateOptions}
                value={form.model}
                onValueChange={(value) => {
                  const selected = candidates.find(
                    (candidate) => candidate.model === value
                  )
                  setForm((current) => ({
                    ...current,
                    model: value ?? '',
                    name:
                      !current.name || current.name === current.model
                        ? selected?.name || value || ''
                        : current.name,
                  }))
                }}
                placeholder={t('Select model')}
                emptyText={t('No model found.')}
              />
            </Field>
            <Field>
              <FieldLabel>{t('Display Name')}</FieldLabel>
              <Input
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </Field>
            <Field>
              <FieldLabel>{t('Sort')}</FieldLabel>
              <Input
                type='number'
                value={form.sort}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    sort: Number(event.target.value),
                  }))
                }
              />
            </Field>
            <Field orientation='horizontal'>
              <Switch
                checked={form.enabled}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, enabled: checked }))
                }
              />
              <FieldLabel>{t('Enabled')}</FieldLabel>
            </Field>
            <Field orientation='horizontal'>
              <Switch
                checked={form.is_auto}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, is_auto: checked }))
                }
              />
              <FieldLabel>{t('Auto')}</FieldLabel>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant='outline' onClick={() => setFormOpen(false)}>
              {t('Cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Spinner data-icon='inline-start' />}
              {form.id ? t('Save changes') : t('Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
        <DialogContent className='sm:max-w-2xl'>
          <DialogHeader>
            <DialogTitle>{t('Batch Add Chat Models')}</DialogTitle>
          </DialogHeader>
          <div className='flex flex-col gap-4'>
            <div className='text-muted-foreground text-sm'>
              {t('Selected chat models will be added disabled.')}
            </div>
            <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
              <Input
                value={batchKeyword}
                onChange={(event) => setBatchKeyword(event.target.value)}
                placeholder={t('Search available models...')}
                className='sm:max-w-xs'
              />
              <div className='flex items-center gap-2'>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={selectAllBatchModels}
                  disabled={candidates.every(
                    (candidate) => candidate.configured
                  )}
                >
                  {t('Select all')}
                </Button>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={selectFilteredBatchModels}
                  disabled={batchCandidates.length === 0}
                >
                  {t('Select filtered')}
                </Button>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={clearFilteredBatchModels}
                  disabled={batchCandidates.length === 0}
                >
                  {t('Clear filtered')}
                </Button>
              </div>
            </div>
            <ScrollArea className='bg-muted/40 h-80 rounded-md p-1'>
              {batchCandidates.length === 0 ? (
                <Empty className='border-0'>
                  <EmptyHeader>
                    <EmptyTitle>{t('No available models')}</EmptyTitle>
                    <EmptyDescription>
                      {t('All available chat models are already configured.')}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className='flex flex-col'>
                  {batchCandidates.map((candidate) => {
                    const checked = selectedBatchSet.has(candidate.model)
                    return (
                      <label
                        key={candidate.model}
                        className='hover:bg-background flex cursor-pointer items-center gap-3 rounded-md px-3 py-2'
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) =>
                            toggleBatchModel(candidate.model, value === true)
                          }
                        />
                        <span className='min-w-0 flex-1'>
                          <span className='block truncate font-mono text-xs'>
                            {candidate.model}
                          </span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
            <div className='text-muted-foreground text-sm'>
              {t('{{count}} model(s) selected', {
                count: selectedBatchModels.length,
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setBatchOpen(false)}>
              {t('Cancel')}
            </Button>
            <Button
              onClick={handleBatchSubmit}
              disabled={isBatchSubmitting || selectedBatchModels.length === 0}
            >
              {isBatchSubmitting && <Spinner data-icon='inline-start' />}
              {t('Add Disabled')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Delete Chat Model')}</DialogTitle>
          </DialogHeader>
          <div className='text-muted-foreground text-sm'>
            {t('Delete {{name}}?', { name: deleteTarget?.name ?? '' })}
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDeleteTarget(null)}>
              {t('Cancel')}
            </Button>
            <Button
              variant='destructive'
              disabled={!deleteTarget || deleteMutation.isPending}
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
            >
              {deleteMutation.isPending && <Spinner data-icon='inline-start' />}
              {t('Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
