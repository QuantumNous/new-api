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
import { useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Dialog } from '@/components/dialog'
import { createPromptGalleryItem, updatePromptGalleryItem } from '../api'
import {
  PROMPT_GALLERY_CATEGORIES,
  PROMPT_GALLERY_CATEGORY_LABEL_KEYS,
  itemToFormData,
  type PromptGalleryFormData,
  type PromptLibraryAdminItem,
} from '../types'

const EMPTY_FORM: PromptGalleryFormData = {
  slug: '',
  category: 'image',
  model: '',
  prompt: '',
  titleEn: '',
  summaryEn: '',
  tags: '',
  imageUrl: '',
  imageAlt: '',
  sourceLabel: '',
  sourcePlatform: '',
  sourceUrl: '',
  enabled: true,
}

const SLUG_PATTERN = /^[a-z0-9-]+$/

type FieldProps = {
  htmlFor: string
  label: string
  error?: string
  className?: string
  children: ReactNode
}

function Field({ htmlFor, label, error, className, children }: FieldProps) {
  return (
    <div className={className ?? 'space-y-1.5'}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className='text-destructive text-xs'>{error}</p> : null}
    </div>
  )
}

type PromptGalleryMutateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow: PromptLibraryAdminItem | null
}

export function PromptGalleryMutateDialog({
  open,
  onOpenChange,
  currentRow,
}: PromptGalleryMutateDialogProps) {
  const { t } = useTranslation()
  const isUpdate = !!currentRow

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isUpdate ? t('Edit Prompt') : t('Create Prompt')}
      contentClassName='sm:max-w-2xl'
    >
      {/* Dialog content unmounts when closed, so the form re-initializes from
          the current row on each open; the key covers switching between rows
          while the dialog stays mounted. */}
      <PromptGalleryForm
        key={currentRow?.id ?? 'create'}
        currentRow={currentRow}
        onClose={() => onOpenChange(false)}
      />
    </Dialog>
  )
}

type PromptGalleryFormProps = {
  currentRow: PromptLibraryAdminItem | null
  onClose: () => void
}

