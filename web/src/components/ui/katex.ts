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
import type * as katex from 'katex'

export type KatexModule = typeof katex

let loadedKatex: KatexModule | undefined
let katexImportPromise: Promise<KatexModule> | undefined

const sanitizeOptions = {
  ADD_ATTR: [
    'aria-hidden',
    'class',
    'display',
    'encoding',
    'height',
    'mathvariant',
    'style',
    'xmlns',
  ],
  ADD_TAGS: [
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
  ],
}

export function getLoadedKatex(): KatexModule | undefined {
  return loadedKatex
}

export function loadKatex(): Promise<KatexModule> {
  if (loadedKatex) {
    return Promise.resolve(loadedKatex)
  }

  katexImportPromise ??= Promise.all([
    import('katex'),
    import('katex/dist/katex.min.css'),
  ])
    .then(([katexModule]) => {
      loadedKatex = katexModule
      return katexModule
    })
    .catch((error: unknown) => {
      katexImportPromise = undefined
      throw error
    })

  return katexImportPromise
}

export function renderKatex(
  source: string,
  displayMode: boolean,
  katexModule: KatexModule
): string {
  return katexModule.renderToString(source.trim(), {
    displayMode,
    output: 'htmlAndMathml',
    throwOnError: false,
  })
}

export function sanitizeKatexHtml(html: string): string {
  return DOMPurify.sanitize(html, sanitizeOptions)
}
