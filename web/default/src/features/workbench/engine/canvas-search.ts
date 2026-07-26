/* Copyright (C) 2023-2026 QuantumNous. Licensed under AGPL-3.0. */
import type { CanvasNodeData } from '../types'

export function searchCanvasNodes(
  nodes: CanvasNodeData[],
  query: string
): CanvasNodeData[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return []
  return nodes.filter((node) => {
    const haystack = [
      node.title,
      node.type,
      node.metadata?.prompt,
      node.metadata?.content,
      node.metadata?.composerContent,
      node.metadata?.storyboard?.rows
        .map(
          (row) =>
            `${row.plotDescription} ${row.dialogue} ${row.imageGenerationPrompt} ${row.videoMotionPrompt}`
        )
        .join(' '),
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase()
    return terms.every((term) => haystack.includes(term))
  })
}
