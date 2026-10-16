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
import { nanoid } from 'nanoid'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { parseBusinessContacts } from '@/features/home/lib/business-contacts'

import { ImageSettingInput } from './image-setting-input'

export function BusinessContactsInput(props: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const contacts = parseBusinessContacts(props.value)
  return (
    <div className='space-y-4'>
      {contacts.map((contact, index) => (
        <div
          key={contact.id}
          role='group'
          aria-label={t('Contact channel {{number}}', { number: index + 1 })}
          className='space-y-3 rounded-lg border p-4'
        >
          <Input
            aria-label={t('Channel label')}
            placeholder={t('Channel label')}
            maxLength={80}
            value={contact.label}
            disabled={props.disabled}
            onChange={(event) =>
              props.onChange(
                JSON.stringify(
                  contacts.map((item, i) =>
                    i === index ? { ...item, label: event.target.value } : item
                  )
                )
              )
            }
          />
          <ImageSettingInput
            label={t('QR code image')}
            value={contact.image}
            disabled={props.disabled}
            onChange={(image) =>
              props.onChange(
                JSON.stringify(
                  contacts.map((item, i) =>
                    i === index ? { ...item, image } : item
                  )
                )
              )
            }
          />
          <Button
            type='button'
            variant='outline'
            disabled={props.disabled}
            onClick={() =>
              props.onChange(
                JSON.stringify(contacts.filter((_, i) => i !== index))
              )
            }
          >
            {t('Remove channel')}
          </Button>
        </div>
      ))}
      <Button
        type='button'
        variant='outline'
        disabled={props.disabled || contacts.length >= 8}
        onClick={() =>
          props.onChange(
            JSON.stringify([
              ...contacts,
              { id: nanoid(), label: '', image: '' },
            ])
          )
        }
      >
        {t('Add contact channel')}
      </Button>
    </div>
  )
}
