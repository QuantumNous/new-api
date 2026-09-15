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
import { describe, expect, it } from 'vitest'

import en from '@/i18n/locales/en.json'
import fr from '@/i18n/locales/fr.json'
import ja from '@/i18n/locales/ja.json'
import ru from '@/i18n/locales/ru.json'
import vi from '@/i18n/locales/vi.json'
import zhTW from '@/i18n/locales/zh-TW.json'
import zh from '@/i18n/locales/zh.json'

import { guideDocs } from '../catalog'
import type { GuideBlock } from '../types'

const componentKeys = [
  'Article navigation',
  'Base URL',
  'Browse docs',
  'Choose a group',
  'Choose a guide or search all setup instructions.',
  'Choose a model',
  'Coding tools',
  'Copied',
  'Copied to clipboard',
  'Copy',
  'Copy code',
  'Copy large-context config',
  'Desktop apps',
  'Developer docs',
  'Documentation',
  'Examples update when you change the model or group.',
  'Group',
  'Help',
  'Model',
  'Next',
  'No compatible groups are available',
  'No compatible models are available',
  'No matching docs',
  'On this page',
  'Open documentation navigation',
  'Open Models',
  'Platform',
  'Previous',
  'Retry',
  'Retry before copying a configuration so the model and group stay accurate.',
  'Search documentation',
  'Search results',
  'Start here',
  'This account has no model enabled for the protocol required by this article.',
  'We could not verify your setup',
  'Your current setup',
  '{{count}} min read',
  '{{platform}} instructions selected',
]

function addBlockKeys(block: GuideBlock, keys: Set<string>): void {
  if (block.type === 'paragraph') {
    keys.add(block.text)
    return
  }
  if (block.type === 'steps') {
    for (const item of block.items) {
      keys.add(item.title)
      if (item.text) keys.add(item.text)
      if (item.code) {
        keys.add(item.code.label)
        if (item.code.copyLabel) keys.add(item.code.copyLabel)
      }
      if (item.action) keys.add(item.action.label)
    }
    return
  }
  if (block.type === 'code') {
    keys.add(block.label)
    if (block.copyLabel) keys.add(block.copyLabel)
    return
  }
  if (block.type === 'callout') {
    keys.add(block.title)
    keys.add(block.text)
    return
  }
  if (block.type === 'table') {
    block.columns.forEach((key) => keys.add(key))
    block.rows.flat().forEach((key) => keys.add(key))
    return
  }
  if (block.type === 'platform') {
    Object.values(block.platforms).forEach((blocks) =>
      blocks?.forEach((item) => addBlockKeys(item, keys))
    )
    return
  }
  keys.add(block.supportedTitle)
  keys.add(block.supportedText)
  keys.add(block.unavailableTitle)
  keys.add(block.unavailableText)
}

function getGuideKeys(): string[] {
  const keys = new Set(componentKeys)
  for (const doc of guideDocs) {
    keys.add(doc.title)
    keys.add(doc.summary)
    for (const section of doc.sections) {
      keys.add(section.title)
      section.blocks.forEach((block) => addBlockKeys(block, keys))
    }
  }
  return [...keys]
}

function placeholders(value: string): string[] {
  return (value.match(/\{\{[^}]+\}\}/g) ?? []).sort()
}

describe.each(Object.entries({ en, zh, 'zh-TW': zhTW, fr, ja, ru, vi }))(
  'developer guide translations for %s',
  (_locale, resource) => {
    const translations = resource.translation as Record<string, string>
    const english = en.translation as Record<string, string>

    it('translates every guide key and preserves placeholders', () => {
      for (const key of getGuideKeys()) {
        expect(translations[key], key).toBeTruthy()
        expect(placeholders(translations[key]), key).toEqual(
          placeholders(english[key] ?? key)
        )
      }
    })
  }
)
