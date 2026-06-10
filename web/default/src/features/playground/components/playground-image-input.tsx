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
import { useRef, useState } from 'react'
import { ImagePlusIcon, SendIcon, XIcon } from 'lucide-react'
import { nanoid } from 'nanoid'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { NativeSelect } from '@/components/ui/native-select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  PromptInput,
  PromptInputButton,
  PromptInputFooter,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input'
import { ModelGroupSelector } from '@/components/model-group-selector'
import {
  MAX_IMAGE_GENERATION_COUNT,
  normalizeImageGenerationCount,
} from '../lib'
import type { GroupOption, ImageGenerationConfig, ModelOption } from '../types'
import type { ImageReferenceInput } from '../types'

interface PlaygroundImageInputProps {
  config: ImageGenerationConfig
  disabled?: boolean
  groups: GroupOption[]
  isModelLoading?: boolean
  models: ModelOption[]
  prompt: string
  supportsReferenceImages?: boolean
  onConfigChange: <K extends keyof ImageGenerationConfig>(
    key: K,
    value: ImageGenerationConfig[K]
  ) => void
  onPromptChange: (value: string) => void
  onSubmit: (prompt: string, referenceImages: ImageReferenceInput[]) => void
}

const MAX_REFERENCE_IMAGE_COUNT = 4
const MAX_REFERENCE_IMAGE_SIZE = 20 * 1024 * 1024

const sizeOptions = [
  'auto',
  '1024x1024',
  '1024x1536',
  '1536x1024',
  '1024x1792',
  '1792x1024',
  '1:1',
  '16:9',
  '9:16',
]

const qualityOptions: ImageGenerationConfig['quality'][] = [
  'auto',
  'standard',
  'hd',
  'low',
  'medium',
  'high',
]

const responseFormatOptions: ImageGenerationConfig['response_format'][] = [
  'url',
  'b64_json',
]

const controlClassName =
  'h-8 rounded-lg border-border bg-background text-xs font-medium text-foreground shadow-none hover:bg-accent hover:text-foreground'

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () =>
      reject(reader.error || new Error('Failed to read image file'))
    reader.readAsDataURL(file)
  })
}

async function createReferenceImage(file: File): Promise<ImageReferenceInput> {
  return {
    id: nanoid(),
    name: file.name || 'reference-image',
    dataUrl: await readFileAsDataUrl(file),
    type: file.type,
    size: file.size,
    file,
  }
}

function FieldSelect({
  label,
  value,
  disabled,
  className,
  children,
  onChange,
}: {
  label: string
  value: string
  disabled?: boolean
  className?: string
  children: React.ReactNode
  onChange: (value: string) => void
}) {
  return (
    <label className='flex min-w-0 items-center gap-1.5 text-xs'>
      <span className='text-muted-foreground shrink-0'>{label}</span>
      <NativeSelect
        className={`${className ?? 'w-28 text-xs'} text-foreground`}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </NativeSelect>
    </label>
  )
}

