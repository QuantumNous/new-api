/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useTranslation } from 'react-i18next'

import type { PricingModel } from '@/features/pricing/types'
import { usePlaygroundStore } from '@/stores/playground-store'

import type { StudioModality } from '../../types'
import {
  MediaReferenceSlot,
  type MediaReference,
} from './attachments/media-reference-slot'
import { ComposerShell } from './composer'
import { GenerationParamChips } from './generation-param-chips'
import { PriceHintBadge } from './price-hint'
import { useComposerText } from './use-composer'

type GenerationComposerProps = {
  modality: Exclude<StudioModality, 'chat'>
  pricingModel?: PricingModel
  isPending: boolean
  references: MediaReference[]
  onReferencesChange: (value: MediaReference[]) => void
  onSubmit: (prompt: string) => void
}

/**
 * Composer for image/video/audio generation: shared skeleton plus the
 * media reference slot (image reference / video first frame) and the
 * price hint. Generation parameters live in the settings panel.
 */
export function GenerationComposer(props: GenerationComposerProps) {
  const { t } = useTranslation()
  const { text, setText } = useComposerText()
  const model = usePlaygroundStore((state) => state.config.model)
  const group = usePlaygroundStore((state) => state.config.group)
  const groups = usePlaygroundStore((state) => state.groups)
  const settings = usePlaygroundStore((state) => state.studioSettings)

  const showMediaSlot = props.modality === 'image' || props.modality === 'video'
  const mediaLabel =
    props.modality === 'video' ? t('First frame') : t('Reference image')
  const groupRatio = groups.find((item) => item.value === group)?.ratio

  const submit = () => {
    if (!text.trim() || !model) return
    props.onSubmit(text.trim())
    setText('')
  }

  let placeholder = t('Describe what you want to create…')
  if (props.modality === 'audio') {
    placeholder = t('Enter the text to speak…')
  } else if (props.modality === 'video') {
    placeholder = t('Describe the video scene and motion…')
  } else if (props.modality === 'image') {
    placeholder = t('Describe the image you want to create…')
  }

  return (
    <div className='playground-composer-dock mx-auto w-full max-w-4xl shrink-0 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] sm:px-3 sm:py-3 md:px-3 md:py-3.5'>
      {props.isPending && (
        <p className='text-muted-foreground mb-2 px-1 text-center text-[11px]'>
          {t('Generating… you can already queue the next run.')}
        </p>
      )}
      <ComposerShell
        text={text}
        onTextChange={setText}
        onSubmit={submit}
        placeholder={placeholder}
        canSubmit={Boolean(text.trim() && model)}
        tools={
          <div className='flex min-w-0 items-center gap-1 overflow-x-auto py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
            {showMediaSlot && (
              <MediaReferenceSlot
                label={mediaLabel}
                value={props.references}
                onChange={props.onReferencesChange}
                attachable
                kind='image'
                maxFiles={props.modality === 'image' ? 4 : 1}
              />
            )}
            <GenerationParamChips modality={props.modality} />
          </div>
        }
        trailing={
          <PriceHintBadge
            model={props.pricingModel}
            group={group}
            groupRatio={groupRatio}
            estimateParams={{
              modality: props.modality,
              n: settings.imageCount,
              size:
                props.modality === 'video'
                  ? settings.videoSize
                  : settings.imageSize,
              duration:
                props.modality === 'video' ? settings.videoDuration : undefined,
              has_reference: props.references.length > 0,
            }}
          />
        }
        className='px-0'
      />
    </div>
  )
}
