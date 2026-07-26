/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { normalizeCrop, type CropRect } from '../engine/canvas-media-transform'

export function CanvasCropDialog(props: {
  source: string | null
  onClose: () => void
  onApply: (crop: CropRect) => void
}) {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const [crop, setCrop] = useState<CropRect | null>(null)

  useEffect(() => {
    if (!props.source) return
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.addEventListener(
      'load',
      () => {
        imageRef.current = image
        const canvas = canvasRef.current
        if (!canvas) return
        const scale = Math.min(
          640 / image.naturalWidth,
          420 / image.naturalHeight,
          1
        )
        canvas.width = Math.round(image.naturalWidth * scale)
        canvas.height = Math.round(image.naturalHeight * scale)
        canvas
          .getContext('2d')
          ?.drawImage(image, 0, 0, canvas.width, canvas.height)
      },
      { once: true }
    )
    image.src = props.source
  }, [props.source])

  const redraw = (selection: CropRect | null) => {
    const canvas = canvasRef.current
    const image = imageRef.current
    if (!canvas || !image) return
    const context = canvas.getContext('2d')
    if (!context) return
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    if (!selection) return
    context.fillStyle = 'rgba(0,0,0,.45)'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(
      image,
      selection.x,
      selection.y,
      selection.width,
      selection.height,
      selection.x,
      selection.y,
      selection.width,
      selection.height
    )
    context.strokeStyle = '#fff'
    context.lineWidth = 2
    context.strokeRect(
      selection.x,
      selection.y,
      selection.width,
      selection.height
    )
  }

  return (
    <Dialog
      open={Boolean(props.source)}
      onOpenChange={(open) => {
        if (!open) props.onClose()
      }}
    >
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{t('Crop image')}</DialogTitle>
        </DialogHeader>
        <p className='text-muted-foreground text-xs'>
          {t('Drag a free rectangle over the image.')}
        </p>
        <canvas
          ref={canvasRef}
          className='max-h-[60vh] max-w-full touch-none self-center rounded border'
          aria-label={t('Image crop area')}
          onPointerDown={(event) => {
            const rect = event.currentTarget.getBoundingClientRect()
            startRef.current = {
              x:
                ((event.clientX - rect.left) * event.currentTarget.width) /
                rect.width,
              y:
                ((event.clientY - rect.top) * event.currentTarget.height) /
                rect.height,
            }
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={(event) => {
            if (
              !startRef.current ||
              !event.currentTarget.hasPointerCapture(event.pointerId)
            ) {
              return
            }
            const rect = event.currentTarget.getBoundingClientRect()
            const next = normalizeCrop(startRef.current, {
              x:
                ((event.clientX - rect.left) * event.currentTarget.width) /
                rect.width,
              y:
                ((event.clientY - rect.top) * event.currentTarget.height) /
                rect.height,
            })
            setCrop(next)
            redraw(next)
          }}
          onPointerUp={() => {
            startRef.current = null
          }}
        />
        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => {
              setCrop(null)
              redraw(null)
            }}
          >
            {t('Reset')}
          </Button>
          <Button
            disabled={!crop || crop.width < 2 || crop.height < 2}
            onClick={() => {
              if (!crop || !imageRef.current || !canvasRef.current) return
              const scale =
                imageRef.current.naturalWidth / canvasRef.current.width
              props.onApply({
                x: crop.x * scale,
                y: crop.y * scale,
                width: crop.width * scale,
                height: crop.height * scale,
              })
            }}
          >
            {t('Apply crop')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
