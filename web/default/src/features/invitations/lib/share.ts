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
export interface InvitationShareLinks {
  clipboard: string
  email: string
  x: string
  linkedin: string
}

export function buildAffiliateLink(code: string, origin?: string): string {
  const resolvedOrigin =
    origin === undefined && typeof window !== 'undefined'
      ? window.location.origin
      : origin

  if (!code || !resolvedOrigin) {
    return ''
  }

  return `${resolvedOrigin.replace(/\/$/, '')}/sign-up?aff=${encodeURIComponent(code)}`
}

export function buildInvitationShareLinks(
  url: string,
  message: string
): InvitationShareLinks {
  const encodedUrl = encodeURIComponent(url)
  const encodedMessage = encodeURIComponent(message)

  return {
    clipboard: `${message}\n${url}`,
    email: `mailto:?subject=${encodedMessage}&body=${encodedMessage}%0A${encodedUrl}`,
    x: `https://twitter.com/intent/tweet?text=${encodedMessage}&url=${encodedUrl}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
  }
}
