import { describe, expect, test } from 'vitest'

import { syncStatusToRelease } from '../hw-sync-status'
import { getSystemReleaseUrl } from '../releases'

describe('sync status payload', () => {
  const status = {
    success: true,
    data: {
      upstreamTag: 'v1.0.0-rc.48',
      mergedTag: 'v1.0.0-rc.47',
      prNumber: 231,
      checkedAt: '2026-11-05T04:21:00Z',
    },
  }

  test('maps the upstream tag and check time onto a release', () => {
    expect(syncStatusToRelease(status)).toEqual({
      tag_name: 'v1.0.0-rc.48',
      published_at: '2026-11-05T04:21:00Z',
      prerelease: false,
      merged: 'v1.0.0-rc.47',
      prNumber: 231,
    })
  })

  test('accepts a status without a merged tag or an open pull request', () => {
    expect(
      syncStatusToRelease({
        success: true,
        data: { ...status.data, mergedTag: null, prNumber: null },
      })
    ).toMatchObject({ merged: null, prNumber: null })
  })

  test('rejects a failed or malformed response instead of reporting that the fork is current', () => {
    expect(() => syncStatusToRelease({ success: false, data: null })).toThrow()
    expect(() => syncStatusToRelease({ message: 'bad response' })).toThrow()
    expect(() =>
      syncStatusToRelease({
        success: true,
        data: { ...status.data, prNumber: '231' },
      })
    ).toThrow()
    expect(() =>
      syncStatusToRelease({
        success: true,
        data: { ...status.data, checkedAt: 'today' },
      })
    ).toThrow()
  })
})

describe('release destination', () => {
  test('points at the open sync pull request when there is one', () => {
    expect(
      getSystemReleaseUrl({
        tag_name: 'v1.0.0-rc.48',
        prerelease: false,
        prNumber: 231,
      })
    ).toBe('https://github.com/hisarweb-be/hisarweb-ai/pull/231')
  })

  test('falls back to our own repository without a pull request', () => {
    for (const prNumber of [null, undefined]) {
      expect(
        getSystemReleaseUrl({
          tag_name: 'v1.0.0-rc.48',
          prerelease: false,
          prNumber,
        })
      ).toBe('https://github.com/hisarweb-be/hisarweb-ai')
    }
  })
})
