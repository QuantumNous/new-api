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
/* eslint-disable react-refresh/only-export-components */
'use client'

import {
  type ComponentProps,
  createContext,
  type HTMLAttributes,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { Element } from 'hast'
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { BundledLanguage, ShikiTransformer } from 'shiki'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type CodeBlockProps = HTMLAttributes<HTMLDivElement> & {
  code: string
  defaultCollapsed?: boolean
  enableCollapse?: boolean
  filename?: string
  language: BundledLanguage | string
  maxCollapsedLines?: number
  showLineNumbers?: boolean
  showToolbar?: boolean
  title?: ReactNode
}

type CodeBlockContextType = {
  code: string
  language: string
}

const CodeBlockContext = createContext<CodeBlockContextType>({
  code: '',
  language: 'plaintext',
})

const highlightCache = new Map<string, string>()

const LANGUAGE_ALIASES: Record<string, BundledLanguage> = {
  csharp: 'c#',
  golang: 'go',
  js: 'javascript',
  shell: 'bash',
  shellscript: 'bash',
  ts: 'typescript',
}

const lineNumberTransformer: ShikiTransformer = {
  name: 'line-numbers',
  line(node: Element, line: number) {
    node.children.unshift({
      type: 'element',
      tagName: 'span',
      properties: {
        className: [
          'inline-block',
          'min-w-10',
          'mr-4',
          'text-right',
          'select-none',
          'text-muted-foreground',
        ],
      },
      children: [{ type: 'text', value: String(line) }],
    })
  },
}

function getRequestedCodeLanguage(language?: string) {
  const normalized = language?.trim().toLowerCase() || 'plaintext'
  return LANGUAGE_ALIASES[normalized] ?? normalized
}

async function normalizeCodeLanguage(language?: string) {
  const aliased = getRequestedCodeLanguage(language)
  const { bundledLanguages } = await import('shiki')
  if (aliased in bundledLanguages) {
    return aliased as BundledLanguage
  }

  return 'plaintext'
}

function escapeCodeHtml(code: string) {
  return code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderPlainCodeHtml(code: string, showLineNumbers: boolean) {
  const lines = code.split('\n')
  const renderedCode = lines
    .map((line, index) => {
      const escapedLine = escapeCodeHtml(line) || ' '
      if (!showLineNumbers) {
        return escapedLine
      }

      return `<span class="inline-block min-w-10 mr-4 text-right select-none text-muted-foreground">${index + 1}</span>${escapedLine}`
    })
    .join('\n')

  return `<pre class="shiki"><code>${renderedCode}</code></pre>`
}

export async function highlightCode(
  code: string,
  language: BundledLanguage | string,
  showLineNumbers = false
) {
  const resolvedLanguage = await normalizeCodeLanguage(language)
  const cacheKey = `${resolvedLanguage}:${showLineNumbers ? 'line' : 'plain'}:${code}`
  const cachedHtml = highlightCache.get(cacheKey)

  if (cachedHtml) {
    return cachedHtml
  }

  const transformers: ShikiTransformer[] = showLineNumbers
    ? [lineNumberTransformer]
    : []

  if (resolvedLanguage === 'plaintext') {
    const html = renderPlainCodeHtml(code, showLineNumbers)
    highlightCache.set(cacheKey, html)
    return html
  }

  const { codeToHtml } = await import('shiki')
  const html = await codeToHtml(code, {
    lang: resolvedLanguage,
    themes: {
      light: 'one-light',
      dark: 'one-dark-pro',
    },
    defaultColor: false,
    transformers,
  })

  highlightCache.set(cacheKey, html)
  return html
}

function getCodeLineCount(code: string) {
  if (!code) {
    return 1
  }

  return code.split('\n').length
}

function getDownloadFilename(language: string, filename?: string) {
  if (filename) {
    return filename
  }

  const extension = language === 'plaintext' ? 'txt' : language
  return `code.${extension}`
}

export const CodeBlock = ({
  code,
  defaultCollapsed,
  enableCollapse = true,
  filename,
  language,
  maxCollapsedLines = 24,
  showLineNumbers = false,
  showToolbar = false,
  title,
  className,
  children,
  ...props
}: CodeBlockProps) => {
  const { t } = useTranslation()
  const [html, setHtml] = useState<string>('')
  const [isCollapsed, setIsCollapsed] = useState(Boolean(defaultCollapsed))
  const displayLanguage = getRequestedCodeLanguage(language)
  const lineCount = useMemo(() => getCodeLineCount(code), [code])
  const canCollapse = enableCollapse && lineCount > maxCollapsedLines
  const isCodeCollapsed = canCollapse && isCollapsed
  const displayTitle = title ?? displayLanguage
  const bodyMaxHeight = isCodeCollapsed
    ? `${Math.max(10, maxCollapsedLines) * 1.5 + 2}rem`
    : undefined

  useEffect(() => {
    let cancelled = false
    highlightCode(code, language, showLineNumbers)
      .then((next) => {
        if (!cancelled) {
          setHtml(next)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHtml(renderPlainCodeHtml(code, showLineNumbers))
        }
      })
    return () => {
      cancelled = true
    }
  }, [code, language, showLineNumbers])

  const downloadCode = () => {
    if (typeof window === 'undefined') {
      return
    }

    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = getDownloadFilename(displayLanguage, filename)
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <CodeBlockContext.Provider value={{ code, language: displayLanguage }}>
      <div
        className={cn(
          'group/code-block bg-muted/20 text-foreground my-3 w-full max-w-full overflow-hidden rounded-lg border shadow-xs',
          className
        )}
        {...props}
      >
        {showToolbar && (
          <div className='bg-muted/35 border-border/70 flex min-h-10 items-center gap-2 border-b px-2 py-1.5'>
            <div className='min-w-0 flex-1'>
              <div className='text-muted-foreground truncate font-mono text-[11px] font-medium tracking-wide uppercase'>
                {displayTitle}
              </div>
            </div>
            <div className='flex shrink-0 items-center gap-1'>
              {canCollapse && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        aria-label={
                          isCodeCollapsed ? t('Expand') : t('Collapse')
                        }
                        className='size-8'
                        onClick={() => setIsCollapsed((value) => !value)}
                        size='icon-sm'
                        type='button'
                        variant='ghost'
                      >
                        {isCodeCollapsed ? (
                          <ChevronRightIcon className='size-4' />
                        ) : (
                          <ChevronDownIcon className='size-4' />
                        )}
                      </Button>
                    }
                  />
                  <TooltipContent>
                    <p>{isCodeCollapsed ? t('Expand') : t('Collapse')}</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {children}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      aria-label={t('Download')}
                      className='size-8'
                      onClick={downloadCode}
                      size='icon-sm'
                      type='button'
                      variant='ghost'
                    >
                      <DownloadIcon className='size-4' />
                    </Button>
                  }
                />
                <TooltipContent>
                  <p>{t('Download')}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}
        <div className='relative min-w-0'>
          <div
            className={cn(
              'code-block-scroll max-w-full overflow-auto transition-[max-height] duration-200 ease-out',
              '[&_.shiki]:bg-transparent! [&_.shiki]:text-foreground! [&_code]:font-mono [&_code]:text-[13px] [&_code]:leading-6',
              '[&>pre]:m-0 [&>pre]:min-w-max [&>pre]:p-4 [&>pre]:text-[13px] [&>pre]:leading-6'
            )}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: "this is needed."
            dangerouslySetInnerHTML={{ __html: html }}
            style={{ maxHeight: bodyMaxHeight }}
          />
          {isCodeCollapsed && (
            <div className='from-muted/20 pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-b to-background' />
          )}
          {!showToolbar && children && (
            <div className='absolute top-2 right-2 flex items-center gap-1'>
              {children}
            </div>
          )}
        </div>
      </div>
    </CodeBlockContext.Provider>
  )
}

export type CodeBlockCopyButtonProps = ComponentProps<typeof Button> & {
  onCopy?: () => void
  onError?: (error: Error) => void
  timeout?: number
}

export const CodeBlockCopyButton = ({
  onCopy,
  onError,
  timeout = 2000,
  children,
  className,
  ...props
}: CodeBlockCopyButtonProps) => {
  const { t } = useTranslation()
  const [isCopied, setIsCopied] = useState(false)
  const { code } = useContext(CodeBlockContext)

  const copyToClipboard = async () => {
    if (typeof window === 'undefined' || !navigator?.clipboard?.writeText) {
      onError?.(new Error('Clipboard API not available'))
      return
    }

    try {
      await navigator.clipboard.writeText(code)
      setIsCopied(true)
      onCopy?.()
      setTimeout(() => setIsCopied(false), timeout)
    } catch (error) {
      onError?.(error as Error)
    }
  }

  const Icon = isCopied ? CheckIcon : CopyIcon

  const button = (
    <Button
      aria-label={isCopied ? t('Copied!') : t('Copy code')}
      className={cn('size-8 shrink-0', className)}
      onClick={copyToClipboard}
      size='icon-sm'
      type='button'
      variant='ghost'
      {...props}
    >
      {children ?? <Icon size={14} />}
    </Button>
  )

  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent>
        <p>{isCopied ? t('Copied!') : t('Copy code')}</p>
      </TooltipContent>
    </Tooltip>
  )
}
