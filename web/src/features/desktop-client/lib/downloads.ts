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
export const CLIENT_VERSION = '0.4.18'

export type DownloadPlatform = 'windows' | 'macos'
export type DownloadChannel = 'official' | 'partner'

export type DownloadEnvironment = {
  userAgent: string
  platform: string
  maxTouchPoints: number
}

export type ResolvedDownload = {
  platform: DownloadPlatform
  channel: DownloadChannel
  url: string
}

const PARTNER_HOSTNAMES = new Set(['ai.yeschoy.io', 'ai.yeschoy.com'])

const DOWNLOAD_URLS = {
  official: {
    windows:
      'https://ergou.qzz.io/updates/releases/official/0.4.18/yeschoy-0.4.18-official-windows-x86_64-installer.exe',
    macos:
      'https://ergou.qzz.io/updates/releases/official/0.4.18/yeschoy-0.4.18-official-macos-universal-installer.dmg',
  },
  partner: {
    windows:
      'https://ergou.qzz.io/updates/releases/partner/0.4.18/yeschoy-0.4.18-partner-windows-x86_64-installer.exe',
    macos:
      'https://ergou.qzz.io/updates/releases/partner/0.4.18/yeschoy-0.4.18-partner-macos-universal-installer.dmg',
  },
} satisfies Record<DownloadChannel, Record<DownloadPlatform, string>>

function isPartnerHostname(hostname: string): boolean {
  return PARTNER_HOSTNAMES.has(hostname.toLowerCase())
}

export function detectDownloadPlatform(
  environment: DownloadEnvironment
): DownloadPlatform | null {
  const userAgent = environment.userAgent.toLowerCase()
  const platform = environment.platform.toLowerCase()
  const isMobile = /android|iphone|ipad|ipod/.test(userAgent)
  const isTouchMac =
    platform.startsWith('mac') && environment.maxTouchPoints > 1

  if (isMobile || isTouchMac) return null
  if (userAgent.includes('windows') || platform.startsWith('win')) {
    return 'windows'
  }
  if (
    userAgent.includes('macintosh') ||
    userAgent.includes('mac os x') ||
    platform.startsWith('mac')
  ) {
    return 'macos'
  }
  return null
}

export function getDownloadUrl(
  platform: DownloadPlatform,
  hostname: string
): string {
  const channel: DownloadChannel = isPartnerHostname(hostname)
    ? 'partner'
    : 'official'
  return DOWNLOAD_URLS[channel][platform]
}

export function resolveDownload(
  environment: DownloadEnvironment,
  hostname: string
): ResolvedDownload | null {
  const platform = detectDownloadPlatform(environment)
  if (!platform) return null
  const channel: DownloadChannel = isPartnerHostname(hostname)
    ? 'partner'
    : 'official'
  return { platform, channel, url: DOWNLOAD_URLS[channel][platform] }
}
