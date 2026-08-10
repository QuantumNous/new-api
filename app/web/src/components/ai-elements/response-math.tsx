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
import { useEffect, useState } from 'react'

import {
  getLoadedKatex,
  loadKatex,
  renderKatex,
  sanitizeKatexHtml,
  type KatexModule,
} from '@/components/ui/katex'

type ResponseMathProps = {
  displayMode: boolean
  source: string
}

export function ResponseMath({ displayMode, source }: ResponseMathProps) {
  const [katex, setKatex] = useState<KatexModule | undefined>(getLoadedKatex)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    if (katex || loadFailed) {
      return
    }

    let cancelled = false
    void loadKatex()
      .then((loadedKatex) => {
        if (!cancelled) {
          setKatex(loadedKatex)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [katex, loadFailed])

  if (!katex) {
    return displayMode ? (
      <pre
        className='border-border bg-muted/40 my-4 overflow-x-auto rounded-lg border p-4 font-mono text-sm'
        data-math-fallback
      >
        {source}
      </pre>
    ) : (
      <code
        className='bg-muted/70 text-foreground rounded px-1 py-0.5 font-mono text-[0.9em]'
        data-math-fallback
      >
        {source}
      </code>
    )
  }

  const html = sanitizeKatexHtml(renderKatex(source, displayMode, katex))

  return displayMode ? (
    <div
      className='my-4 overflow-x-auto'
      // eslint-disable-next-line react/no-danger -- KaTeX output is sanitized above
      dangerouslySetInnerHTML={{ __html: html }}
    />
  ) : (
    // eslint-disable-next-line react/no-danger -- KaTeX output is sanitized above
    <span dangerouslySetInnerHTML={{ __html: html }} />
  )
}

export type { ResponseMathProps }
