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
import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit, MoreHorizontal, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { formatTimestamp } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  deletePromptGalleryItem,
  getPromptGalleryItems,
  setPromptGalleryItemEnabled,
} from '../api'
import {
  PROMPT_GALLERY_CATEGORIES,
  PROMPT_GALLERY_CATEGORY_LABEL_KEYS,
  itemToFormData,
  type PromptLibraryAdminItem,
} from '../types'

const PAGE_SIZE = 20
const ALL_CATEGORIES = 'all'
const KEYWORD_DEBOUNCE_MS = 400

type PromptGalleryTableProps = {
  onEdit: (item: PromptLibraryAdminItem) => void
}

export function PromptGalleryTable({ onEdit }: PromptGalleryTableProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [category, setCategory] = useState(ALL_CATEGORIES)
  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')
  // Commit the keyword and the page reset together once typing settles, so no
  // interim request goes out with the new page but the old keyword.
  const keywordTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const committedKeyword = useRef('')
  useEffect(
    () => () => {
      if (keywordTimer.current) clearTimeout(keywordTimer.current)
    },
    []
  )
  const [deleteTarget, setDeleteTarget] =
    useState<PromptLibraryAdminItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  // Ids whose enabled toggle is in flight; their Switch is disabled so a
  // double click cannot fire overlapping mutations for the same row.
  const [togglingIds, setTogglingIds] = useState<ReadonlySet<number>>(
    () => new Set()
  )

  const effectiveCategory = category === ALL_CATEGORIES ? '' : category

  const handleKeywordChange = (value: string) => {
    setKeywordInput(value)
    if (keywordTimer.current) clearTimeout(keywordTimer.current)
    keywordTimer.current = setTimeout(() => {
      if (committedKeyword.current !== value) {
        committedKeyword.current = value
        setKeyword(value)
        setPage(1)
      }
    }, KEYWORD_DEBOUNCE_MS)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['prompt-gallery', page, effectiveCategory, keyword],
    queryFn: async () => {
      const result = await getPromptGalleryItems({
        p: page,
        page_size: PAGE_SIZE,
        category: effectiveCategory,
        keyword,
      })
      return {
        items: result.data?.items ?? [],
        total: result.data?.total ?? 0,
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  // Render-phase state adjustment (the React-documented alternative to a
  // setState-in-effect): a concurrent shrink of the list can leave `page`
  // past the end ("Page 3 of 2"); clamp as soon as the new total arrives.
  // Guarded so it fires at most once per data change — no loop.
  if (!isLoading && data && page > pageCount) {
    setPage(pageCount)
  }

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['prompt-gallery'] })

  const handleToggleEnabled = async (item: PromptLibraryAdminItem) => {
    if (togglingIds.has(item.id)) return
    setTogglingIds((prev) => new Set(prev).add(item.id))
    try {
      // Single-column endpoint: cannot clobber concurrent full-row edits.
      const result = await setPromptGalleryItemEnabled(item.id, !item.enabled)
      if (result.success) {
        toast.success(t('Updated successfully'))
        invalidate()
      }
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      const result = await deletePromptGalleryItem(deleteTarget.id)
      if (result.success) {
        toast.success(t('Deleted successfully'))
        setDeleteTarget(null)
        // Deleting the only row of a later page leaves it empty — step back
        // before refetching so we do not fetch a page we know is now empty.
        if (items.length === 1 && page > 1) {
          setPage(page - 1)
        }
        invalidate()
      }
    } finally {
      setIsDeleting(false)
    }
  }

  const resetToFirstPage = () => setPage(1)

  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <Select
          value={category}
          onValueChange={(value) => {
            setCategory(value ?? ALL_CATEGORIES)
            resetToFirstPage()
          }}
        >
          <SelectTrigger className='w-40'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CATEGORIES}>
              {t('All categories')}
            </SelectItem>
            {PROMPT_GALLERY_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {t(PROMPT_GALLERY_CATEGORY_LABEL_KEYS[c])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className='w-64'
          value={keywordInput}
          onChange={(e) => handleKeywordChange(e.target.value)}
          placeholder={t('Search by keyword...')}
        />
      </div>

      <div className='overflow-x-auto rounded-lg border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-16'>{t('Preview')}</TableHead>
              <TableHead>{t('Slug')}</TableHead>
              <TableHead>{t('Title')}</TableHead>
              <TableHead>{t('Category')}</TableHead>
              <TableHead>{t('Tags')}</TableHead>
              <TableHead>{t('Enabled')}</TableHead>
              <TableHead>{t('Updated')}</TableHead>
              <TableHead className='w-12' />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className='text-muted-foreground h-24 text-center'
                >
                  {t('Loading...')}
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className='text-muted-foreground h-24 text-center'
                >
                  {t('No prompts found')}
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const form = itemToFormData(item)
                const tags = form.tags
                  ? form.tags.split(',').map((tag) => tag.trim())
                  : []
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      {form.imageUrl ? (
                        <img
                          src={form.imageUrl}
                          alt={form.imageAlt || form.titleEn}
                          className='h-12 w-12 rounded object-cover'
                          loading='lazy'
                        />
                      ) : (
                        <div className='bg-muted h-12 w-12 rounded' />
                      )}
                    </TableCell>
                    <TableCell className='font-mono text-xs'>
                      {item.slug}
                    </TableCell>
                    <TableCell className='max-w-48 truncate'>
                      {form.titleEn}
                    </TableCell>
                    <TableCell>
                      <Badge variant='outline'>
                        {t(
                          PROMPT_GALLERY_CATEGORY_LABEL_KEYS[item.category] ??
                            item.category
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className='max-w-40'>
                      <div className='flex flex-wrap gap-1'>
                        {tags.slice(0, 3).map((tag, index) => (
                          <Badge key={`${tag}-${index}`} variant='secondary'>
                            {tag}
                          </Badge>
                        ))}
                        {tags.length > 3 ? (
                          <Badge variant='secondary'>+{tags.length - 3}</Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={item.enabled}
                        disabled={togglingIds.has(item.id)}
                        onCheckedChange={() => handleToggleEnabled(item)}
                        aria-label={t('Enabled')}
                      />
                    </TableCell>
                    <TableCell className='text-muted-foreground text-xs whitespace-nowrap'>
                      {formatTimestamp(item.updated_time)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant='ghost'
                              className='data-popup-open:bg-muted flex h-8 w-8 p-0'
                            />
                          }
                        >
                          <MoreHorizontal className='h-4 w-4' />
                          <span className='sr-only'>{t('Open menu')}</span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='end' className='w-[160px]'>
                          <DropdownMenuItem onClick={() => onEdit(item)}>
                            {t('Edit')}
                            <Edit className='ms-auto' size={16} />
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeleteTarget(item)}
                            className='text-destructive focus:text-destructive'
                          >
                            {t('Delete')}
                            <Trash2 className='ms-auto' size={16} />
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className='flex items-center justify-between'>
        <span className='text-muted-foreground text-sm'>
          {t('Page {{current}} of {{total}}', {
            current: page,
            total: pageCount,
          })}
        </span>
        <div className='flex gap-2'>
          <Button
            variant='outline'
            size='sm'
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t('Previous')}
          </Button>
          <Button
            variant='outline'
            size='sm'
            disabled={page >= pageCount}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('Next')}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title={t('Delete Prompt')}
        desc={t(
          'Are you sure you want to delete "{{name}}"? This action cannot be undone.',
          { name: deleteTarget?.slug ?? '' }
        )}
        destructive
        confirmText={t('Delete')}
        isLoading={isDeleting}
        handleConfirm={handleDelete}
      />
    </div>
  )
}
