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
import { useTranslation } from 'react-i18next'

import { FormLabel } from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  INTERFACE_LANGUAGE_OPTIONS,
  type InterfaceLanguageCode,
} from '@/i18n/languages'

export type EditableContentLocale = 'default' | InterfaceLanguageCode

interface ContentLanguageSelectProps {
  value: EditableContentLocale
  onValueChange: (value: EditableContentLocale) => void
}

export function ContentLanguageSelect({
  value,
  onValueChange,
}: ContentLanguageSelectProps) {
  const { t } = useTranslation()

  return (
    <div className='space-y-2'>
      <FormLabel>{t('Translation')}</FormLabel>
      <Select
        value={value}
        onValueChange={(nextValue) =>
          onValueChange(nextValue as EditableContentLocale)
        }
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectGroup>
            <SelectItem value='default'>{t('Default')}</SelectItem>
            {INTERFACE_LANGUAGE_OPTIONS.map((language) => (
              <SelectItem key={language.code} value={language.code}>
                {language.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
