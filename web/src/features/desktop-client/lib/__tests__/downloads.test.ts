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

import {
  detectDownloadPlatform,
  getDownloadUrl,
  resolveDownload,
  type DownloadEnvironment,
} from '../downloads'

const WINDOWS: DownloadEnvironment = {
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
  platform: 'Win32',
  maxTouchPoints: 0,
}

const MACOS: DownloadEnvironment = {
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15',
  platform: 'MacIntel',
  maxTouchPoints: 0,
}

const IPAD_DESKTOP_UA: DownloadEnvironment = {
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1',
  platform: 'MacIntel',
  maxTouchPoints: 5,
}

describe('download platform detection', () => {
  it.each([
    ['Windows UA', WINDOWS, 'windows'],
    ['macOS UA', MACOS, 'macos'],
    ['iPad desktop UA', IPAD_DESKTOP_UA, null],
    [
      'Android',
      {
        userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile',
        platform: 'Linux armv8l',
        maxTouchPoints: 5,
      },
      null,
    ],
    [
      'Linux',
      {
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/126.0',
        platform: 'Linux x86_64',
        maxTouchPoints: 0,
      },
      null,
    ],
    ['empty values', { userAgent: '', platform: '', maxTouchPoints: 0 }, null],
  ] as const)('detects %s', (_name, environment, expected) => {
    expect(detectDownloadPlatform(environment)).toBe(expected)
  })
})

describe('download URL resolution', () => {
  it('uses partner files only for the exact partner hostname', () => {
    expect(getDownloadUrl('windows', 'ai.yeschoy.io')).toBe(
      'https://ergou.qzz.io/releases/partner/yeschoy-windows-x86_64-installer.exe'
    )
    expect(getDownloadUrl('macos', 'AI.YESCHOY.IO')).toBe(
      'https://ergou.qzz.io/releases/partner/yeschoy-macos-universal-installer.dmg'
    )
    expect(getDownloadUrl('windows', 'ai.yeschoy.com')).toContain(
      '/releases/partner/'
    )

    for (const hostname of [
      'yeschoy.io',
      'yeschoy.com',
      'www.ai.yeschoy.io',
      'ai.yeschoy.com.example.com',
      'localhost',
      '',
    ]) {
      expect(getDownloadUrl('windows', hostname)).toContain(
        '/releases/official/'
      )
    }
  })

  it('returns a complete platform, channel, and URL result', () => {
    expect(resolveDownload(MACOS, 'example.com')).toEqual({
      platform: 'macos',
      channel: 'official',
      url: 'https://ergou.qzz.io/releases/official/yeschoy-macos-universal-installer.dmg',
    })
    expect(resolveDownload(IPAD_DESKTOP_UA, 'ai.yeschoy.io')).toBeNull()
  })
})
