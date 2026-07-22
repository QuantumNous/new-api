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
import { AlertCircle, Braces, CheckCircle2, Code2, Copy } from 'lucide-react'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Yace, type Plugin } from 'yace'
import { code } from 'yace/highlighters/code'
import { autoClose, history, tab } from 'yace/plugins'

import {
  createScrollLayerSynchronizer,
  formatJsonDraft,
  getCursorLocation,
  getJsonValidationState,
  jsonSmartEnter,
  type CursorLocation,
} from '@/components/json-code-editor/json-code-editor-utils'
import { Button } from '@/components/ui/button'
import { copyToClipboard } from '@/lib/copy-to-clipboard'
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
  const mountRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Yace | null>(null)
  const latestValueRef = useRef(value)
  const latestOnChangeRef = useRef(onChange)
  const [cursorLocation, setCursorLocation] = useState<CursorLocation>({
    line: 1,
    column: 1,
  })
  const jsonStatus = useMemo(() => getJsonValidationState(value), [value])
  const editorPlugins = useMemo<Plugin[]>(
    () => [
      history(),
      tab('  '),
      jsonSmartEnter(),
      autoClose({ '"': '"', '{': '}', '[': ']' }),
    ],
    []
  )

  latestValueRef.current = value
  latestOnChangeRef.current = onChange

  useEffect(() => {
    const mountNode = mountRef.current
    if (!mountNode) {
      return
    }

    const editor = new Yace(mountNode, {
      value: latestValueRef.current,
      lineNumbers: true,
      highlighters: [code()],
      plugins: editorPlugins,
      styles: {
        color: 'inherit',
        fontSize: '0.75rem',
        lineHeight: '1.25rem',
        minHeight: '100%',
        overflow: 'hidden',
        padding: '0.5rem 0.75rem 0.5rem 0.5rem',
      },
    })
    editorRef.current = editor

    const handleUpdate = (nextValue: string) => {
      if (nextValue !== latestValueRef.current) {
        latestOnChangeRef.current(nextValue)
      }
    }
    const updateCursorLocation = () => {
      setCursorLocation(
        getCursorLocation(editor.value, editor.textarea.selectionStart)
      )
    }
    const lineNumberLayer = [...mountNode.querySelectorAll('pre')].find(
      (preLayer) => preLayer !== editor.pre
    )
    if (!lineNumberLayer) {
      editor.destroy()
      editorRef.current = null
      return
    }
    const scrollSynchronizer = createScrollLayerSynchronizer(editor.textarea, {
      contentLayer: editor.pre,
      lineNumberLayer,
    })
    const syncScrollLayers = () => scrollSynchronizer.sync()

    editor.onUpdate(handleUpdate)
    editor.textarea.addEventListener('click', updateCursorLocation)
    editor.textarea.addEventListener('input', updateCursorLocation)
    editor.textarea.addEventListener('keyup', updateCursorLocation)
    editor.textarea.addEventListener('select', updateCursorLocation)
    editor.textarea.addEventListener('scroll', syncScrollLayers, {
      passive: true,
    })
    editor.textarea.classList.add('json-code-editor-textarea')
    editor.pre.classList.add('json-code-editor-highlight')
    lineNumberLayer.classList.add('json-code-editor-lines')
    updateCursorLocation()

    return () => {
      editor.textarea.removeEventListener('click', updateCursorLocation)
      editor.textarea.removeEventListener('input', updateCursorLocation)
      editor.textarea.removeEventListener('keyup', updateCursorLocation)
      editor.textarea.removeEventListener('select', updateCursorLocation)
      editor.textarea.removeEventListener('scroll', syncScrollLayers)
      editor.destroy()
      editorRef.current = null
    }
  }, [editorPlugins])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor || editor.value === value) {
      return
    }

    editor.update({ value })
  }, [value])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) {
      return
    }

    const resolvedAriaInvalid = ariaInvalid ?? !jsonStatus.isValid

    editor.textarea.disabled = Boolean(disabled)
    editor.textarea.id = id ?? ''
    editor.textarea.setAttribute('aria-label', t('JSON'))

    if (resolvedAriaInvalid) {
      editor.textarea.setAttribute('aria-invalid', String(resolvedAriaInvalid))
    } else {
      editor.textarea.removeAttribute('aria-invalid')
    }

    if (ariaDescribedBy) {
      editor.textarea.setAttribute('aria-describedby', ariaDescribedBy)
    } else {
      editor.textarea.removeAttribute('aria-describedby')
    }
  }, [ariaDescribedBy, ariaInvalid, disabled, id, jsonStatus.isValid, t])

  const formatJson = () => {
    const result = formatJsonDraft(value)
    if (result.didFormat) {
      onChange(result.value)
    }
  }

  const handleCopy = async () => {
    const didCopy = await copyToClipboard(value)
    if (didCopy) {
      toast.success(t('Copied to clipboard'))
      return
    }

    toast.error(t('Failed to copy'))
  }

  const statusMessage = t(jsonStatus.messageKey)
  const cursorText = `${cursorLocation.line}:${cursorLocation.column}`

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
          <Braces className='h-3.5 w-3.5' aria-hidden='true' />
          <span>{t('JSON')}</span>
          <span className='text-muted-foreground/70 font-mono'>
            {cursorText}
          </span>
        </div>
        <div className='flex items-center gap-2'>
          <span
            className={cn(
              'flex items-center gap-1 text-xs',
              jsonStatus.isValid ? 'text-emerald-600' : 'text-destructive'
            )}
          >
            {jsonStatus.isValid ? (
              <CheckCircle2 className='h-3.5 w-3.5' aria-hidden='true' />
            ) : (
              <AlertCircle className='h-3.5 w-3.5' aria-hidden='true' />
            )}
            {statusMessage}
          </span>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            className='h-6 px-2 text-xs'
            onClick={handleCopy}
            disabled={disabled || !value}
          >
            <Copy className='mr-1 h-3.5 w-3.5' aria-hidden='true' />
            {t('Copy')}
          </Button>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            className='h-6 px-2 text-xs'
            onClick={formatJson}
            disabled={disabled || !jsonStatus.isValid || !value.trim()}
          >
            <Code2 className='mr-1 h-3.5 w-3.5' aria-hidden='true' />
            {t('Format JSON')}
          </Button>
        </div>
      </div>
      <div
        className={cn(
          'bg-background relative overflow-hidden pl-2',
          'has-[textarea:disabled]:bg-input/30 has-[textarea:disabled]:opacity-70',
          heightClassName
        )}
      >
        <div
          ref={mountRef}
          className='json-code-editor-yace text-foreground h-full font-mono text-xs leading-5'
        />
      </div>
    </div>
  )
}
