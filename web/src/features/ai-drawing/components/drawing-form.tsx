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
import { ImagePlus, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { ModelGroupSelector } from '@/components/model-group-selector'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

import {
  drawingSchema,
  IMAGE_RATIO_OPTIONS,
  type DrawingFormValues,
} from '../lib/drawing'
import type { DrawingRequest } from '../types'
import { SourceImageField } from './source-image-field'

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
  const form = useForm<DrawingFormValues>({
    resolver: zodResolver(drawingSchema),
    defaultValues: { prompt: '', size: '1024x1024' },
  })

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
              autoFocus
              disabled={props.isSubmitting}
              {...form.register('prompt')}
            />
            {form.formState.errors.prompt && (
              <p className='text-destructive text-xs' role='alert'>
                {t('Prompt is required')}
              </p>
            )}
          </div>

          <SourceImageField
            image={image}
            disabled={props.isSubmitting}
            onImageChange={setImage}
          />

          <div className='grid gap-2'>
            <Label>{t('Aspect ratio')}</Label>
            <Controller
              control={form.control}
              name='size'
              render={({ field }) => {
                const selected = IMAGE_RATIO_OPTIONS.find(
                  (option) => option.size === field.value
                )
                return (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      className='w-full'
                      disabled={props.isSubmitting}
                    >
                      <SelectValue>
                        {selected
                          ? `${selected.ratio} · ${t(selected.labelKey)}`
                          : field.value}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {IMAGE_RATIO_OPTIONS.map((option) => (
                          <SelectItem key={option.size} value={option.size}>
                            {option.ratio} · {t(option.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )
              }}
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
