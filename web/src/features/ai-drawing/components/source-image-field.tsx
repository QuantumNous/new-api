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
import { Trash2, UploadCloud } from 'lucide-react'
import { useEffect, useRef, useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type SourceImageFieldProps = {
  image?: File
  disabled: boolean
  onImageChange: (image?: File) => void
}

export function SourceImageField(props: SourceImageFieldProps) {
  const { t } = useTranslation()
  const [previewUrl, setPreviewUrl] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!props.image) {
      setPreviewUrl('')
      return
    }
    const url = URL.createObjectURL(props.image)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [props.image])

  const handleImageFile = (file?: File) => {
    if (props.disabled || !file?.type.startsWith('image/')) return
    props.onImageChange(file)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    handleImageFile(event.dataTransfer.files[0])
  }

  const handleRemoveImage = () => {
    props.onImageChange(undefined)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className='grid gap-2'>
      <Label htmlFor='drawing-source-image'>
        {t('Source image (optional)')}
      </Label>
      <div
        role='group'
        aria-label={t('Source image (optional)')}
        className={cn(
          'rounded-lg border border-dashed p-4 transition-colors',
          isDragging && 'border-primary bg-primary/5'
        )}
        onDragEnter={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <Label
          htmlFor='drawing-source-image'
          className='flex cursor-pointer flex-col items-center gap-2 text-center'
        >
          <UploadCloud
            className='text-muted-foreground size-7'
            aria-hidden='true'
          />
          <span>{t('Drop image here or click to select')}</span>
        </Label>
        <Input
          ref={fileInputRef}
          id='drawing-source-image'
          className='sr-only'
          type='file'
          accept='image/*'
          disabled={props.disabled}
          onChange={(event) => handleImageFile(event.target.files?.[0])}
        />
      </div>
      <p className='text-muted-foreground text-xs'>
        {t('Upload an image to switch to image editing')}
      </p>
      {previewUrl && (
        <div className='relative overflow-hidden rounded-lg border'>
          <img
            src={previewUrl}
            alt={t('Source image preview')}
            className='aspect-video w-full object-contain'
          />
          <Button
            type='button'
            size='icon-sm'
            variant='secondary'
            className='absolute top-2 right-2'
            aria-label={t('Remove image')}
            disabled={props.disabled}
            onClick={handleRemoveImage}
          >
            <Trash2 aria-hidden='true' />
          </Button>
        </div>
      )}
    </div>
  )
}
