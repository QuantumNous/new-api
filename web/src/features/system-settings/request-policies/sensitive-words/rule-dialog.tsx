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
import { ArrowDown, ArrowUp, FileUp, Search, X } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import { saveSensitiveWordRule } from './api'
import {
  findSensitiveWordMatches,
  getNextSensitiveWordMatchIndex,
  parseSensitiveWordDraftWords,
} from './draft-search'
import {
  emptySensitiveWordRuleDraft,
  type SensitiveWordRuleDraft,
  type SensitiveWordRuleDetail,
} from './types'

type RuleDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  groups: string[]
  rule?: SensitiveWordRuleDetail | null
  onSaved: () => void | Promise<void>
}

export function SensitiveWordRuleDialog({
  open,
  onOpenChange,
  groups,
  rule,
  onSaved,
}: RuleDialogProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<SensitiveWordRuleDraft>(
    emptySensitiveWordRuleDraft
  )
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [activeMatchIndex, setActiveMatchIndex] = useState(0)
  const wordsTextarea = useRef<HTMLTextAreaElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setSearch('')
    setActiveMatchIndex(0)
    if (!open) return
    setDraft(
      rule
        ? {
            id: rule.id,
            name: rule.name,
            wordsText: rule.words.join('\n'),
            scope: rule.scope,
            groups: rule.groups,
            mode: rule.mode,
          }
        : emptySensitiveWordRuleDraft()
    )
  }, [rule, open])

  const draftWords = useMemo(
    () => parseSensitiveWordDraftWords(draft.wordsText),
    [draft.wordsText]
  )
  const wordCount = draftWords.length
  const searchMatches = useMemo(
    () => findSensitiveWordMatches(draft.wordsText, search),
    [draft.wordsText, search]
  )
  const searchMatchesRef = useRef(searchMatches)
  searchMatchesRef.current = searchMatches

  useEffect(() => {
    setActiveMatchIndex((current) => {
      if (searchMatches.length === 0) return 0
      return Math.min(current, searchMatches.length - 1)
    })
  }, [searchMatches.length])

  const scrollTextareaMatchIntoView = useCallback(
    (textarea: HTMLTextAreaElement, start: number) => {
      const style = window.getComputedStyle(textarea)
      const lineHeight = Number.parseFloat(style.lineHeight)
      const fontSize = Number.parseFloat(style.fontSize)
      let resolvedLineHeight = 20
      if (Number.isFinite(lineHeight)) {
        resolvedLineHeight = lineHeight
      } else if (Number.isFinite(fontSize)) {
        resolvedLineHeight = fontSize * 1.5
      }
      const line = textarea.value.slice(0, start).split('\n').length - 1
      const lineTop = line * resolvedLineHeight
      const lineBottom = lineTop + resolvedLineHeight
      if (lineTop < textarea.scrollTop) {
        textarea.scrollTop = lineTop
      } else if (lineBottom > textarea.scrollTop + textarea.clientHeight) {
        textarea.scrollTop = Math.max(
          0,
          lineTop -
            Math.max(0, (textarea.clientHeight - resolvedLineHeight) / 2)
        )
      }
    },
    []
  )

  const selectSearchMatch = useCallback(
    (nextIndex: number) => {
      const match = searchMatchesRef.current[nextIndex]
      const textarea = wordsTextarea.current
      if (!match || !textarea) return

      const restoreSearchFocus = document.activeElement === searchInput.current
      if (restoreSearchFocus) textarea.focus({ preventScroll: true })
      textarea.setSelectionRange(match.start, match.end)
      scrollTextareaMatchIntoView(textarea, match.start)
      if (restoreSearchFocus) {
        searchInput.current?.focus({ preventScroll: true })
      }
      setActiveMatchIndex(nextIndex)
    },
    [scrollTextareaMatchIntoView]
  )

  useEffect(() => {
    if (
      !open ||
      !search.trim() ||
      searchMatches.length === 0 ||
      document.activeElement === wordsTextarea.current
    ) {
      return
    }
    selectSearchMatch(Math.min(activeMatchIndex, searchMatches.length - 1))
  }, [activeMatchIndex, open, search, searchMatches.length, selectSearchMatch])

  function moveSearchMatch(backwards: boolean) {
    const nextIndex = getNextSensitiveWordMatchIndex(
      activeMatchIndex,
      searchMatches.length,
      backwards
    )
    selectSearchMatch(nextIndex)
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
    event.preventDefault()
    if (searchMatches.length === 0) return
    moveSearchMatch(event.shiftKey)
  }

  async function importWords(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      setDraft((current) => ({
        ...current,
        wordsText: current.wordsText
          ? `${current.wordsText.trimEnd()}\n${text}`
          : text,
      }))
      toast.success(t('TXT entries imported into the editor'))
    } catch {
      toast.error(t('Unable to read TXT file'))
    } finally {
      event.target.value = ''
    }
  }

  function toggleGroup(group: string, checked: boolean) {
    setDraft((current) => ({
      ...current,
      groups: checked
        ? [...current.groups, group]
        : current.groups.filter((value) => value !== group),
    }))
  }

  async function submit() {
    if (
      !draft.name.trim() ||
      wordCount === 0 ||
      (draft.scope === 'group' && draft.groups.length === 0)
    ) {
      return
    }
    setSaving(true)
    try {
      await saveSensitiveWordRule(draft)
      await onSaved()
      onOpenChange(false)
    } catch {
      toast.error(t('Unable to save sensitive-word rule'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        rule ? t('Edit sensitive-word rule') : t('Create sensitive-word rule')
      }
      description={t('One word per line. New rules default to observe mode.')}
      contentClassName='sm:max-w-xl'
      footer={
        <>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
          >
            {t('Cancel')}
          </Button>
          <Button
            type='button'
            onClick={() => void submit()}
            disabled={
              saving ||
              !draft.name.trim() ||
              wordCount === 0 ||
              (draft.scope === 'group' && draft.groups.length === 0)
            }
          >
            {saving ? t('Saving...') : t('Save rule')}
          </Button>
        </>
      }
    >
      <div className='space-y-4'>
        <div className='space-y-2'>
          <Label htmlFor='sensitive-rule-name'>{t('Rule name')}</Label>
          <Input
            id='sensitive-rule-name'
            value={draft.name}
            onChange={(event) =>
              setDraft((current) => ({ ...current, name: event.target.value }))
            }
            maxLength={64}
          />
        </div>
        <div className='space-y-2'>
          <Label htmlFor='sensitive-rule-words'>{t('Words')}</Label>
          <div className='flex min-w-0 flex-wrap items-center gap-2'>
            <div className='relative min-w-0 flex-1'>
              <Search
                className='text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2'
                aria-hidden='true'
              />
              <Input
                ref={searchInput}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={handleSearchKeyDown}
                aria-label={t('Search words')}
                placeholder={t('Search words')}
                className='h-8 pl-8 text-xs'
              />
              {search.trim() && (
                <span
                  role='status'
                  aria-live='polite'
                  className='text-muted-foreground pointer-events-none absolute top-1/2 right-8 -translate-y-1/2 text-xs tabular-nums'
                >
                  {t('{{current}} of {{total}} matches', {
                    current: searchMatches.length ? activeMatchIndex + 1 : 0,
                    total: searchMatches.length,
                  })}
                </span>
              )}
              {search && (
                <Button
                  type='button'
                  size='icon-sm'
                  variant='ghost'
                  className='absolute top-1/2 right-0.5 -translate-y-1/2'
                  aria-label={t('Clear search')}
                  onClick={() => {
                    setSearch('')
                    setActiveMatchIndex(0)
                    searchInput.current?.focus()
                  }}
                >
                  <X />
                </Button>
              )}
            </div>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type='button'
                    size='icon-sm'
                    variant='outline'
                    aria-label={t('Previous match')}
                    disabled={searchMatches.length === 0}
                    onClick={() => moveSearchMatch(true)}
                  />
                }
              >
                <ArrowUp />
              </TooltipTrigger>
              <TooltipContent>{t('Previous match')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type='button'
                    size='icon-sm'
                    variant='outline'
                    aria-label={t('Next match')}
                    disabled={searchMatches.length === 0}
                    onClick={() => moveSearchMatch(false)}
                  />
                }
              >
                <ArrowDown />
              </TooltipTrigger>
              <TooltipContent>{t('Next match')}</TooltipContent>
            </Tooltip>
            <input
              ref={fileInput}
              type='file'
              accept='.txt,text/plain'
              className='hidden'
              onChange={(event) => void importWords(event)}
            />
            <Button
              type='button'
              size='sm'
              variant='outline'
              onClick={() => fileInput.current?.click()}
            >
              <FileUp data-icon='inline-start' />
              {t('Import TXT')}
            </Button>
          </div>
          <Textarea
            id='sensitive-rule-words'
            ref={wordsTextarea}
            rows={8}
            value={draft.wordsText}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                wordsText: event.target.value,
              }))
            }
            placeholder={t('One word per line')}
          />
          <p className='text-muted-foreground text-xs'>
            {t('{{count}} words after trimming and deduplication', {
              count: wordCount,
            })}
          </p>
        </div>
        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='space-y-2'>
            <Label>{t('Mode')}</Label>
            <Select
              value={draft.mode}
              onValueChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  mode: value as SensitiveWordRuleDraft['mode'],
                }))
              }
            >
              <SelectTrigger className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='observe'>{t('Observe')}</SelectItem>
                <SelectItem value='block'>{t('Block')}</SelectItem>
                <SelectItem value='off'>{t('Off')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-2'>
            <Label>{t('Scope')}</Label>
            <Select
              value={draft.scope}
              onValueChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  scope: value as SensitiveWordRuleDraft['scope'],
                  groups: value === 'global' ? [] : current.groups,
                }))
              }
            >
              <SelectTrigger className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='global'>{t('Global')}</SelectItem>
                <SelectItem value='group'>{t('Selected groups')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {draft.scope === 'group' && (
          <div className='space-y-2'>
            <Label>{t('Groups')}</Label>
            <div className='grid max-h-36 gap-2 overflow-y-auto rounded-lg border p-3 sm:grid-cols-2'>
              {groups.map((group) => (
                <label key={group} className='flex items-center gap-2 text-sm'>
                  <Checkbox
                    checked={draft.groups.includes(group)}
                    onCheckedChange={(checked) =>
                      toggleGroup(group, checked === true)
                    }
                  />
                  <span>{group}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  )
}