export function PlaygroundImageInput({
  config,
  disabled,
  groups,
  isModelLoading = false,
  models,
  prompt,
  supportsReferenceImages = false,
  onConfigChange,
  onPromptChange,
  onSubmit,
}: PlaygroundImageInputProps) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [referenceImages, setReferenceImages] = useState<ImageReferenceInput[]>(
    []
  )
  const [previewImage, setPreviewImage] = useState<ImageReferenceInput | null>(
    null
  )

  const hasPrompt = Boolean(prompt.trim())
  const hasImageModels = models.length > 0
  const countValue = normalizeImageGenerationCount(config.n)
  const countOptions = Array.from(
    { length: MAX_IMAGE_GENERATION_COUNT },
    (_, index) => index + 1
  )
  const isConfigDisabled = Boolean(disabled)
  const isModelSelectDisabled =
    isConfigDisabled || isModelLoading || !hasImageModels
  const isGroupSelectDisabled = isConfigDisabled || groups.length === 0
  const isReferenceImageDisabled =
    isConfigDisabled || !hasImageModels || !supportsReferenceImages
  const isSubmitDisabled = Boolean(disabled) || !hasPrompt || !config.model

  const addReferenceFiles = async (files: File[]) => {
    if (files.length === 0) return
    if (!supportsReferenceImages) {
      toast.error(
        t('The selected image model does not support reference images')
      )
      return
    }

    const imageFiles: File[] = []
    let hasInvalidType = false
    let hasOversizedFile = false

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        hasInvalidType = true
        continue
      }
      if (file.size > MAX_REFERENCE_IMAGE_SIZE) {
        hasOversizedFile = true
        continue
      }
      imageFiles.push(file)
    }

    if (hasInvalidType) {
      toast.error(t('Only image files can be used as reference images'))
    }
    if (hasOversizedFile) {
      toast.error(t('Reference images can be up to 20 MB each'))
    }
    if (imageFiles.length === 0) return

    let nextImages: ImageReferenceInput[]
    try {
      nextImages = await Promise.all(imageFiles.map(createReferenceImage))
    } catch {
      toast.error(t('Failed to read reference image'))
      return
    }

    setReferenceImages((prev) => {
      const availableSlots = Math.max(
        MAX_REFERENCE_IMAGE_COUNT - prev.length,
        0
      )
      if (availableSlots <= 0) {
        toast.error(t('You can attach up to 4 reference images'))
        return prev
      }
      if (nextImages.length > availableSlots) {
        toast.error(t('You can attach up to 4 reference images'))
      }
      return [...prev, ...nextImages.slice(0, availableSlots)]
    })
  }

  const removeReferenceImage = (id: string) => {
    setReferenceImages((prev) => prev.filter((image) => image.id !== id))
  }

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files).filter((file) =>
      file.type.startsWith('image/')
    )
    if (files.length === 0) return
    event.preventDefault()
    void addReferenceFiles(files)
  }

  const handleSubmit = (message: PromptInputMessage) => {
    if (!message.text?.trim() || disabled) return
    if (referenceImages.length > 0 && !supportsReferenceImages) {
      toast.error(
        t('The selected image model does not support reference images')
      )
      return
    }
    onSubmit(message.text, referenceImages)
    onPromptChange('')
  }

  return (
    <TooltipProvider delay={300}>
      <div className='grid shrink-0 gap-3 px-1 md:pb-4'>
        {!isModelLoading && models.length === 0 ? (
          <p className='text-muted-foreground px-2 text-xs'>
            {t('No image generation models available')}
          </p>
        ) : null}

        <input
          ref={fileInputRef}
          accept='image/*'
          className='hidden'
          multiple
          type='file'
          onChange={(event) => {
            void addReferenceFiles(Array.from(event.target.files || []))
            event.target.value = ''
          }}
        />

        <PromptInput
          groupClassName='rounded-xl has-disabled:opacity-100'
          onSubmit={handleSubmit}
        >
          {referenceImages.length > 0 ? (
            <div className='border-border/60 flex items-center gap-2 overflow-x-auto border-b px-3 py-2'>
              {referenceImages.map((image) => (
                <div key={image.id} className='relative size-14 shrink-0'>
                  <button
                    aria-label={t('Preview reference image')}
                    className='bg-muted ring-border/70 focus-visible:ring-ring/50 size-14 overflow-hidden rounded-md ring-1 outline-none focus-visible:ring-2'
                    type='button'
                    onClick={() => setPreviewImage(image)}
                  >
                    <img
                      alt={image.name}
                      className='size-full object-cover'
                      src={image.dataUrl}
                    />
                  </button>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          aria-label={t('Remove reference image')}
                          className='bg-background text-muted-foreground hover:text-destructive focus-visible:ring-ring/50 hover:bg-background absolute -top-1 -right-1 inline-flex size-5 items-center justify-center rounded-full border shadow-sm outline-none focus-visible:ring-2'
                          type='button'
                          onClick={() => removeReferenceImage(image.id)}
                        />
                      }
                    >
                      <XIcon className='size-3' />
                    </TooltipTrigger>
                    <TooltipContent>
                      {t('Remove reference image')}
                    </TooltipContent>
                  </Tooltip>
                </div>
              ))}
            </div>
          ) : null}

          <PromptInputTextarea
            autoComplete='off'
            autoCorrect='off'
            autoCapitalize='off'
            spellCheck={false}
            className='min-h-24 px-5 md:text-base'
            disabled={isConfigDisabled || !hasImageModels}
            onChange={(event) => onPromptChange(event.target.value)}
            onPaste={handlePaste}
            placeholder={t('Describe the image to generate')}
            value={prompt}
          />

          <PromptInputFooter className='flex-col items-stretch gap-2 p-2.5 sm:flex-row sm:items-center sm:justify-between'>
            <PromptInputTools className='flex-wrap gap-2'>
              <ModelGroupSelector
                className='gap-2'
                triggerClassName={controlClassName}
                selectedModel={config.model}
                models={models}
                onModelChange={(value) => onConfigChange('model', value)}
                selectedGroup={config.group}
                groups={groups}
                onGroupChange={(value) => onConfigChange('group', value)}
                disabled={isModelSelectDisabled || isGroupSelectDisabled}
              />

              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      aria-label={t('Attach reference image')}
                      className='h-8 rounded-lg'
                      disabled={
                        isReferenceImageDisabled ||
                        referenceImages.length >= MAX_REFERENCE_IMAGE_COUNT
                      }
                      size='icon-sm'
                      type='button'
                      variant='outline'
                      onClick={() => fileInputRef.current?.click()}
                    />
                  }
                >
                  <ImagePlusIcon className='size-4' />
                </TooltipTrigger>
                <TooltipContent>{t('Attach reference image')}</TooltipContent>
              </Tooltip>

              <FieldSelect
                className={`${controlClassName} w-32`}
                disabled={isConfigDisabled || !hasImageModels}
                label={t('Size')}
                value={config.size}
                onChange={(value) => onConfigChange('size', value)}
              >
                {sizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </FieldSelect>

              <FieldSelect
                className={`${controlClassName} w-24`}
                disabled={isConfigDisabled || !hasImageModels}
                label={t('Quality')}
                value={config.quality}
                onChange={(value) =>
                  onConfigChange(
                    'quality',
                    value as ImageGenerationConfig['quality']
                  )
                }
              >
                {qualityOptions.map((quality) => (
                  <option key={quality} value={quality}>
                    {quality}
                  </option>
                ))}
              </FieldSelect>

              <FieldSelect
                className={`${controlClassName} w-16`}
                disabled={isConfigDisabled || !hasImageModels}
                label={t('Count')}
                value={String(countValue)}
                onChange={(value) =>
                  onConfigChange(
                    'n',
                    normalizeImageGenerationCount(
                      Number.parseInt(value, 10) || 1
                    )
                  )
                }
              >
                {countOptions.map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </FieldSelect>

              <FieldSelect
                className={`${controlClassName} w-24`}
                disabled={isConfigDisabled || !hasImageModels}
                label={t('Format')}
                value={config.response_format}
                onChange={(value) =>
                  onConfigChange(
                    'response_format',
                    value as ImageGenerationConfig['response_format']
                  )
                }
              >
                {responseFormatOptions.map((format) => (
                  <option key={format} value={format}>
                    {format}
                  </option>
                ))}
              </FieldSelect>
            </PromptInputTools>

            <PromptInputButton
              className='text-foreground font-medium'
              disabled={isSubmitDisabled}
              type='submit'
              variant='secondary'
            >
              <SendIcon size={16} />
              <span className='hidden sm:inline'>{t('Generate')}</span>
              <span className='sr-only sm:hidden'>{t('Generate')}</span>
            </PromptInputButton>
          </PromptInputFooter>
        </PromptInput>

        <Dialog
          open={Boolean(previewImage)}
          onOpenChange={(open) => {
            if (!open) setPreviewImage(null)
          }}
        >
          <DialogContent
            showCloseButton={false}
            className='!fixed !inset-0 !top-0 !left-0 !z-50 !flex !h-dvh !w-screen !max-w-none !translate-x-0 !translate-y-0 !items-center !justify-center !gap-0 !rounded-none !bg-black/90 !p-0 !ring-0'
          >
            <DialogHeader className='sr-only'>
              <DialogTitle>{t('Reference image')}</DialogTitle>
            </DialogHeader>
            <DialogClose
              render={
                <Button
                  aria-label={t('Close')}
                  className='bg-background/85 text-foreground hover:bg-background absolute top-3 right-3 z-10 shadow-md backdrop-blur'
                  size='icon-sm'
                  type='button'
                  variant='secondary'
                />
              }
            >
              <XIcon className='size-4' />
              <span className='sr-only'>{t('Close')}</span>
            </DialogClose>
            <div className='flex h-full w-full items-center justify-center p-3 pt-14 sm:p-6 sm:pt-16'>
              {previewImage ? (
                <img
                  alt={previewImage.name}
                  className='block h-full w-full object-contain'
                  src={previewImage.dataUrl}
                />
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
