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
import { codingToolDocs } from './content/coding-tools'
import { desktopAndHelpDocs } from './content/desktop-and-help'
import { gettingStartedDocs } from './content/getting-started'
import type { GuideBlock, GuideDoc, GuideDocSlug, GuideSection } from './types'

export const guideDocs: ReadonlyArray<GuideDoc> = [
  ...gettingStartedDocs,
  ...codingToolDocs,
  ...desktopAndHelpDocs,
]

const guideDocsBySlug = new Map(guideDocs.map((doc) => [doc.slug, doc]))

export function getGuideDoc(slug: string): GuideDoc | undefined {
  return guideDocsBySlug.get(slug as GuideDocSlug)
}

export function getGuideNeighbors(slug: GuideDocSlug): {
  previous: GuideDoc | null
  next: GuideDoc | null
} {
  const index = guideDocs.findIndex((doc) => doc.slug === slug)
  if (index < 0) return { previous: null, next: null }
  return {
    previous: guideDocs[index - 1] ?? null,
    next: guideDocs[index + 1] ?? null,
  }
}

function collectBlockKeys(block: GuideBlock, keys: string[]): void {
  if (block.type === 'paragraph') {
    keys.push(block.text)
    return
  }
  if (block.type === 'steps') {
    for (const item of block.items) {
      keys.push(item.title)
      if (item.text) keys.push(item.text)
      if (item.code) keys.push(item.code.label, item.code.copyLabel ?? '')
      if (item.action) keys.push(item.action.label)
    }
    return
  }
  if (block.type === 'code') {
    keys.push(block.label, block.copyLabel ?? '')
    return
  }
  if (block.type === 'callout') {
    keys.push(block.title, block.text)
    return
  }
  if (block.type === 'table') {
    keys.push(...block.columns)
    for (const row of block.rows) keys.push(...row)
    return
  }
  if (block.type === 'platform') {
    for (const platformBlocks of Object.values(block.platforms)) {
      for (const platformBlock of platformBlocks ?? []) {
        collectBlockKeys(platformBlock, keys)
      }
    }
    return
  }
  keys.push(
    block.supportedTitle,
    block.supportedText,
    block.unavailableTitle,
    block.unavailableText
  )
}

export function getGuideSearchText(
  doc: GuideDoc,
  translate: (key: string) => string
): string {
  return [
    translate(doc.title),
    translate(doc.summary),
    ...doc.sections.map((section) =>
      getGuideSectionSearchText(section, translate)
    ),
  ].join(' ')
}

export function getGuideSectionSearchText(
  section: GuideSection,
  translate: (key: string) => string
): string {
  const keys = [section.title]
  for (const block of section.blocks) collectBlockKeys(block, keys)
  return keys.filter(Boolean).map(translate).join(' ')
}

export function getGuideBlockKey(block: GuideBlock): string {
  if (block.type === 'paragraph') return `paragraph:${block.text}`
  if (block.type === 'steps') {
    return `steps:${block.items.map((item) => item.title).join('|')}`
  }
  if (block.type === 'code') return `code:${block.label}`
  if (block.type === 'callout') return `callout:${block.title}`
  if (block.type === 'table') return `table:${block.columns.join('|')}`
  if (block.type === 'platform') {
    return `platform:${Object.keys(block.platforms).join('|')}`
  }
  return `context-window:${block.supportedTitle}`
}
