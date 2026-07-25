import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const computeDeploySource = readFileSync(
  new URL('./index.tsx', import.meta.url),
  'utf8'
)

describe('GPU Instances availability label', () => {
  test('marks the GPU Instances tab as coming soon', () => {
    const instancesTab = computeDeploySource.match(
      /<TabsTrigger value='instances'>([\s\S]*?)<\/TabsTrigger>/
    )?.[1]

    expect(instancesTab).toContain("{t('GPU Instances')}")
    expect(instancesTab).toContain('<Badge')
    expect(instancesTab).toContain("{t('Coming soon')}")
  })

  test('keeps the label translated in every supported locale', () => {
    const localeFiles = ['en', 'zh', 'fr', 'ru', 'ja', 'vi', 'es', 'pt']

    for (const locale of localeFiles) {
      const localeBundle = JSON.parse(
        readFileSync(
          new URL(`../../i18n/locales/${locale}.json`, import.meta.url),
          'utf8'
        )
      ) as { translation: Record<string, string> }
      const messages = localeBundle.translation

      expect(messages['Coming soon']).toBeTruthy()
      if (locale !== 'en') {
        expect(messages['Coming soon']).not.toBe('Coming soon')
      }
    }
  })
})
