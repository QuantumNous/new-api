import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'

const localeNames = ['zh', 'en', 'fr', 'ja', 'ru', 'vi'] as const

const modelStatusKeys = [
  'No updates yet',
  'Model status filters',
  'Filter by status',
  'Current',
  'Availability',
  'Now',
] as const

describe('model status i18n', () => {
  for (const localeName of localeNames) {
    test(`${localeName} includes all model status translation keys`, () => {
      const locale = JSON.parse(
        readFileSync(`src/i18n/locales/${localeName}.json`, 'utf8')
      ) as {
        translation: Record<string, string>
      }

      for (const key of modelStatusKeys) {
        assert.ok(
          Object.hasOwn(locale.translation, key),
          `${localeName} is missing "${key}"`
        )
      }
    })
  }
})