function PromptGalleryForm({ currentRow, onClose }: PromptGalleryFormProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const isUpdate = !!currentRow
  const [form, setForm] = useState<PromptGalleryFormData>(() =>
    currentRow ? itemToFormData(currentRow) : EMPTY_FORM
  )
  const [errors, setErrors] = useState<
    Partial<Record<keyof PromptGalleryFormData, string>>
  >({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const setField = <K extends keyof PromptGalleryFormData>(
    key: K,
    value: PromptGalleryFormData[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev))
  }

  const validate = (): boolean => {
    const next: Partial<Record<keyof PromptGalleryFormData, string>> = {}
    const slug = form.slug.trim()
    if (!slug) {
      next.slug = t('Required')
    } else if (!SLUG_PATTERN.test(slug)) {
      next.slug = t(
        'Slug must contain only lowercase letters, numbers and hyphens'
      )
    }
    if (!form.titleEn.trim()) next.titleEn = t('Required')
    if (!form.prompt.trim()) next.prompt = t('Required')
    if (!form.imageUrl.trim()) next.imageUrl = t('Required')
    if (!form.sourceUrl.trim()) next.sourceUrl = t('Required')
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setIsSubmitting(true)
    try {
      const result = isUpdate
        ? // pass the original row so un-edited JSON data (output, captured_at,
          // extra languages) survives the backend's full-replace PUT
          await updatePromptGalleryItem(currentRow.id, form, currentRow)
        : await createPromptGalleryItem(form)
      if (result.success) {
        toast.success(
          isUpdate ? t('Updated successfully') : t('Created successfully')
        )
        onClose()
        queryClient.invalidateQueries({ queryKey: ['prompt-gallery'] })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className='grid gap-4 sm:grid-cols-2'>
      <Field htmlFor='pg-slug' label={t('Slug')} error={errors.slug}>
        <Input
          id='pg-slug'
          value={form.slug}
          onChange={(e) => setField('slug', e.target.value)}
          placeholder='rice-grain-macro'
          aria-invalid={!!errors.slug}
        />
      </Field>

      <Field htmlFor='pg-category' label={t('Category')}>
        <Select
          value={form.category}
          onValueChange={(value) => {
            if (value) setField('category', value)
          }}
        >
          <SelectTrigger id='pg-category' className='w-full'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROMPT_GALLERY_CATEGORIES.map((category) => (
              <SelectItem key={category} value={category}>
                {t(PROMPT_GALLERY_CATEGORY_LABEL_KEYS[category])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field
        htmlFor='pg-title'
        label={t('Title (English)')}
        error={errors.titleEn}
      >
        <Input
          id='pg-title'
          value={form.titleEn}
          onChange={(e) => setField('titleEn', e.target.value)}
          aria-invalid={!!errors.titleEn}
        />
      </Field>

      <Field htmlFor='pg-model' label={t('Model')}>
        <Input
          id='pg-model'
          value={form.model}
          onChange={(e) => setField('model', e.target.value)}
          placeholder='gpt-image-2'
        />
      </Field>

      <Field
        htmlFor='pg-prompt'
        label={t('Prompt')}
        error={errors.prompt}
        className='space-y-1.5 sm:col-span-2'
      >
        <Textarea
          id='pg-prompt'
          value={form.prompt}
          onChange={(e) => setField('prompt', e.target.value)}
          rows={5}
          aria-invalid={!!errors.prompt}
        />
      </Field>

      <Field
        htmlFor='pg-summary'
        label={t('Summary (English)')}
        className='space-y-1.5 sm:col-span-2'
      >
        <Textarea
          id='pg-summary'
          value={form.summaryEn}
          onChange={(e) => setField('summaryEn', e.target.value)}
          rows={2}
        />
      </Field>

      <Field
        htmlFor='pg-tags'
        label={t('Tags (comma separated)')}
        className='space-y-1.5 sm:col-span-2'
      >
        <Input
          id='pg-tags'
          value={form.tags}
          onChange={(e) => setField('tags', e.target.value)}
          placeholder='photography, macro'
        />
      </Field>

      <Field
        htmlFor='pg-image-url'
        label={t('Image URL')}
        error={errors.imageUrl}
      >
        <Input
          id='pg-image-url'
          value={form.imageUrl}
          onChange={(e) => setField('imageUrl', e.target.value)}
          placeholder='https://...'
          aria-invalid={!!errors.imageUrl}
        />
      </Field>

      <Field htmlFor='pg-image-alt' label={t('Image Alt')}>
        <Input
          id='pg-image-alt'
          value={form.imageAlt}
          onChange={(e) => setField('imageAlt', e.target.value)}
        />
      </Field>

      <Field htmlFor='pg-source-label' label={t('Source Label')}>
        <Input
          id='pg-source-label'
          value={form.sourceLabel}
          onChange={(e) => setField('sourceLabel', e.target.value)}
          placeholder='@author'
        />
      </Field>

      <Field htmlFor='pg-source-platform' label={t('Source Platform')}>
        <Input
          id='pg-source-platform'
          value={form.sourcePlatform}
          onChange={(e) => setField('sourcePlatform', e.target.value)}
          placeholder='X'
        />
      </Field>

      <Field
        htmlFor='pg-source-url'
        label={t('Source URL')}
        error={errors.sourceUrl}
      >
        <Input
          id='pg-source-url'
          value={form.sourceUrl}
          onChange={(e) => setField('sourceUrl', e.target.value)}
          placeholder='https://...'
          aria-invalid={!!errors.sourceUrl}
        />
      </Field>

      <div className='flex items-center gap-2 sm:self-end sm:pb-2'>
        <Switch
          id='pg-enabled'
          checked={form.enabled}
          onCheckedChange={(checked) => setField('enabled', checked)}
        />
        <Label htmlFor='pg-enabled'>{t('Enabled')}</Label>
      </div>

      <div className='flex justify-end gap-2 sm:col-span-2'>
        <Button type='button' variant='outline' onClick={onClose}>
          {t('Cancel')}
        </Button>
        <Button type='submit' disabled={isSubmitting}>
          {isSubmitting ? t('Saving...') : t('Save changes')}
        </Button>
      </div>
    </form>
  )
}
