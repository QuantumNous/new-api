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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useAuthStore } from '@/stores/auth-store'

import {
  deleteDrawingTemplate,
  drawingErrorMessage,
  getDrawingTemplates,
  saveDrawingTemplate,
} from '../api'

type TemplateDraft = { id?: string; name: string; prompt: string }
type PromptTemplatesProps = {
  value: string
  disabled: boolean
  onApply: (prompt: string) => void
}
export function PromptTemplates(props: PromptTemplatesProps) {
  const { t } = useTranslation()
  const userId = useAuthStore((state) => state.auth.user?.id)
  const client = useQueryClient()
  const query = useQuery({
    queryKey: ['drawing-templates', userId],
    queryFn: getDrawingTemplates,
    enabled: Boolean(userId),
  })
  const [selectedId, setSelectedId] = useState('')
  const [draft, setDraft] = useState<TemplateDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const lastApplied = useRef('')
  const builtin = {
    id: 'builtin-product',
    name: t('Product image template'),
    prompt: t('Product image template text'),
    updated_at: 0,
  }
  const templates = [builtin, ...(query.data ?? [])]
  const selected = templates.find((item) => item.id === selectedId)
  useEffect(() => {
    if (query.error) {
      toast.error(
        t(drawingErrorMessage(query.error, 'Unable to load prompt templates'))
      )
    }
  }, [query.error, t])
  const apply = (id: string | null) => {
    const template = templates.find((item) => item.id === id)
    if (!template) return
    let remaining = props.value
    if (lastApplied.current && remaining.startsWith(lastApplied.current)) {
      remaining = remaining.slice(lastApplied.current.length).trimStart()
    }
    lastApplied.current = template.prompt
    props.onApply(
      remaining.trim() ? `${template.prompt}\n\n${remaining}` : template.prompt
    )
    setSelectedId(template.id)
  }
  const save = async () => {
    if (!draft) return
    setBusy(true)
    try {
      const saved = await saveDrawingTemplate(draft)
      await client.invalidateQueries({
        queryKey: ['drawing-templates', userId],
      })
      setSelectedId(saved.id)
      setDraft(null)
      toast.success(t('Prompt template saved'))
    } catch (error) {
      toast.error(
        t(drawingErrorMessage(error, 'Unable to save prompt template'))
      )
    } finally {
      setBusy(false)
    }
  }
  const remove = async () => {
    if (!draft?.id || !window.confirm(t('Delete this prompt template?'))) return
    setBusy(true)
    try {
      await deleteDrawingTemplate(draft.id)
      await client.invalidateQueries({
        queryKey: ['drawing-templates', userId],
      })
      setSelectedId('')
      setDraft(null)
    } catch (error) {
      toast.error(
        t(drawingErrorMessage(error, 'Unable to delete prompt template'))
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className='flex min-w-0 items-center gap-2'>
      <Select value={selectedId || null} onValueChange={apply}>
        <SelectTrigger
          aria-label={t('Prompt templates')}
          className='min-w-0 flex-1'
          disabled={props.disabled || busy}
        >
          <SelectValue>{selected?.name ?? t('Prompt templates')}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {templates.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type='button'
        variant='ghost'
        size='sm'
        disabled={props.disabled || busy || !props.value.trim()}
        onClick={() => setDraft({ name: '', prompt: props.value })}
      >
        {t('Save as template')}
      </Button>
      {selected && (
        <Button
          type='button'
          variant='ghost'
          size='icon-sm'
          aria-label={t('Edit prompt template')}
          disabled={props.disabled || busy}
          onClick={() =>
            setDraft({
              id: selected.id === builtin.id ? undefined : selected.id,
              name: selected.name,
              prompt: selected.prompt,
            })
          }
        >
          <Pencil className='size-4' aria-hidden='true' />
        </Button>
      )}
      <Dialog
        open={draft !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setDraft(null)
        }}
      >
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>
              {t(draft?.id ? 'Edit prompt template' : 'Save prompt template')}
            </DialogTitle>
            <DialogDescription>
              {t(
                'Templates are saved to your account. Changes in the prompt box do not overwrite them.'
              )}
            </DialogDescription>
          </DialogHeader>
          <div className='grid gap-2'>
            <Label htmlFor='drawing-template-name'>{t('Template name')}</Label>
            <Input
              id='drawing-template-name'
              maxLength={80}
              value={draft?.name ?? ''}
              disabled={busy}
              onChange={(event) =>
                setDraft((current) =>
                  current ? { ...current, name: event.target.value } : null
                )
              }
            />
          </div>
          <div className='grid gap-2'>
            <Label htmlFor='drawing-template-prompt'>
              {t('Template content')}
            </Label>
            <Textarea
              id='drawing-template-prompt'
              className='max-h-80 min-h-48'
              value={draft?.prompt ?? ''}
              disabled={busy}
              onChange={(event) =>
                setDraft((current) =>
                  current ? { ...current, prompt: event.target.value } : null
                )
              }
            />
          </div>
          <DialogFooter>
            {draft?.id && (
              <Button
                type='button'
                variant='ghost'
                disabled={busy}
                onClick={remove}
              >
                {t('Delete')}
              </Button>
            )}
            <Button
              type='button'
              disabled={busy || !draft?.name.trim() || !draft.prompt.trim()}
              onClick={save}
            >
              {t('Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
