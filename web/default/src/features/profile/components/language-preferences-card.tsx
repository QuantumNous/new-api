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
import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/design-system/select'
import { Card, CardContent } from '@/components/ui/card'
import {
  INTERFACE_LANGUAGE_OPTIONS,
  normalizeInterfaceLanguage,
} from '@/i18n/languages'
import { useAuthStore } from '@/stores/auth-store'

import { updateUserLanguage } from '../api'
import { parseUserSettings } from '../lib'
import type { UserProfile } from '../types'

type LanguagePreferencesCardProps = {
  profile: UserProfile | null
  onProfileUpdate: () => void
}

export function LanguagePreferencesCard(props: LanguagePreferencesCardProps) {
  const { t, i18n } = useTranslation()
  const { auth } = useAuthStore()
  const [saving, setSaving] = useState(false)

  const savedLanguage = useMemo(() => {
    const settings = parseUserSettings(props.profile?.setting)
    return normalizeInterfaceLanguage(settings.language || i18n.language)
  }, [props.profile?.setting, i18n.language])

  const [currentLanguage, setCurrentLanguage] = useState(savedLanguage)

  useEffect(() => {
    setCurrentLanguage(savedLanguage)
  }, [savedLanguage])

  const handleLanguageChange = async (language: string | null) => {
    if (!language) return
    const nextLanguage = normalizeInterfaceLanguage(language)
    if (nextLanguage === currentLanguage) return

    const previousLanguage = currentLanguage
    setCurrentLanguage(nextLanguage)
    setSaving(true)
    await i18n.changeLanguage(nextLanguage)

    try {
      const response = await updateUserLanguage(nextLanguage)
      if (!response.success) {
        throw new Error(response.message || t('Failed to update settings'))
      }

      if (auth.user) {
        const existingSetting =
          typeof auth.user.setting === 'string'
            ? parseUserSettings(auth.user.setting)
            : (auth.user.setting ?? {})
        auth.setUser({
          ...auth.user,
          setting: JSON.stringify({
            ...existingSetting,
            language: nextLanguage,
          }),
        })
      }

      props.onProfileUpdate()
      toast.success(t('Language preference saved'))
    } catch {
      setCurrentLanguage(previousLanguage)
      await i18n.changeLanguage(previousLanguage)
      toast.error(t('Failed to update settings'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card data-card-hover='false' className='py-0'>
      <CardContent className='flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5'>
        <div className='min-w-0 space-y-0.5'>
          <p className='text-sm font-medium'>{t('Interface Language')}</p>
          <p className='text-muted-foreground line-clamp-2 text-xs sm:text-sm'>
            {t(
              'Language preferences sync across your signed-in devices and affect API error messages.'
            )}
          </p>
        </div>
        <div className='flex shrink-0 items-center gap-2'>
          <Select
            items={INTERFACE_LANGUAGE_OPTIONS.map((language) => ({
              value: language.code,
              label: language.label,
            }))}
            value={currentLanguage}
            onValueChange={handleLanguageChange}
            disabled={saving}
          >
            <SelectTrigger className='w-full sm:w-44'>
              <SelectValue placeholder={t('Select language')} />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                {INTERFACE_LANGUAGE_OPTIONS.map((language) => (
                  <SelectItem key={language.code} value={language.code}>
                    {language.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {saving && (
            <Loader2 className='text-muted-foreground size-4 animate-spin' />
          )}
        </div>
      </CardContent>
    </Card>
  )
}
