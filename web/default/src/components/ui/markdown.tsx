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
import DOMPurify from 'dompurify'
import * as katex from 'katex'
import 'katex/dist/katex.min.css'
import { Marked, Renderer, type MarkedExtension, type Tokens } from 'marked'
import { useMemo } from 'react'
import { cn } from '@/lib/utils'

interface MarkdownProps {
  children: string
  className?: string
}

const markdownOptions = {
  async: false,
  breaks: false,
  gfm: true,
} as const

const emojiShortcodes: Record<string, string> = {
  ':fa-gear:': '\u2699\ufe0f',
  ':fa-star:': '\u2b50',
  ':smiley:': '\ud83d\ude03',
  ':star:': '\u2b50',
}

const allowedAttributes = ['checked', 'class', 'disabled', 'height', 'style', 'target', 'width']

const allowedTags = [
  'annotation',
  'math',
  'mfrac',
  'mi',
  'mn',
  'mo',
  'mover',
  'mpadded',
  'mrow',
  'mspace',
  'msqrt',
  'mstyle',
  'msub',
  'msubsup',
  'msup',
  'mtable',
  'mtd',
  'mtext',
  'mtr',
  'semantics',
]

const sanitizeOptions = {
  ADD_ATTR: allowedAttributes,
  ADD_TAGS: allowedTags,
} as const

function normalizeMathSource(source: string): string {
  return source
    .trim()
    .replace(/^\\\(/, '')
    .replace(/\\\)$/, '')
    .replace(/^\\\[/, '')
    .replace(/\\\]$/, '')
}

function renderMath(source: string, displayMode: boolean): string {
  return katex.renderToString(normalizeMathSource(source), {
    displayMode,
    output: 'htmlAndMathml',
    throwOnError: false,
  })
}

function replaceEmojiShortcodes(value: string): string {
  return value.replace(/:(?:smiley|star|fa-star|fa-gear):/g, (shortcode) => {
    return emojiShortcodes[shortcode] ?? shortcode
  })
}

const markdownRenderer = new Renderer()
const renderDefaultCode = markdownRenderer.code.bind(markdownRenderer)

markdownRenderer.code = (token: Tokens.Code): string => {
  const language = token.lang?.toLowerCase()

  if (language === 'math' || language === 'katex' || language === 'latex') {
    return renderMath(token.text, true)
  }

  return renderDefaultCode(token)
}

const markdownExtensions: MarkedExtension[] = [
  {
    walkTokens(token) {
      if (token.type !== 'text') {
        return
      }

      token.text = replaceEmojiShortcodes(token.text)
    },
    extensions: [
      {
        level: 'block',
        name: 'pageBreak',
        renderer() {
          return '<hr class="markdown-page-break">'
        },
        start(source: string) {
          return source.match(/^\[========\]/m)?.index
        },
        tokenizer(source: string) {
          const match = /^\[========\](?:\n|$)/.exec(source)

          if (!match) {
            return undefined
          }

          return {
            raw: match[0],
            type: 'pageBreak',
          }
        },
      },
      {
        level: 'block',
        name: 'blockMath',
        renderer(token) {
          return renderMath(String(token.text), true)
        },
        start(source: string) {
          return source.match(/^\$\$/m)?.index
        },
        tokenizer(source: string) {
          const match = /^\$\$\n?([\s\S]+?)\n?\$\$(?:\n|$)/.exec(source)

          if (!match) {
            return undefined
          }

          return {
            raw: match[0],
            text: match[1],
            type: 'blockMath',
          }
        },
      },
      {
        level: 'inline',
        name: 'inlineMath',
        renderer(token) {
          return renderMath(String(token.text), false)
        },
        start(source: string) {
          const index = source.indexOf('$$')

          if (index === -1) {
            return undefined
          }

          return index
        },
        tokenizer(source: string) {
          const match = /^\$\$([^\n$]+?)\$\$/.exec(source)

          if (!match) {
            return undefined
          }

          return {
            raw: match[0],
            text: match[1],
            type: 'inlineMath',
          }
        },
      },
    ],
  },
]

const markdownParser = new Marked({
  ...markdownOptions,
  renderer: markdownRenderer,
})

markdownParser.use(...markdownExtensions)

function addExternalLinkAttributes(html: string): string {
  if (typeof window === 'undefined') {
    return html
  }

  const template = document.createElement('template')
  template.innerHTML = html

  template.content.querySelectorAll('a[href]').forEach((link) => {
    link.setAttribute('target', '_blank')
    link.setAttribute('rel', 'noopener noreferrer')
  })

  return template.innerHTML
}

function renderMarkdown(markdown: string): string {
  const parsedHtml = markdownParser.parse(markdown, markdownOptions)
  const html = DOMPurify.sanitize(parsedHtml, sanitizeOptions)

  return addExternalLinkAttributes(html)
}

export function Markdown(props: MarkdownProps) {
  const html = useMemo(() => renderMarkdown(props.children), [props.children])

  return (
    <div
      className={cn(
        'prose prose-sm dark:prose-invert max-w-none',
        'prose-headings:font-semibold prose-headings:tracking-tight',
        'prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg',
        'prose-p:leading-relaxed prose-p:my-2',
        'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
        'prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none',
        'prose-pre:bg-muted prose-pre:border',
        'prose-blockquote:border-l-primary prose-blockquote:bg-muted/50 prose-blockquote:py-1',
        'prose-ul:my-2 prose-ol:my-2 prose-li:my-1',
        'prose-table:border prose-thead:bg-muted',
        'prose-td:border prose-th:border prose-td:px-3 prose-th:px-3',
        'prose-img:rounded-lg prose-img:shadow-sm',
        '[&_.katex-display]:my-4 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden',
        '[&_.markdown-page-break]:my-6 [&_.markdown-page-break]:border-dashed',
        '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
        '[overflow-wrap:anywhere] break-words',
        props.className
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
