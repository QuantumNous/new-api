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
import type { ReactNode } from 'react'
import type { ParsedNode } from 'stream-markdown-parser'

import { isFootnoteNode } from './response-node-guards'
import type { ParsedResponseContent } from './response-types'

export function stripCustomTags(input: unknown): string {
  if (typeof input !== 'string') {
    return String(input ?? '')
  }

  return input
    .replaceAll(
      /<\/?(conversation|conversationcontent|reasoning|reasoningcontent|reasoningtrigger|sources|sourcescontent|sourcestrigger|branch|branchmessages|branchnext|branchpage|branchprevious|branchselector|message|messagecontent)\b[^>]*>/gi,
      ''
    )
    .replaceAll(/<\/?think\b[^>]*>/gi, '')
}

export function getMarkdownContent(children: ReactNode): string {
  if (Array.isArray(children)) {
    return stripCustomTags(children.join(''))
  }

  return stripCustomTags(children)
}

export function getNodeKey(node: ParsedNode, index: number): string {
  const raw = typeof node.raw === 'string' ? node.raw : ''
  return `${node.type}-${index}-${raw.slice(0, 24)}`
}

export function parseResponseContent(
  nodes: ParsedNode[]
): ParsedResponseContent {
  const footnotes: ParsedResponseContent['footnotes'] = []
  const bodyNodes: ParsedNode[] = []

  for (const node of nodes) {
    if (isFootnoteNode(node)) {
      footnotes.push(node)
      continue
    }

    bodyNodes.push(node)
  }

  return { bodyNodes, footnotes }
}
