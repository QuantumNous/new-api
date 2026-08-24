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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import type { DataToolFieldSchema } from '../types'

type DataToolInputFieldProps = {
  name: string
  field: DataToolFieldSchema
  required: boolean
  value: string
  onChange: (value: string) => void
}

export function getInitialDataToolFieldValue(
  field: DataToolFieldSchema
): string {
  const initial = field.default !== undefined ? field.default : field.example
  if (initial === undefined || initial === null) return ''
  if (typeof initial === 'object') return JSON.stringify(initial, null, 2)
  return String(initial)
}

export function parseDataToolFieldValue(
  name: string,
  field: DataToolFieldSchema,
  value: string,
  required: boolean
): unknown {
  const trimmed = value.trim()
  if (trimmed === '') {
    if (required) throw new Error(`${name} is required`)
    return undefined
  }
  if (field.type === 'number' || field.type === 'integer') {
    const number = Number(trimmed)
    if (!Number.isFinite(number)) throw new Error(`${name} must be a number`)
    if (field.type === 'integer' && !Number.isInteger(number)) {
      throw new Error(`${name} must be an integer`)
    }
    return number
  }
  if (field.type === 'boolean') return trimmed === 'true'
  if (field.type === 'array' || field.type === 'object') {
    const parsed: unknown = JSON.parse(trimmed)
    if (field.type === 'array' && !Array.isArray(parsed)) {
      throw new Error(`${name} must be a JSON array`)
    }
    if (
      field.type === 'object' &&
      (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object')
    ) {
      throw new Error(`${name} must be a JSON object`)
    }
    return parsed
  }
  return value
}

export function DataToolInputField(props: DataToolInputFieldProps) {
  const { t } = useTranslation()
  const id = `data-tool-input-${props.name.replace(/[^a-zA-Z0-9_-]/g, '-')}`

  return (
    <div className='grid gap-1.5'>
      <div className='flex items-center gap-1.5'>
        <Label htmlFor={id}>{props.name}</Label>
        {props.required && (
          <span className='text-destructive text-xs'>{t('Required')}</span>
        )}
      </div>
      {props.field.enum ? (
        <NativeSelect
          id={id}
          className='w-full'
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
        >
          {!props.required && (
            <NativeSelectOption value=''>
              {t('Use provider default')}
            </NativeSelectOption>
          )}
          {props.field.enum.map((option) => (
            <NativeSelectOption key={String(option)} value={String(option)}>
              {String(option)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      ) : props.field.type === 'boolean' ? (
        <NativeSelect
          id={id}
          className='w-full'
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
        >
          {!props.required && (
            <NativeSelectOption value=''>
              {t('Use provider default')}
            </NativeSelectOption>
          )}
          <NativeSelectOption value='true'>{t('True')}</NativeSelectOption>
          <NativeSelectOption value='false'>{t('False')}</NativeSelectOption>
        </NativeSelect>
      ) : props.field.type === 'array' || props.field.type === 'object' ? (
        <Textarea
          id={id}
          value={props.value}
          className='min-h-24 font-mono text-xs'
          placeholder={
            props.field.type === 'array'
              ? t('Enter a JSON array')
              : t('Enter a JSON object')
          }
          onChange={(event) => props.onChange(event.target.value)}
        />
      ) : (
        <Input
          id={id}
          type={
            props.field.type === 'number' || props.field.type === 'integer'
              ? 'number'
              : 'text'
          }
          step={props.field.type === 'integer' ? 1 : undefined}
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
        />
      )}
      {props.field.description && (
        <p className='text-muted-foreground text-xs'>
          {props.field.description}
        </p>
      )}
    </div>
  )
}
