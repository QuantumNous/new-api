import { describe, expect, test } from 'vitest'
import {
  getDefaultImportProtectionRules,
  getMarkerSpecifiers,
} from '../../src/import-protection/defaults'

describe('getDefaultImportProtectionRules', () => {
  test('returns client rules with all framework specifiers', () => {
    const rules = getDefaultImportProtectionRules()

    expect(rules.client.specifiers).toEqual(
      expect.arrayContaining([
        '@tanstack/react-start/server',
        '@tanstack/solid-start/server',
        '@tanstack/vue-start/server',
      ]),
    )

    expect(rules.client.files).toEqual(
      expect.arrayContaining(['**/*.server.*']),
    )
  })

  test('returns client excludeFiles defaulting to node_modules', () => {
    const rules = getDefaultImportProtectionRules()

    expect(rules.client.excludeFiles).toEqual(
      expect.arrayContaining(['**/node_modules/**']),
    )
  })

  test('returns server rules', () => {
    const rules = getDefaultImportProtectionRules()

    expect(rules.server.specifiers).toEqual([])

    expect(rules.server.files).toEqual(
      expect.arrayContaining(['**/*.client.*']),
    )
  })

  test('returns server excludeFiles defaulting to node_modules', () => {
    const rules = getDefaultImportProtectionRules()

    expect(rules.server.excludeFiles).toEqual(
      expect.arrayContaining(['**/node_modules/**']),
    )
  })
})

describe('getMarkerSpecifiers', () => {
  test('returns server-only and client-only markers', () => {
    const markers = getMarkerSpecifiers()

    expect(markers.serverOnly).toContain('@tanstack/react-start/server-only')
    expect(markers.clientOnly).toContain('@tanstack/react-start/client-only')
  })

  test('includes all frameworks', () => {
    const markers = getMarkerSpecifiers()

    expect(markers.serverOnly.length).toBe(3)
    expect(markers.clientOnly.length).toBe(3)

    expect(markers.serverOnly).toContain('@tanstack/solid-start/server-only')
    expect(markers.clientOnly).toContain('@tanstack/vue-start/client-only')
  })
})
