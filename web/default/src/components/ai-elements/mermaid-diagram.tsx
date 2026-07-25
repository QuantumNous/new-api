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
'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useTheme } from '@/context/theme-provider'

import { CodeBlock, CodeBlockCopyButton, CodeBlockFrame } from './code-block'
import { FenceViewToggle, type FenceView } from './fence-view-toggle'

type MermaidFenceProps = {
  code: string
  final: boolean
}

let mermaidPromise: Promise<(typeof import('mermaid'))['default']> | null = null
let mermaidRenderId = 0

function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((module) => module.default)
  }
  return mermaidPromise
}

/**
 * Renders ```mermaid fences as diagrams once the message is final.
 * While streaming (or when the source fails to parse) the raw code shows.
 */
export function MermaidFence(props: MermaidFenceProps) {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const [view, setView] = useState<FenceView>('preview')
  const [svg, setSvg] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!props.final) return
    let cancelled = false

    const render = async () => {
      try {
        const mermaid = await loadMermaid()
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: resolvedTheme === 'dark' ? 'dark' : 'default',
        })
        await mermaid.parse(props.code)
        const result = await mermaid.render(
          `playground-mermaid-${++mermaidRenderId}`,
          props.code
        )
        if (cancelled) return
        setSvg(result.svg)
        setFailed(false)
      } catch {
        if (cancelled) return
        setSvg(null)
        setFailed(true)
      }
    }

    void render()
    return () => {
      cancelled = true
    }
  }, [props.code, props.final, resolvedTheme])

  const codeBlock = (
    <CodeBlock
      code={props.code}
      collapsedLines={14}
      defaultCollapsed={false}
      language='mermaid'
      maxExpandedLines={44}
      showLineNumbers
      showToolbar
      title='mermaid'
    >
      {props.final && !failed && (
        <FenceViewToggle view='code' onViewChange={setView} />
      )}
      <CodeBlockCopyButton />
    </CodeBlock>
  )

  if (!props.final || failed || (view === 'code' && svg !== null)) {
    return codeBlock
  }

  if (svg === null) {
    return (
      <CodeBlockFrame showToolbar title='mermaid'>
        <div className='text-muted-foreground p-4 text-sm'>
          {t('Rendering diagram…')}
        </div>
      </CodeBlockFrame>
    )
  }

  return (
    <CodeBlockFrame
      showToolbar
      title='mermaid'
      endActions={<FenceViewToggle view='preview' onViewChange={setView} />}
      bodyClassName='p-0'
    >
      <div
        className='flex justify-center overflow-x-auto p-4 [&_svg]:h-auto [&_svg]:max-w-full'
        // eslint-disable-next-line react/no-danger -- SVG produced locally by mermaid with securityLevel: 'strict'
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </CodeBlockFrame>
  )
}
