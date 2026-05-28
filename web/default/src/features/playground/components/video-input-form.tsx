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
import { useState, useMemo, useEffect } from 'react'
import { FilmIcon, Loader2Icon, KeyRoundIcon, ChevronDownIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import { HAPPYHORSE_MODELS, VIDEO_MODEL_TYPE_LABELS } from '../constants'
import { getUserTokens, fetchTokenKey } from '../api'
import { MediaDropZone } from './media-drop-zone'
import type { VideoGenerationRequest, ModelOption, TokenOption, VideoModelType } from '../types'

interface VideoInputFormProps {
  models: ModelOption[]
  onSubmit: (
    req: VideoGenerationRequest,
    apiKey: string,
    tokenId: number,
    meta?: { size?: string; duration?: number; type?: VideoModelType }
  ) => Promise<void>
  isSubmitting?: boolean
}

export function VideoInputForm({
  models,
  onSubmit,
  isSubmitting = false,
}: VideoInputFormProps) {
  const { t } = useTranslation()

  // Filter to only happyhorse models available to user
  const availableModels = useMemo(() => {
    const userModelValues = new Set(models.map((m) => m.value))
    return HAPPYHORSE_MODELS.filter((m) => userModelValues.has(m.model))
  }, [models])

  const [selectedModel, setSelectedModel] = useState<string>(
    availableModels[0]?.model ?? HAPPYHORSE_MODELS[0].model
  )
  const [prompt, setPrompt] = useState('')
  const [size, setSize] = useState('720P')
  const [duration, setDuration] = useState(5)
  const [imageUrls, setImageUrls] = useState(['', ''])
  const [videoUrl, setVideoUrl] = useState('')

  // Advanced settings
  const [promptExtend, setPromptExtend] = useState(true)
  const [seed, setSeed] = useState<number | undefined>(undefined)
  const [watermark, setWatermark] = useState(false)

  // Token (API key) selector state
  const [tokens, setTokens] = useState<TokenOption[]>([])
  const [selectedTokenId, setSelectedTokenId] = useState<string>('')
  const [isLoadingTokens, setIsLoadingTokens] = useState(false)

  const selectedTokenName = useMemo(() => {
    if (!selectedTokenId) return ''
    return tokens.find((tk) => String(tk.id) === selectedTokenId)?.name ?? ''
  }, [tokens, selectedTokenId])

  // Load user tokens on mount
  useEffect(() => {
    setIsLoadingTokens(true)
    getUserTokens()
      .then((list) => {
        setTokens(list)
        if (list.length > 0) {
          setSelectedTokenId(String(list[0].id))
        }
      })
      .finally(() => setIsLoadingTokens(false))
  }, [])

  const modelConfig = useMemo(
    () =>
      HAPPYHORSE_MODELS.find((m) => m.model === selectedModel) ??
      HAPPYHORSE_MODELS[0],
    [selectedModel]
  )

  // Keep selectedModel in sync with async model availability
  useEffect(() => {
    if (availableModels.length === 0) return
    const exists = availableModels.some((m) => m.model === selectedModel)
    if (!exists) {
      setSelectedModel(availableModels[0].model)
    }
  }, [availableModels, selectedModel])

  // Helper for API key selector placeholder (avoids nested ternary)
  const getKeyPlaceholder = () => {
    if (isLoadingTokens) return t('Loading...')
    if (tokens.length === 0) return t('No API keys available')
    return t('Select API key')
  }

  // Submit validation: block when required media is missing
  const hasRequiredMedia = (() => {
    if (modelConfig.requiresVideo && !videoUrl.trim()) return false
    if (modelConfig.requiresImage && imageUrls.filter((u) => u.trim() !== '').length === 0) return false
    return true
  })()
  const canSubmit = !isSubmitting && !!prompt.trim() && !!selectedTokenId && hasRequiredMedia

  const modelsToShow = useMemo(
    () => (availableModels.length > 0 ? availableModels : HAPPYHORSE_MODELS),
    [availableModels]
  )

  const modelsByType = useMemo(() => {
    const groups = new Map<VideoModelType, typeof modelsToShow>()
    for (const m of modelsToShow) {
      const list = groups.get(m.type) ?? []
      list.push(m)
      groups.set(m.type, list)
    }
    return groups
  }, [modelsToShow])

  const modelsForActiveType = useMemo(
    () => modelsByType.get(modelConfig.type) ?? [],
    [modelsByType, modelConfig.type]
  )

  const handleSubmit = async () => {
    if (isSubmitting) return
    if (!prompt.trim()) return
    if (!selectedTokenId) return
    if (!hasRequiredMedia) return

    const selectedToken = tokens.find((t) => String(t.id) === selectedTokenId)
    if (!selectedToken) return

    // Fetch real key (unmasked)
    const realKey = await fetchTokenKey(selectedToken.id)
    if (!realKey) return

    const req: VideoGenerationRequest = {
      model: selectedModel,
      prompt: prompt.trim(),
      size,
      duration,
      metadata: {
        prompt_extend: promptExtend,
        watermark,
        ...(seed != null ? { seed } : {}),
      },
    }

    if (modelConfig.requiresVideo && videoUrl.trim()) {
      req.input_reference = videoUrl.trim()
    }

    if (modelConfig.requiresImage) {
      const imgs = imageUrls.filter((u) => u.trim() !== '')
      if (imgs.length > 0) {
        if (modelConfig.type === 'image-to-video') {
          req.input_reference = imgs[0]
        } else {
          // reference-to-video: first/last frames via images[]
          req.images = imgs
        }
      }
    }

    await onSubmit(req, realKey, selectedToken.id, {
      size,
      duration,
      type: modelConfig.type,
    })
    setPrompt('')
  }

  return (
    <div className='flex flex-col gap-4 p-4'>
      {/* API Key selector */}
      <div className='flex flex-col gap-1.5'>
        <Label className='flex items-center gap-1'>
          <KeyRoundIcon className='size-3.5' />
          {t('API Key')}
        </Label>
        <Select
          disabled={isLoadingTokens || tokens.length === 0}
          value={selectedTokenId}
          onValueChange={(v) => { if (v != null) setSelectedTokenId(v) }}
        >
          <SelectTrigger>
            {selectedTokenName ? (
              <span className='flex flex-1 text-left' data-slot='select-value'>
                {selectedTokenName}
              </span>
            ) : (
            <SelectValue placeholder={getKeyPlaceholder()} />
            )}
          </SelectTrigger>
          <SelectContent>
            {tokens.map((t) => (
              <SelectItem key={t.id} value={String(t.id)}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {tokens.length === 0 && !isLoadingTokens && (
          <p className='text-muted-foreground text-xs'>
            {t('Please create an API key first in the Keys page.')}
          </p>
        )}
      </div>

      {/* Model Type Tabs */}
      <div className='flex flex-col gap-1.5'>
        <Label>{t('Model')}</Label>
        <Tabs
          value={modelConfig.type}
          onValueChange={(v) => {
            const type = v as VideoModelType
            const typeModels = modelsByType.get(type)
            if (typeModels?.[0]) {
              setSelectedModel(typeModels[0].model)
            }
          }}
        >
          <TabsList variant='line'>
            {Array.from(modelsByType.keys()).map((type) => (
              <TabsTrigger key={type} value={type}>
                {VIDEO_MODEL_TYPE_LABELS[type]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {modelsForActiveType.length > 1 && (
          <Select
            value={selectedModel}
            onValueChange={(v) => { if (v != null) setSelectedModel(v) }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {modelsForActiveType.map((m) => (
                <SelectItem key={m.model} value={m.model}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <p className='text-muted-foreground text-xs'>
          {t(modelConfig.label)}
        </p>
      </div>

      {/* Prompt */}
      <div className='flex flex-col gap-1.5'>
        <Label htmlFor='video-prompt'>{t('Prompt')}</Label>
        <Textarea
          id='video-prompt'
          className='min-h-[100px] resize-none'
          placeholder={t('Describe the video you want to generate...')}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </div>

      {/* Resolution */}
      <div className='flex flex-col gap-1.5'>
        <Label>{t('Resolution')}</Label>
        <div className='flex gap-2'>
          {modelConfig.supportedSizes.map((s) => (
            <Button
              key={s}
              className='flex-1'
              size='sm'
              type='button'
              variant={size === s ? 'default' : 'outline'}
              onClick={() => setSize(s)}
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div className='flex flex-col gap-1.5'>
        <Label>
          {t('Duration')}: {duration}s
        </Label>
        <Slider
          max={modelConfig.durationRange[1]}
          min={modelConfig.durationRange[0]}
          step={1}
          value={[duration]}
          onValueChange={(v) => { const arr = Array.isArray(v) ? v : [v]; setDuration(arr[0] as number) }}
        />
        <div className='text-muted-foreground flex justify-between text-xs'>
          <span>{modelConfig.durationRange[0]}s</span>
          <span>{modelConfig.durationRange[1]}s</span>
        </div>
      </div>

      {/* Image input for i2v / r2v */}
      {modelConfig.requiresImage && (
        <div className='flex flex-col gap-1.5'>
          {modelConfig.type === 'image-to-video' ? (
            <>
              <Label>{t('Reference Image')}</Label>
              <MediaDropZone
                accept='image'
                value={imageUrls[0]}
                onChange={(url) => setImageUrls([url, imageUrls[1]])}
              />
            </>
          ) : (
            <>
              <Label>{t('First Frame Image')}</Label>
              <MediaDropZone
                accept='image'
                value={imageUrls[0]}
                onChange={(url) => setImageUrls([url, imageUrls[1]])}
              />
              <Label>{t('Last Frame Image (Optional)')}</Label>
              <MediaDropZone
                accept='image'
                value={imageUrls[1]}
                onChange={(url) => setImageUrls([imageUrls[0], url])}
              />
            </>
          )}
        </div>
      )}

      {/* Video input for video-edit */}
      {modelConfig.requiresVideo && (
        <div className='flex flex-col gap-1.5'>
          <Label>{t('Source Video')}</Label>
          <MediaDropZone
            accept='video'
            value={videoUrl}
            onChange={setVideoUrl}
          />
        </div>
      )}

      {/* Advanced Settings */}
      <Collapsible>
        <CollapsibleTrigger className='text-muted-foreground hover:text-foreground flex w-full cursor-pointer items-center gap-1 text-sm transition-colors [&[data-panel-open]>svg]:rotate-180'>
          <ChevronDownIcon className='size-4 transition-transform' />
          {t('Advanced Settings')}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className='mt-2 flex flex-col gap-3'>
            {/* Prompt Extend */}
            <div className='flex items-center justify-between'>
              <Label className='text-sm font-normal'>
                {t('Prompt Extend')}
              </Label>
              <Switch
                size='sm'
                checked={promptExtend}
                onCheckedChange={setPromptExtend}
              />
            </div>

            {/* Watermark */}
            <div className='flex items-center justify-between'>
              <Label className='text-sm font-normal'>
                {t('Watermark')}
              </Label>
              <Switch
                size='sm'
                checked={watermark}
                onCheckedChange={setWatermark}
              />
            </div>

            {/* Seed */}
            <div className='flex items-center justify-between gap-4'>
              <Label className='text-sm font-normal'>
                {t('Seed')}
              </Label>
              <Input
                type='number'
                className='h-8 w-32 text-sm'
                placeholder={t('Random')}
                value={seed ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  setSeed(v === '' ? undefined : Number(v))
                }}
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Submit */}
      <Button
        className='w-full'
        disabled={!canSubmit}
        type='button'
        onClick={handleSubmit}
      >
        {isSubmitting ? (
          <>
            <Loader2Icon className='mr-2 size-4 animate-spin' />
            {t('Submitting...')}
          </>
        ) : (
          <>
            <FilmIcon className='mr-2 size-4' />
            {t('Generate Video')}
          </>
        )}
      </Button>
    </div>
  )
}
