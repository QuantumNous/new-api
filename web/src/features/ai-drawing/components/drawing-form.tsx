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

import {
  drawingSchema,
  IMAGE_RATIO_OPTIONS,
  type DrawingFormValues,
} from '../lib/drawing'
import type { DrawingRequest } from '../types'
import { PromptTemplates } from './prompt-templates'
import { SourceImageField } from './source-image-field'

type DrawingFormProps = {
  models: ModelOption[]
  groups: GroupOption[]
  model: string
  group: string
  isLoadingModels: boolean
  isSubmitting: boolean
  agentPriceCents?: number
  maxCount?: number
  onModelChange: (value: string) => void
  onGroupChange: (value: string) => void
  onSubmit: (request: DrawingRequest) => void
}

export function DrawingForm(props: DrawingFormProps) {
  const { t } = useTranslation()
  const [image, setImage] = useState<File>()
  const isProAlias =
    props.model === 'gpt-image-2.5-2k' || props.model === 'gpt-image-2.5-4k'
  const ratioOptions = IMAGE_RATIO_OPTIONS.filter(
    (option) => !isProAlias || option.ratio !== '21:9'
  )
  const form = useForm<DrawingFormValues>({
    resolver: zodResolver(drawingSchema),
    defaultValues: { prompt: '', size: '1024x1024', count: '' },
  })

  const values = form.watch()
  const count = values.count.trim() === '' ? 1 : Number(values.count)
  const validCount =
    Number.isInteger(count) && count >= 1 && count <= (props.maxCount ?? 20)
  const busy = props.isSubmitting
  const handleSubmit = (values: DrawingFormValues) => {
    if (!props.model || !props.group || !validCount) return
    props.onSubmit({
      model: props.model,
      group: props.group,
      prompt: values.prompt,
      size:
        isProAlias && values.size === '1792x768' ? '1024x1024' : values.size,
      count,
      image,
    })
  }

  return (
    <Card className='shrink-0 md:min-h-0 md:shrink'>
      <CardHeader>
        <CardTitle>{t('Creation settings')}</CardTitle>
      </CardHeader>
      <CardContent className='md:min-h-0 md:overflow-y-auto'>
        <form className='grid gap-5' onSubmit={form.handleSubmit(handleSubmit)}>
          <ModelGroupSelector
            selectedModel={props.model}
            models={props.models}
            onModelChange={props.onModelChange}
            selectedGroup={props.group}
            groups={props.groups}
            onGroupChange={props.onGroupChange}
            disabled={props.isLoadingModels || busy}
          />

          <PromptTemplates
            value={values.prompt}
            disabled={busy}
            onApply={(prompt) =>
              form.setValue('prompt', prompt, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
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
              disabled={busy}
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
            disabled={busy}
            onImageChange={setImage}
          />

          <div className='grid gap-2'>
            <Label htmlFor='drawing-size'>{t('Aspect ratio')}</Label>
            <Controller
              control={form.control}
              name='size'
              render={({ field }) => {
                const size =
                  isProAlias && field.value === '1792x768'
                    ? '1024x1024'
                    : field.value
                const selected = ratioOptions.find(
                  (option) => option.size === size
                )
                return (
                  <Select value={size} onValueChange={field.onChange}>
                    <SelectTrigger
                      id='drawing-size'
                      className='w-full'
                      disabled={busy}
                    >
                      <SelectValue>
                        {selected
                          ? `${selected.ratio} · ${t(selected.labelKey)}`
                          : field.value}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {ratioOptions.map((option) => (
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

          <div className='grid gap-2'>
            <Label htmlFor='drawing-count'>{t('Number of images')}</Label>
            <Input
              id='drawing-count'
              type='number'
              min={1}
              max={props.maxCount ?? 20}
              step={1}
              placeholder='1'
              disabled={busy}
              aria-invalid={!validCount}
              {...form.register('count')}
            />
            {!validCount && (
              <p className='text-destructive text-xs' role='alert'>
                {t('Enter a whole number from 1 to {{max}}', {
                  max: props.maxCount ?? 20,
                })}
              </p>
            )}
          </div>

          {props.agentPriceCents !== undefined && (
            <p className='text-muted-foreground text-xs'>
              {t('Your price: ¥{{price}} per image', {
                price: (props.agentPriceCents / 100).toFixed(2),
              })}
            </p>
          )}

          <Button
            type='submit'
            size='lg'
            disabled={
              busy ||
              !validCount ||
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
