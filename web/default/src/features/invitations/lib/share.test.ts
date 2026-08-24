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
import { describe, expect, it } from 'bun:test'
import { buildAffiliateLink, buildInvitationShareLinks } from './share'

describe('buildAffiliateLink', () => {
  it('builds a registration link from an explicit origin', () => {
    expect(buildAffiliateLink('invite-code', 'https://console.example')).toBe(
      'https://console.example/sign-up?aff=invite-code'
    )
  })

  it('URL-encodes spaces and special characters in the affiliate code', () => {
    expect(buildAffiliateLink('code with /?&', 'https://console.example')).toBe(
      'https://console.example/sign-up?aff=code%20with%20%2F%3F%26'
    )
  })

  it('returns an empty string without a code', () => {
    expect(buildAffiliateLink('', 'https://console.example')).toBe('')
  })

  it('returns an empty string for an explicit empty origin', () => {
    expect(buildAffiliateLink('invite-code', '')).toBe('')
  })

  it('returns an empty string during SSR when origin is omitted', () => {
    expect(buildAffiliateLink('invite-code')).toBe('')
  })
})

describe('buildInvitationShareLinks', () => {
  const invitationUrl = 'https://console.example/sign-up?aff=code%20with%20%26'
  const message = 'Join me & save / explore?'

  it('builds clipboard text with the share message before the invitation URL', () => {
    const links = buildInvitationShareLinks(invitationUrl, message)

    expect(links.clipboard).toBe(`${message}\n${invitationUrl}`)
  })

  it('builds an encoded email share target', () => {
    const links = buildInvitationShareLinks(invitationUrl, message)

    expect(links.email).toBe(
      `mailto:?subject=${encodeURIComponent(message)}&body=${encodeURIComponent(message)}%0A${encodeURIComponent(invitationUrl)}`
    )
  })

  it('builds an encoded X share target', () => {
    const links = buildInvitationShareLinks(invitationUrl, message)

    expect(links.x).toBe(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(invitationUrl)}`
    )
  })

  it('builds an encoded LinkedIn share-offsite target', () => {
    const links = buildInvitationShareLinks(invitationUrl, message)

    expect(links.linkedin).toBe(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(invitationUrl)}`
    )
  })
})
