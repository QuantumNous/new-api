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
import { ImageIcon, Loader2Icon, SquareIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { PromptInputButton } from '@/components/ai-elements/prompt-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { sendImageGeneration } from '../../api'
import { ERROR_MESSAGES } from '../../constants'
import {
  IMAGE_MAX_N,
  buildImageGenerationPayload,
  imageFormSchema,
  isSafeImageUrl,
  parseRequestErrorDetails,
  type ImageFormInput,
  type ImageFormValues,
} from '../../lib'
import type {
  GroupOption,
  ImageConfig,
  ImageGenerationResult,
  ModelOption,
} from '../../types'

type PlaygroundImageStudioProps = {
  groups: GroupOption[]
  imageConfig: ImageConfig
  models: ModelOption[]
  isModelLoading?: boolean
  onImageConfigChange: <K extends keyof ImageConfig>(
    key: K,
    value: ImageConfig[K]
  ) => void
}

type ImageResultCard = {
  id: number
  result: ImageGenerationResult
}

const SIZE_OPTIONS = ['auto', '256x256', '512x512', '1024x1024', '1792x1024', '1024x1792']
const QUALITY_OPTIONS = ['auto', 'standard', 'hd']
const RESPONSE_FORMAT_OPTIONS = ['auto', 'url', 'b64_json']

export function PlaygroundImageStudio(props: PlaygroundImageStudioProps) {
  const { t } = useTranslation()
  const [resultCards, setResultCards] = useState<ImageResultCard[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [hasAttempted, setHasAttempted] = useState(false)
  const [abortController, setAbortController] =
    useState<AbortController | null>(null)
  const resultIdCounterRef = useRef(0)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ImageFormInput, unknown, ImageFormValues>({
    resolver: zodResolver(imageFormSchema),
    defaultValues: {
      group: props.imageConfig.group,
      model: props.imageConfig.model,
      prompt: '',
      n: props.imageConfig.n,
      size: props.imageConfig.size as ImageFormInput['size'],
      quality: props.imageConfig.quality as ImageFormInput['quality'],
      response_format: props.imageConfig
        .response_format as ImageFormInput['response_format'],
    },
  })

  const onSubmit = async (values: ImageFormValues) => {
    const payload = buildImageGenerationPayload(values.prompt, {
      model: values.model,
      group: values.group,
      n: values.n,
      size: values.size,
      quality: values.quality,
      response_format: values.response_format,
    })

    const controller = new AbortController()
    setAbortController(controller)
    setIsGenerating(true)
    setHasAttempted(true)

    try {
      const response = await sendImageGeneration(
        payload,
        values.group,
        controller.signal
      )
      const data = Array.isArray(response?.data) ? response.data : []

      if (data.length === 0) {
        toast.error(t('Image generation returned no results'))
        return
      }

      const safeCards: ImageResultCard[] = []
      for (const result of data) {
        resultIdCounterRef.current += 1
        safeCards.push({ id: resultIdCounterRef.current, result })
      }
      setResultCards((prevCards) => [...prevCards, ...safeCards])
    } catch (error: unknown) {
      const { errorMessage } = parseRequestErrorDetails(error)
      toast.error(errorMessage || t(ERROR_MESSAGES.API_REQUEST_ERROR))
    } finally {
      setIsGenerating(false)
      setAbortController(null)
    }
  }

  const handleStop = () => {
    abortController?.abort()
  }

  const handleClearResults = () => {
    setResultCards([])
    setHasAttempted(false)
  }

  return (
    <div className='mx-auto grid w-full max-w-4xl gap-6 px-1 py-4 md:py-8'>
      <form
        className='grid gap-4'
        onSubmit={handleSubmit(onSubmit)}
      >
        <div className='grid gap-2'>
          <Label htmlFor='playground-image-prompt'>
            {t('Prompt')}
          </Label>
          <Textarea
            {...register('prompt')}
            aria-invalid={errors.prompt ? true : undefined}
            disabled={isGenerating}
            id='playground-image-prompt'
            placeholder={t('Describe the image you want to generate')}
            rows={3}
          />
          {errors.prompt && (
            <p className='text-destructive text-sm'>{errors.prompt.message}</p>
          )}
        </div>

        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='grid gap-2'>
            <Label htmlFor='playground-image-model'>{t('Model')}</Label>
            <select
              {...register('model')}
              className='border-input dark:bg-input/30 dark:hover:bg-input/50 flex h-8 w-full items-center rounded-lg border bg-transparent px-2.5 py-2 text-sm select-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'
              disabled={isGenerating || props.isModelLoading}
              id='playground-image-model'
            >
              {props.models.length === 0 && (
                <option value=''>{t('No image models available')}</option>
              )}
              {props.models.map((model) => (
                <option key={model.value} value={model.value}>
                  {model.label}
                </option>
              ))}
            </select>
            {errors.model && (
              <p className='text-destructive text-sm'>{errors.model.message}</p>
            )}
          </div>

          <div className='grid gap-2'>
            <Label htmlFor='playground-image-count'>{t('Number of images')}</Label>
            <Input
              {...register('n', { valueAsNumber: true })}
              disabled={isGenerating}
              id='playground-image-count'
              max={IMAGE_MAX_N}
              min={1}
              step={1}
              type='number'
            />
            {errors.n && (
              <p className='text-destructive text-sm'>{errors.n.message}</p>
            )}
          </div>

          <div className='grid gap-2'>
            <Label htmlFor='playground-image-size'>{t('Size')}</Label>
            <select
              {...register('size')}
              className='border-input dark:bg-input/30 dark:hover:bg-input/50 flex h-8 w-full items-center rounded-lg border bg-transparent px-2.5 py-2 text-sm select-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'
              disabled={isGenerating}
              id='playground-image-size'
            >
              {SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === 'auto' ? t('Auto') : option}
                </option>
              ))}
            </select>
          </div>

          <div className='grid gap-2'>
            <Label htmlFor='playground-image-quality'>{t('Quality')}</Label>
            <select
              {...register('quality')}
              className='border-input dark:bg-input/30 dark:hover:bg-input/50 flex h-8 w-full items-center rounded-lg border bg-transparent px-2.5 py-2 text-sm select-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'
              disabled={isGenerating}
              id='playground-image-quality'
            >
              {QUALITY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === 'auto' ? t('Auto') : option}
                </option>
              ))}
            </select>
          </div>

          <div className='grid gap-2'>
            <Label htmlFor='playground-image-format'>{t('Response format')}</Label>
            <select
              {...register('response_format')}
              className='border-input dark:bg-input/30 dark:hover:bg-input/50 flex h-8 w-full items-center rounded-lg border bg-transparent px-2.5 py-2 text-sm select-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'
              disabled={isGenerating}
              id='playground-image-format'
            >
              {RESPONSE_FORMAT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === 'auto' ? t('Auto') : option}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className='flex items-center gap-2'>
          <Button disabled={isGenerating} type='submit'>
            {isGenerating ? (
              <Loader2Icon aria-hidden='true' className='animate-spin' size={16} />
            ) : (
              <ImageIcon aria-hidden='true' size={16} />
            )}
            {t('Generate')}
          </Button>
          {isGenerating && (
            <PromptInputButton
              className='border-destructive/25 bg-destructive/10 text-destructive hover:bg-destructive/15 font-medium'
              onClick={handleStop}
              variant='secondary'
            >
              <SquareIcon className='fill-current' size={16} />
              {t('Stop')}
            </PromptInputButton>
          )}
          {resultCards.length > 0 && (
            <Button
              disabled={isGenerating}
              onClick={handleClearResults}
              type='button'
              variant='ghost'
            >
              {t('Clear results')}
            </Button>
          )}
        </div>
      </form>

      <div aria-busy={isGenerating} className='grid gap-4'>
        {resultCards.map(({ id, result }) => (
          <ImageResultCardView key={id} result={result} />
        ))}
        {!isGenerating && resultCards.length === 0 && hasAttempted && (
          <p className='text-muted-foreground text-sm'>
            {t('Image generation returned no results')}
          </p>
        )}
      </div>
    </div>
  )
}

function ImageResultCardView({ result }: { result: ImageGenerationResult }) {
  const { t } = useTranslation()

  return (
    <div className='border-border/60 bg-background/95 overflow-hidden rounded-xl border shadow-xs'>
      {result.url && isSafeImageUrl(result.url) && (
        <a
          className='block overflow-hidden'
          href={result.url}
          rel='noopener noreferrer'
          target='_blank'
        >
          <img
            alt={result.revised_prompt || t('Generated image')}
            className='max-h-[28rem] w-full object-contain'
            src={result.url}
          />
        </a>
      )}
      {result.b64_json && (
        <img
          alt={result.revised_prompt || t('Generated image')}
          className='max-h-[28rem] w-full object-contain'
          src={`data:image/png;base64,${result.b64_json}`}
        />
      )}
      {result.revised_prompt && (
        <p className='text-muted-foreground border-border/60 border-t px-3 py-2 text-sm leading-6'>
          {result.revised_prompt}
        </p>
      )}
    </div>
  )
}

export type { PlaygroundImageStudioProps }
