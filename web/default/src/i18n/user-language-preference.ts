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
import type { i18n as I18nInstance } from 'i18next'
import { api } from '@/lib/api'
import { persistLanguagePreferenceCookie } from './language-preference-cookie'
import {
  type InterfaceLanguageCode,
  isInterfaceLanguageCode,
} from './languages'

export type UserLanguageSource = {
  id?: unknown
  language?: unknown
  setting?: unknown
}

type UserLanguageSetter<T extends UserLanguageSource> = (
  user: T | null | ((currentUser: T | null) => T | null)
) => void

function normalizeLanguage(value?: string | null): InterfaceLanguageCode | null {
  const normalized = value?.trim().replace(/_/g, '-').toLowerCase()
  if (!normalized) return null

  const primary = normalized.startsWith('zh')
    ? 'zh'
    : normalized.split('-')[0]
  return isInterfaceLanguageCode(primary) ? primary : null
}

export function getPreferredUserLanguage(
  user: UserLanguageSource | null | undefined
): InterfaceLanguageCode | null {
  if (!user) return null

  if (typeof user.language === 'string') {
    return normalizeLanguage(user.language)
  }

  if (user.setting && typeof user.setting === 'object') {
    const language = (user.setting as Record<string, unknown>).language
    return typeof language === 'string' ? normalizeLanguage(language) : null
  }

  if (typeof user.setting !== 'string') return null

  try {
    const setting = JSON.parse(user.setting) as { language?: unknown }
    return typeof setting.language === 'string'
      ? normalizeLanguage(setting.language)
      : null
  } catch {
    return null
  }
}

export function applyInterfaceLanguage(
  i18n: I18nInstance,
  language: string
): InterfaceLanguageCode | null {
  const nextLanguage = normalizeLanguage(language)
  if (!nextLanguage) return null

  const currentLanguage = normalizeLanguage(i18n.resolvedLanguage || i18n.language)
  if (nextLanguage !== currentLanguage) {
    void i18n.changeLanguage(nextLanguage)
  }

  return nextLanguage
}

export function withUserLanguagePreference<T extends UserLanguageSource>(
  user: T,
  language: string
): T {
  const nextLanguage = normalizeLanguage(language)
  if (!nextLanguage) return user

  const existingSetting =
    typeof user.setting === 'string'
      ? parseSetting(user.setting)
      : user.setting && typeof user.setting === 'object'
        ? (user.setting as Record<string, unknown>)
        : {}

  return {
    ...user,
    language: nextLanguage,
    setting: JSON.stringify({
      ...existingSetting,
      language: nextLanguage,
    }),
  }
}

export async function syncUserLanguagePreferenceToDatabase<T extends UserLanguageSource>(
  user: T | null | undefined,
  language: string,
  setUser?: UserLanguageSetter<T>
): Promise<void> {
  if (!user?.id) return

  const nextLanguage = normalizeLanguage(language)
  if (!nextLanguage) return

  if (getPreferredUserLanguage(user) === nextLanguage) return

  try {
    const response = await api.put('/api/user/self', { language: nextLanguage })
    if (!response.data?.success) return
  } catch {
    return
  }

  setUser?.((currentUser) => {
    if (!currentUser || currentUser.id !== user.id) return currentUser
    return withUserLanguagePreference(currentUser, nextLanguage)
  })
}

export function persistUserLanguageCookie(language: string): InterfaceLanguageCode | null {
  return persistLanguagePreferenceCookie(language)
}

function parseSetting(setting: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(setting) as unknown
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}
