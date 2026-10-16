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
import { useEffect, useLayoutEffect, useRef, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SUPPORT_ICON_IMAGE_TYPES } from '@/features/support/types'

interface ImageSettingInputProps {
  value: string
  onChange: (value: string) => void
  label: string
  disabled?: boolean
}

export function ImageSettingInput(props: ImageSettingInputProps) {
  const { t } = useTranslation()
  const fileRef = useRef<HTMLInputElement>(null)
  const readerRef = useRef<FileReader | null>(null)
  const onChangeRef = useRef(props.onChange)
  useLayoutEffect(() => {
    onChangeRef.current = props.onChange
  }, [props.onChange])
  useEffect(
    () => () => {
      readerRef.current?.abort()
    },
    []
  )
  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!SUPPORT_ICON_IMAGE_TYPES.some((type) => type === file.type)) {
      toast.error(t('Please choose a PNG, JPG, WebP, or GIF image'))
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error(
        t('Supports PNG, JPG, WebP, or GIF. Maximum file size: 2 MB.')
      )
      return
    }
    readerRef.current?.abort()
    const reader = new FileReader()
    readerRef.current = reader
    reader.addEventListener('load', () => {
      if (
        typeof reader.result !== 'string' ||
        !reader.result.startsWith('data:image/')
      ) {
        toast.error(t('Failed to read icon file'))
        return
      }
      onChangeRef.current(reader.result)
    })
    reader.addEventListener('error', () =>
      toast.error(t('Failed to read icon file'))
    )
    reader.readAsDataURL(file)
  }
  return (
    <div className='space-y-3'>
      <Input
        aria-label={props.label}
        placeholder='https://example.com/image.png'
        disabled={props.disabled}
        value={props.value.startsWith('data:image/') ? '' : props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
      <input
        ref={fileRef}
        type='file'
        aria-label={props.label}
        accept={SUPPORT_ICON_IMAGE_TYPES.join(',')}
        className='hidden'
        onChange={handleFile}
        disabled={props.disabled}
      />
      <div className='flex items-center gap-3'>
        {props.value && (
          <img
            src={props.value}
            alt={props.label}
            className='size-10 shrink-0 rounded-md border bg-white object-contain'
          />
        )}
        <Button
          type='button'
          variant='outline'
          disabled={props.disabled}
          onClick={() => fileRef.current?.click()}
        >
          {t('Upload')}
        </Button>
        {props.value && (
          <Button
            type='button'
            variant='ghost'
            disabled={props.disabled}
            onClick={() => props.onChange('')}
          >
            {t('Remove')}
          </Button>
        )}
      </div>
    </div>
  )
}
