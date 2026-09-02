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
import { zodResolver } from '@hookform/resolvers/zod'
import { ImagePlus, LoaderCircle, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { ModelGroupSelector } from '@/components/model-group-selector'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { GroupOption, ModelOption } from '@/features/playground/types'

import { drawingSchema, type DrawingFormValues } from '../lib/drawing'
import type { DrawingRequest, ImageSize } from '../types'

const IMAGE_SIZES: ImageSize[] = ['1024x1024', '1024x1792', '1792x1024']

type DrawingFormProps = {
  models: ModelOption[]
  groups: GroupOption[]
  model: string
  group: string
  isLoadingModels: boolean
  isSubmitting: boolean
  onModelChange: (value: string) => void
  onGroupChange: (value: string) => void
  onSubmit: (request: DrawingRequest) => void
}

export function DrawingForm(props: DrawingFormProps) {
  const { t } = useTranslation()
  const [image, setImage] = useState<File>()
  const [previewUrl, setPreviewUrl] = useState('')
  const form = useForm<DrawingFormValues>({
    resolver: zodResolver(drawingSchema),
    defaultValues: { prompt: '', size: '1024x1024' },
  })

  useEffect(() => {
    if (!image) {
      setPreviewUrl('')
      return
    }
    const url = URL.createObjectURL(image)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [image])

  const handleSubmit = (values: DrawingFormValues) => {
    if (!props.model || !props.group) return
    props.onSubmit({
      model: props.model,
      group: props.group,
      prompt: values.prompt,
      size: values.size,
      image,
    })
  }

  return (
    <Card className='min-h-0'>
      <CardHeader>
        <CardTitle>{t('Creation settings')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className='grid gap-5' onSubmit={form.handleSubmit(handleSubmit)}>
          <ModelGroupSelector
            selectedModel={props.model}
            models={props.models}
            onModelChange={props.onModelChange}
            selectedGroup={props.group}
            groups={props.groups}
            onGroupChange={props.onGroupChange}
            disabled={props.isLoadingModels || props.isSubmitting}
          />

          <div className='grid gap-2'>
            <Label htmlFor='drawing-prompt'>{t('Prompt')}</Label>
            <Textarea
              id='drawing-prompt'
              className='min-h-40 resize-y'
              aria-invalid={Boolean(form.formState.errors.prompt)}
              placeholder={t(
                'Describe the scene, subject, composition, and style'
              )}
              disabled={props.isSubmitting}
              {...form.register('prompt')}
            />
            {form.formState.errors.prompt && (
              <p className='text-destructive text-xs' role='alert'>
                {t('Prompt is required')}
              </p>
            )}
          </div>

          <div className='grid gap-2'>
            <Label htmlFor='drawing-source-image'>
              {t('Source image (optional)')}
            </Label>
            <Input
              id='drawing-source-image'
              type='file'
              accept='image/*'
              disabled={props.isSubmitting}
              onChange={(event) => setImage(event.target.files?.[0])}
            />
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
                  disabled={props.isSubmitting}
                  onClick={() => setImage(undefined)}
                >
                  <Trash2 aria-hidden='true' />
                </Button>
              </div>
            )}
          </div>

          <div className='grid gap-2'>
            <Label>{t('Image size')}</Label>
            <Controller
              control={form.control}
              name='size'
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    className='w-full'
                    disabled={props.isSubmitting}
                  >
                    <SelectValue>{field.value}</SelectValue>
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      {IMAGE_SIZES.map((size) => (
                        <SelectItem key={size} value={size}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <Button
            type='submit'
            size='lg'
            disabled={
              props.isSubmitting ||
              props.isLoadingModels ||
              !props.model ||
              !props.group
            }
          >
            {props.isSubmitting ? (
              <LoaderCircle className='animate-spin' aria-hidden='true' />
            ) : (
              <ImagePlus aria-hidden='true' />
            )}
            {image ? t('Edit image') : t('Generate image')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
