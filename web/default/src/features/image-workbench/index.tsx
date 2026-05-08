import { useEffect, useMemo, useState } from 'react'
import type { AxiosError } from 'axios'
import { useQuery } from '@tanstack/react-query'
import {
  Download,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { getUserGroups, getUserModels } from '@/features/playground/api'
import { DEFAULT_GROUP } from '@/features/playground/constants'
import { generateWorkbenchImages } from './api'
import type { GeneratedImage, ImageWorkbenchData } from './types'

const IMAGE_WORKBENCH_HISTORY_KEY = 'image_workbench_history'
const IMAGE_MODEL_KEYWORDS = [
  'gpt-image',
  'chatgpt-image',
  'dall-e',
  'imagen',
  'flux',
  'qwen-image',
  'z-image',
]

const sizeOptions = ['auto', '1:1', '16:9', '9:16', '3:2', '2:3', '1024x1024']
const qualityOptions = ['auto', 'low', 'medium', 'high', 'standard', 'hd']
const outputFormatOptions = ['png', 'jpeg', 'webp'] as const

type OpenAIErrorResponse = {
  error?: {
    message?: string
  }
}

function isImageModel(model: string) {
  const normalized = model.toLowerCase()
  return IMAGE_MODEL_KEYWORDS.some((keyword) => normalized.includes(keyword))
}

function imageMimeType(format: string) {
  if (format === 'jpeg') return 'image/jpeg'
  if (format === 'webp') return 'image/webp'
  return 'image/png'
}

function isOutputFormat(
  value: string
): value is (typeof outputFormatOptions)[number] {
  return outputFormatOptions.some((item) => item === value)
}

function imageSource(data: ImageWorkbenchData, outputFormat: string) {
  if (data.url) return data.url
  if (data.b64_json) {
    return `data:${imageMimeType(outputFormat)};base64,${data.b64_json}`
  }
  return ''
}

function loadHistory(): GeneratedImage[] {
  try {
    const raw = window.localStorage.getItem(IMAGE_WORKBENCH_HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.slice(0, 12) : []
  } catch {
    return []
  }
}

function persistHistory(items: GeneratedImage[]) {
  try {
    window.localStorage.setItem(
      IMAGE_WORKBENCH_HISTORY_KEY,
      JSON.stringify(items.slice(0, 12))
    )
  } catch {
    /* empty */
  }
}

function downloadImage(image: GeneratedImage) {
  const link = document.createElement('a')
  link.href = image.src
  link.download = `image-${image.id}.${image.outputFormat || 'png'}`
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export function ImageWorkbench() {
  const { t } = useTranslation()
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState('gpt-image-2')
  const [group, setGroup] = useState(DEFAULT_GROUP)
  const [size, setSize] = useState('1:1')
  const [quality, setQuality] = useState('high')
  const [outputFormat, setOutputFormat] =
    useState<(typeof outputFormatOptions)[number]>('png')
  const [count, setCount] = useState(1)
  const [isGenerating, setIsGenerating] = useState(false)
  const [images, setImages] = useState<GeneratedImage[]>([])
  const [history, setHistory] = useState<GeneratedImage[]>(() => loadHistory())
  const [error, setError] = useState('')

  const { data: modelsData, isLoading: isLoadingModels } = useQuery({
    queryKey: ['image-workbench-models'],
    queryFn: getUserModels,
  })

  const { data: groupsData } = useQuery({
    queryKey: ['image-workbench-groups'],
    queryFn: getUserGroups,
  })

  const imageModels = useMemo(() => {
    const models = modelsData ?? []
    const filtered = models.filter((item) => isImageModel(item.value))
    if (filtered.some((item) => item.value === 'gpt-image-2')) {
      return filtered
    }
    return [{ label: 'gpt-image-2', value: 'gpt-image-2' }, ...filtered]
  }, [modelsData])

  const groupOptions = useMemo(() => {
    const groups = groupsData ?? []
    const hasAuto = groups.some((item) => item.value === DEFAULT_GROUP)
    return hasAuto
      ? groups
      : [
          {
            value: DEFAULT_GROUP,
            label: t('imageWorkbench.auto'),
            ratio: 1,
            desc: t('imageWorkbench.circuitBreaker'),
          },
          ...groups,
        ]
  }, [groupsData, t])

  useEffect(() => {
    if (imageModels.length === 0) return
    if (!imageModels.some((item) => item.value === model)) {
      setModel(imageModels[0].value)
    }
  }, [imageModels, model])

  const handleGenerate = async () => {
    const cleanPrompt = prompt.trim()
    if (!cleanPrompt) {
      setError(t('Please enter an image prompt.'))
      return
    }

    setIsGenerating(true)
    setError('')

    try {
      const response = await generateWorkbenchImages({
        model,
        group,
        prompt: cleanPrompt,
        n: count,
        size,
        quality,
        response_format: 'b64_json',
        output_format: outputFormat,
      })

      const created = new Date().toISOString()
      const nextImages = (response.data ?? [])
        .map((item, index) => {
          const src = imageSource(item, outputFormat)
          if (!src) return null
          return {
            id: `${Date.now()}-${index}`,
            src,
            prompt: cleanPrompt,
            revisedPrompt: item.revised_prompt,
            model,
            size,
            quality,
            outputFormat,
            createdAt: created,
          } satisfies GeneratedImage
        })
        .filter(Boolean) as GeneratedImage[]

      if (nextImages.length === 0) {
        setError(t('No image data was returned.'))
        return
      }

      setImages(nextImages)
      setHistory((prev) => {
        const merged = [...nextImages, ...prev].slice(0, 12)
        persistHistory(merged)
        return merged
      })
      toast.success(t('Image generation completed.'))
    } catch (err) {
      const apiError = err as AxiosError<OpenAIErrorResponse>
      setError(
        apiError.response?.data?.error?.message ?? t('Image generation failed.')
      )
    } finally {
      setIsGenerating(false)
    }
  }

  const resultImages = images.length > 0 ? images : history.slice(0, 2)
  const imageContent = (() => {
    if (isGenerating) {
      return (
        <div className='bg-muted/30 flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed'>
          <Loader2 className='text-muted-foreground animate-spin' />
          <p className='text-muted-foreground text-sm'>
            {t('Generating image...')}
          </p>
        </div>
      )
    }

    if (resultImages.length === 0) {
      return (
        <div className='bg-muted/30 flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed'>
          <ImageIcon className='text-muted-foreground' />
          <p className='text-muted-foreground text-sm'>
            {t('Your generated images will appear here.')}
          </p>
        </div>
      )
    }

    return (
      <div className='grid gap-4 xl:grid-cols-2'>
        {resultImages.map((image) => (
          <div
            key={image.id}
            className='group bg-card overflow-hidden rounded-lg border'
          >
            <div className='bg-muted aspect-square overflow-hidden'>
              <img
                src={image.src}
                alt={image.prompt}
                className='size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]'
              />
            </div>
            <div className='flex flex-col gap-3 p-3'>
              <div className='flex flex-wrap items-center gap-2'>
                <Badge variant='secondary'>{image.model}</Badge>
                <Badge variant='outline'>{image.size}</Badge>
                <Badge variant='outline'>{image.quality}</Badge>
              </div>
              <p className='line-clamp-2 text-sm'>{image.prompt}</p>
              {image.revisedPrompt && (
                <p className='text-muted-foreground line-clamp-2 text-xs'>
                  {image.revisedPrompt}
                </p>
              )}
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => downloadImage(image)}
              >
                <Download data-icon='inline-start' />
                {t('Download')}
              </Button>
            </div>
          </div>
        ))}
      </div>
    )
  })()

  return (
    <div className='bg-background flex size-full min-h-0 flex-col overflow-hidden'>
      <div className='bg-background/95 border-b px-5 py-4'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div className='flex min-w-0 items-center gap-3'>
            <div className='bg-primary text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-lg'>
              <Wand2 data-icon='inline-start' />
            </div>
            <div className='min-w-0'>
              <h1 className='truncate text-xl font-semibold'>
                {t('Image Workspace')}
              </h1>
              <p className='text-muted-foreground text-sm'>
                {t('Generate images through the same relay and billing flow.')}
              </p>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <Badge variant='secondary'>{model}</Badge>
            <Badge variant='outline'>{group}</Badge>
          </div>
        </div>
      </div>

      <div className='grid min-h-0 flex-1 gap-4 overflow-auto p-4 lg:grid-cols-[380px_minmax(0,1fr)]'>
        <Card className='h-fit'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Sparkles data-icon='inline-start' />
              {t('Create')}
            </CardTitle>
            <CardDescription>
              {t(
                'Costs are settled by model pricing, group ratio, and image count.'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel>{t('Prompt')}</FieldLabel>
                <Textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder={t('Describe the image you want to create...')}
                  className='min-h-36 resize-none'
                />
              </Field>

              <Field>
                <FieldLabel>{t('Model')}</FieldLabel>
                <Select
                  value={model}
                  onValueChange={(value) => value && setModel(value)}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue
                      placeholder={
                        isLoadingModels ? t('Loading...') : t('Select model')
                      }
                    />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      {imageModels.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel>{t('Group')}</FieldLabel>
                <Select
                  value={group}
                  onValueChange={(value) => value && setGroup(value)}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder={t('Select group')} />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      {groupOptions.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <div className='grid gap-4 sm:grid-cols-2'>
                <Field>
                  <FieldLabel>{t('Size')}</FieldLabel>
                  <Select
                    value={size}
                    onValueChange={(value) => value && setSize(value)}
                  >
                    <SelectTrigger className='w-full'>
                      <SelectValue placeholder={t('Size')} />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {sizeOptions.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel>{t('Quality')}</FieldLabel>
                  <Select
                    value={quality}
                    onValueChange={(value) => value && setQuality(value)}
                  >
                    <SelectTrigger className='w-full'>
                      <SelectValue placeholder={t('Quality')} />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {qualityOptions.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className='grid gap-4 sm:grid-cols-2'>
                <Field>
                  <FieldLabel>{t('Count')}</FieldLabel>
                  <Input
                    type='number'
                    min={1}
                    max={4}
                    value={count}
                    onChange={(event) =>
                      setCount(
                        Math.min(
                          4,
                          Math.max(1, Number(event.target.value) || 1)
                        )
                      )
                    }
                  />
                </Field>

                <Field>
                  <FieldLabel>{t('Output format')}</FieldLabel>
                  <Select
                    value={outputFormat}
                    onValueChange={(value) =>
                      value &&
                      setOutputFormat(
                        value as (typeof outputFormatOptions)[number]
                      )
                    }
                  >
                    <SelectTrigger className='w-full'>
                      <SelectValue placeholder={t('Output format')} />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {outputFormatOptions.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item.toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Button
                type='button'
                className='w-full'
                disabled={isGenerating}
                onClick={handleGenerate}
              >
                {isGenerating ? (
                  <Loader2 data-icon='inline-start' className='animate-spin' />
                ) : (
                  <Wand2 data-icon='inline-start' />
                )}
                {isGenerating ? t('Generating...') : t('Generate')}
              </Button>

              <FieldDescription>
                {t(
                  'The request uses /pg/images/generations so quota pre-consume, refund, and final settlement stay in the relay pipeline.'
                )}
              </FieldDescription>
            </FieldGroup>
          </CardContent>
        </Card>

        <div className='flex min-w-0 flex-col gap-4'>
          {error && (
            <Alert variant='destructive'>
              <AlertTitle>{t('Generation failed')}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Card className='min-h-[520px]'>
            <CardHeader>
              <CardTitle>{t('Results')}</CardTitle>
              <CardDescription>
                {t(
                  'Latest images appear here and are kept locally in this browser.'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>{imageContent}</CardContent>
          </Card>

          {history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('Recent generations')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='flex flex-col gap-3'>
                  {history.slice(0, 6).map((item, index) => (
                    <div key={item.id}>
                      <button
                        type='button'
                        className='hover:bg-muted/60 flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors'
                        onClick={() => {
                          setImages([item])
                          setPrompt(item.prompt)
                          setModel(item.model)
                          setSize(item.size)
                          setQuality(item.quality)
                          if (isOutputFormat(item.outputFormat)) {
                            setOutputFormat(item.outputFormat)
                          }
                        }}
                      >
                        <img
                          src={item.src}
                          alt={item.prompt}
                          className='size-14 shrink-0 rounded-md object-cover'
                        />
                        <div className='min-w-0 flex-1'>
                          <p className='truncate text-sm font-medium'>
                            {item.prompt}
                          </p>
                          <p className='text-muted-foreground truncate text-xs'>
                            {item.model} / {item.size} /{' '}
                            {new Date(item.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </button>
                      {index < Math.min(history.length, 6) - 1 && (
                        <Separator className='my-1' />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

export function ImageWorkbenchRoute() {
  return <ImageWorkbench />
}
