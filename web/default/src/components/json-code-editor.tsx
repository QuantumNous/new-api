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
import { AlertCircle, Braces, CheckCircle2, Code2 } from 'lucide-react'
import {
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
} from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/design-system/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export type JsonCodeEditorProps = Omit<ComponentProps<'div'>, 'onChange'> & {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  heightClassName?: string
}

export function JsonCodeEditor({
  value,
  onChange,
  disabled,
  heightClassName = 'h-56 min-h-56 max-h-56',
  className,
  id,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  ...rootProps
}: JsonCodeEditorProps) {
  const { t } = useTranslation()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const lineNumbers = useMemo(() => {
    const count = Math.max(1, value.split('\n').length)
    return Array.from({ length: count }, (_, index) => index + 1)
  }, [value])
  const jsonStatus = useMemo(() => {
    const trimmed = value.trim()
    if (!trimmed) return { valid: true, message: t('JSON') }
    try {
      JSON.parse(trimmed)
      return { valid: true, message: t('JSON') }
    } catch {
      return { valid: false, message: t('Invalid JSON') }
    }
  }, [value, t])

  const formatJson = () => {
    const trimmed = value.trim()
    if (!trimmed) return
    try {
      onChange(JSON.stringify(JSON.parse(trimmed), null, 2))
    } catch {
      // Keep invalid drafts untouched; validation feedback remains visible.
    }
  }

  const updateValueWithSelection = (
    nextValue: string,
    selectionStart: number,
    selectionEnd = selectionStart
  ) => {
    onChange(nextValue)
    window.requestAnimationFrame(() => {
      textareaRef.current?.setSelectionRange(selectionStart, selectionEnd)
    })
  }

  const getLineIndent = (text: string, cursor: number) => {
    const lineStart = text.lastIndexOf('\n', cursor - 1) + 1
    return text.slice(lineStart, cursor).match(/^\s*/)?.[0] ?? ''
  }

  const handleEditorKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const target = event.currentTarget
    const start = target.selectionStart
    const end = target.selectionEnd
    const selected = value.slice(start, end)
    const before = value.slice(0, start)
    const after = value.slice(end)

    if (event.key === 'Tab') {
      event.preventDefault()

      if (start !== end && selected.includes('\n')) {
        const selectionLineStart = value.lastIndexOf('\n', start - 1) + 1
        const selectedBlock = value.slice(selectionLineStart, end)
        const lines = selectedBlock.split('\n')
        const nextBlock = event.shiftKey
          ? lines
              .map((line) =>
                line.startsWith('  ')
                  ? line.slice(2)
                  : line.startsWith('\t')
                    ? line.slice(1)
                    : line
              )
              .join('\n')
          : lines.map((line) => `  ${line}`).join('\n')
        const nextValue =
          value.slice(0, selectionLineStart) + nextBlock + value.slice(end)
        updateValueWithSelection(
          nextValue,
          selectionLineStart,
          selectionLineStart + nextBlock.length
        )
        return
      }

      if (event.shiftKey) {
        const lineStart = value.lastIndexOf('\n', start - 1) + 1
        const removable = value.slice(lineStart, lineStart + 2)
        if (removable === '  ') {
          updateValueWithSelection(
            value.slice(0, lineStart) + value.slice(lineStart + 2),
            Math.max(lineStart, start - 2),
            Math.max(lineStart, end - 2)
          )
        }
        return
      }

      updateValueWithSelection(`${before}  ${after}`, start + 2)
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const indent = getLineIndent(value, start)
      const previousChar = before.trimEnd().at(-1)
      const nextChar = after.trimStart().at(0)
      const shouldNest = previousChar === '{' || previousChar === '['
      const shouldClose =
        (previousChar === '{' && nextChar === '}') ||
        (previousChar === '[' && nextChar === ']')

      if (shouldNest && shouldClose) {
        const innerIndent = `${indent}  `
        const insert = `\n${innerIndent}\n${indent}`
        updateValueWithSelection(
          `${before}${insert}${after}`,
          start + 1 + innerIndent.length
        )
        return
      }

      const nextIndent = shouldNest ? `${indent}  ` : indent
      const insert = `\n${nextIndent}`
      updateValueWithSelection(
        `${before}${insert}${after}`,
        start + insert.length
      )
      return
    }

    const pairs: Record<string, string> = {
      '"': '"',
      '{': '}',
      '[': ']',
    }
    const closingChars = new Set(Object.values(pairs))

    if (closingChars.has(event.key) && value[start] === event.key) {
      event.preventDefault()
      textareaRef.current?.setSelectionRange(start + 1, start + 1)
      return
    }

    if (pairs[event.key]) {
      event.preventDefault()
      const close = pairs[event.key]
      const wrapped = `${event.key}${selected}${close}`
      updateValueWithSelection(
        `${before}${wrapped}${after}`,
        start + 1,
        start + 1 + selected.length
      )
      return
    }

    if (event.key === 'Backspace' && start === end && start > 0) {
      const previousChar = value[start - 1]
      const nextChar = value[start]
      if (pairs[previousChar] === nextChar) {
        event.preventDefault()
        updateValueWithSelection(
          value.slice(0, start - 1) + value.slice(start + 1),
          start - 1
        )
      }
    }
  }

  return (
    <div
      className={cn(
        'border-input bg-background focus-within:border-ring focus-within:ring-ring/50 overflow-hidden rounded-lg border transition-colors focus-within:ring-3',
        className
      )}
      {...rootProps}
    >
      <div className='bg-muted/30 flex h-8 items-center justify-between border-b px-2'>
        <div className='text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs font-medium'>
          <Braces className='h-3.5 w-3.5' />
          <span>{t('JSON')}</span>
        </div>
        <div className='flex items-center gap-2'>
          <span
            className={cn(
              'flex items-center gap-1 text-xs',
              jsonStatus.valid ? 'text-success' : 'text-destructive'
            )}
          >
            {jsonStatus.valid ? (
              <CheckCircle2 className='h-3.5 w-3.5' />
            ) : (
              <AlertCircle className='h-3.5 w-3.5' />
            )}
            {jsonStatus.message}
          </span>
          <Button
            type='button'
            variant='ghost'
            size='xs'
            onClick={formatJson}
            disabled={disabled || !jsonStatus.valid || !value.trim()}
          >
            <Code2 className='mr-1 h-3.5 w-3.5' />
            {t('Format JSON')}
          </Button>
        </div>
      </div>
      <div className={cn('relative flex overflow-hidden', heightClassName)}>
        <div className='bg-muted/20 text-muted-foreground/70 relative w-10 shrink-0 overflow-hidden border-r font-mono text-xs leading-5 select-none'>
          <div
            className='px-2 py-2 text-right'
            style={{ transform: `translateY(-${scrollTop}px)` }}
          >
            {lineNumbers.map((lineNumber) => (
              <div key={lineNumber}>{lineNumber}</div>
            ))}
          </div>
        </div>
        <Textarea
          ref={textareaRef}
          id={id}
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleEditorKeyDown}
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
          className={cn(
            '[field-sizing:fixed] resize-none overflow-auto rounded-none border-0 bg-transparent px-3 py-2 font-mono text-xs leading-5 shadow-none ring-0 outline-none focus-visible:ring-0',
            heightClassName
          )}
          spellCheck={false}
        />
      </div>
    </div>
  )
}
