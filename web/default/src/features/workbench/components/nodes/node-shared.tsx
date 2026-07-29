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
/*
Adapted from open-ai-canvas (https://github.com/ddcat-ai/open-ai-canvas),
based on basketikun/infinite-canvas. AGPL-3.0; see THIRD-PARTY-LICENSES.md.
*/
import { ArrowUp, Loader2, Square } from 'lucide-react'
import React, { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

import {
  CANVAS_PROMPT_PRESETS,
  canvasMentionToken,
  insertPromptShortcut,
} from '../../engine/canvas-prompt-shortcuts'
import { useCanvasTheme } from '../../engine/canvas-theme'
import { useCanvasStore } from '../../store/canvas-store'
import type {
  CanvasGenerationMode,
  CanvasNodeData,
  CanvasNodeMetadata,
} from '../../types'

export const MISSING_MODEL_ERROR = 'Select a model before generating.'

export type CanvasNodeBodyProps = {
  node: CanvasNodeData
  selected: boolean
  isGenerating: boolean
  onMetadataChange: (patch: Partial<CanvasNodeMetadata>) => void
  onGenerate: () => void
  onCancel: () => void
  readOnly?: boolean
}

export function NodePromptBar(props: {
  value: string
  placeholder: string
  disabled?: boolean
  isGenerating: boolean
  onChange: (value: string) => void
  onGenerate: () => void
  onCancel: () => void
  children?: React.ReactNode
  modality: CanvasGenerationMode
  nodeId: string
}) {
  const { t } = useTranslation()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const nodes = useCanvasStore((state) => state.nodes)
  const [menu, setMenu] = useState<{
    trigger: '@' | '/'
    start: number
    query: string
  } | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const candidates =
    menu?.trigger === '@'
      ? nodes
          .filter(
            (node) =>
              node.id !== props.nodeId &&
              node.title.toLowerCase().includes(menu.query.toLowerCase())
          )
          .map((node) => ({
            id: node.id,
            label: node.title,
            insertion: canvasMentionToken(node),
          }))
      : CANVAS_PROMPT_PRESETS.filter(
          (preset) =>
            preset.modalities.includes(props.modality) &&
            t(preset.labelKey)
              .toLowerCase()
              .includes(menu?.query.toLowerCase() ?? '')
        ).map((preset) => ({
          id: preset.id,
          label: t(preset.labelKey),
          insertion: preset.text,
        }))

  const chooseCandidate = (index: number) => {
    const candidate = candidates[index]
    const textarea = textareaRef.current
    if (!candidate || !menu || !textarea) return
    const result = insertPromptShortcut(
      props.value,
      textarea.selectionEnd,
      menu.start,
      candidate.insertion
    )
    props.onChange(result.value)
    setMenu(null)
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(result.cursor, result.cursor)
    })
  }

  return (
    <div
      className='border-border/60 bg-muted/40 focus-within:border-primary/50 focus-within:bg-background relative flex shrink-0 flex-col gap-1.5 rounded-2xl border p-1.5 transition-colors'
      data-canvas-no-zoom
      data-guide='node-prompt'
    >
      <Textarea
        ref={textareaRef}
        value={props.value}
        placeholder={props.placeholder}
        rows={2}
        className='min-h-[46px] resize-none border-none bg-transparent px-2 py-1 text-xs leading-relaxed shadow-none focus-visible:ring-0'
        onChange={(event) => {
          props.onChange(event.target.value)
          const before = event.target.value.slice(
            0,
            event.target.selectionStart
          )
          const match = before.match(/(?:^|\s)([@/])([^\s@/]*)$/)
          setMenu(
            match
              ? {
                  trigger: match[1] as '@' | '/',
                  start: before.length - match[0].trimStart().length,
                  query: match[2],
                }
              : null
          )
          setActiveIndex(0)
        }}
        onKeyDown={(event) => {
          if (!menu || !candidates.length) return
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setActiveIndex(
              (current) =>
                (current +
                  (event.key === 'ArrowDown' ? 1 : candidates.length - 1)) %
                candidates.length
            )
          } else if (event.key === 'Enter') {
            event.preventDefault()
            chooseCandidate(activeIndex)
          } else if (event.key === 'Escape') {
            event.preventDefault()
            setMenu(null)
          }
        }}
        onPointerDown={(event) => event.stopPropagation()}
      />
      {menu && candidates.length ? (
        <div className='bg-popover absolute inset-x-0 bottom-full z-20 mb-1 max-h-32 overflow-auto rounded-xl border p-1 text-xs shadow-lg'>
          {candidates.map((candidate, index) => (
            <button
              key={candidate.id}
              type='button'
              className={`block w-full rounded-lg px-2 py-1 text-left ${index === activeIndex ? 'bg-accent' : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => chooseCandidate(index)}
            >
              {candidate.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className='flex items-center gap-1.5'>
        {props.children}
        {props.isGenerating ? (
          <button
            type='button'
            title={t('Cancel')}
            aria-label={t('Cancel')}
            className='border-border/70 text-muted-foreground hover:text-foreground ml-auto flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors'
            onPointerDown={(event) => event.stopPropagation()}
            onClick={props.onCancel}
          >
            <Square className='size-3 fill-current' />
          </button>
        ) : (
          <button
            type='button'
            title={t('Generate')}
            aria-label={t('Generate')}
            data-guide='node-generate'
            disabled={props.disabled}
            className='transition-ui ml-auto flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-blue-600 text-white shadow-sm hover:brightness-110 active:scale-95 disabled:from-slate-400 disabled:to-slate-400 disabled:opacity-50 disabled:active:scale-100'
            onPointerDown={(event) => event.stopPropagation()}
            onClick={props.onGenerate}
          >
            <ArrowUp className='size-4' />
          </button>
        )}
      </div>
    </div>
  )
}

export function NodeModelSelect(props: {
  value?: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  const { t } = useTranslation()

  return (
    <NativeSelect
      size='sm'
      className={cn(
        'h-8 min-w-0 flex-1 rounded-full border-transparent text-[11px]',
        props.value ? 'bg-foreground/5' : 'bg-amber-500/15 text-amber-700'
      )}
      value={props.value ?? ''}
      onPointerDown={(event) => event.stopPropagation()}
      onChange={(event) => props.onChange(event.target.value)}
    >
      <option value=''>{t('Select a model')}</option>
      {props.options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </NativeSelect>
  )
}

/**
 * Compact read-only summary of the generation settings. Keeps the dense
 * selector grid out of the card until the user opts into professional mode.
 */
export function NodeSettingsChips(props: { items: string[] }) {
  return (
    <div className='flex shrink-0 flex-wrap items-center gap-1'>
      {props.items.map((item) => (
        <span
          key={item}
          className='bg-foreground/5 text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-medium'
        >
          {item}
        </span>
      ))}
    </div>
  )
}

export function NodeStatusOverlay(props: {
  status?: string
  taskStatus?: string
  progress?: number
  errorDetails?: string
}) {
  const { t } = useTranslation()
  const theme = useCanvasTheme()

  if (props.status === 'loading') {
    return (
      <div
        className='absolute inset-0 flex flex-col items-center justify-center gap-2.5 rounded-xl text-[11px] backdrop-blur-md'
        style={{ background: theme.spatial.dropzone, color: theme.node.muted }}
      >
        <span className='relative flex size-8 items-center justify-center'>
          <span
            className='absolute inset-0 rounded-full opacity-40 motion-reduce:hidden'
            style={{
              background: theme.accent.primary,
              animation: 'canvas-node-glow 1.8s ease-in-out infinite',
            }}
            aria-hidden='true'
          />
          <Loader2
            className='size-5 animate-spin motion-reduce:animate-none'
            style={{ color: theme.accent.primary }}
          />
        </span>
        <span className='font-medium'>
          {typeof props.progress === 'number'
            ? `${t(props.taskStatus || 'Generating')} · ${props.progress}%`
            : t(props.taskStatus || 'Generating')}
        </span>
        {typeof props.progress === 'number' ? (
          <span className='bg-foreground/10 h-1 w-24 overflow-hidden rounded-full'>
            <span
              className='block h-full w-full origin-left rounded-full transition-transform duration-500 motion-reduce:transition-none'
              style={{
                transform: `scaleX(${Math.min(Math.max(props.progress, 0), 100) / 100})`,
                background: theme.accent.primary,
              }}
            />
          </span>
        ) : null}
      </div>
    )
  }
  if (props.status === 'error') {
    return (
      <div
        className='absolute inset-0 flex items-center justify-center rounded-xl p-3 text-center text-[11px] backdrop-blur-sm'
        style={{
          background: theme.spatial.dropzone,
          color: theme.accent.danger,
        }}
      >
        {props.errorDetails === MISSING_MODEL_ERROR
          ? t('Select a model before generating.')
          : props.errorDetails || t('Generation failed')}
      </div>
    )
  }
  return null
}

export function NodeEmptyMedia(props: {
  label: string
  icon?: React.ReactNode
}) {
  const theme = useCanvasTheme()
  return (
    <div
      className='flex h-full w-full flex-col items-center justify-center gap-2 rounded-xl px-4 text-center text-[11px]'
      style={{ color: theme.node.placeholder }}
    >
      {props.icon ? (
        <span className='bg-foreground/5 flex size-9 items-center justify-center rounded-full'>
          {props.icon}
        </span>
      ) : null}
      <span className='text-pretty'>{props.label}</span>
    </div>
  )
}
