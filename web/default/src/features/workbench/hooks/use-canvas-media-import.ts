/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { uploadPlaygroundAsset } from '@/features/playground/api'

import {
  mediaKindForFile,
  mediaKindForNode,
  metadataForMediaReplacement,
} from '../engine/canvas-media-replacement'
import { fitNodeSize } from '../engine/canvas-viewport'
import { useCanvasStore } from '../store/canvas-store'
import { CanvasNodeType, type Position } from '../types'

const IMPORT_GAP = 32

function nodeTypeForFile(file: File): CanvasNodeType | null {
  if (file.type.startsWith('image/')) return CanvasNodeType.Image
  if (file.type.startsWith('video/')) return CanvasNodeType.Video
  if (file.type.startsWith('audio/')) return CanvasNodeType.Audio
  if (file.type.startsWith('text/')) return CanvasNodeType.Text
  return null
}

function measureImage(
  url: string
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.addEventListener('load', () =>
      resolve(fitNodeSize(image.naturalWidth, image.naturalHeight))
    )
    image.addEventListener('error', () => resolve(null))
    image.src = url
  })
}

export function useCanvasMediaImport(): {
  importFiles: (files: File[], position: Position) => Promise<void>
  importText: (text: string, position: Position) => void
  replaceNodeMedia: (nodeId: string, file: File) => Promise<boolean>
} {
  const { t } = useTranslation()

  const replaceNodeMedia = useCallback(
    async (nodeId: string, file: File) => {
      const node = useCanvasStore
        .getState()
        .nodes.find((item) => item.id === nodeId)
      const kind = node && mediaKindForNode(node)
      if (!node || !kind || mediaKindForFile(file) !== kind) {
        toast.error(t('Choose a matching media file'))
        return false
      }
      try {
        const asset = await uploadPlaygroundAsset(file, kind)
        const current = useCanvasStore
          .getState()
          .nodes.find((item) => item.id === nodeId)
        if (!current || current.type !== node.type) return false
        useCanvasStore.getState().updateNode(nodeId, {
          title: file.name,
          metadata: metadataForMediaReplacement(current, asset, file.type),
        })
        toast.success(t('Media replaced'))
        return true
      } catch {
        toast.error(t('Failed to replace the media. The original was kept.'))
        return false
      }
    },
    [t]
  )

  const importFiles = useCallback(
    async (files: File[], position: Position) => {
      const supported = files.filter((file) => nodeTypeForFile(file))
      if (!supported.length) {
        toast.error(t('This file type cannot be added to the canvas'))
        return
      }
      let offsetX = position.x
      for (const file of supported) {
        const type = nodeTypeForFile(file) as CanvasNodeType
        if (type === CanvasNodeType.Text) {
          const store = useCanvasStore.getState()
          const node = store.addNode(
            CanvasNodeType.Text,
            { x: offsetX, y: position.y },
            { content: await file.text(), status: 'idle' }
          )
          store.updateNode(node.id, { title: file.name })
          offsetX += node.width + IMPORT_GAP
          continue
        }
        const kind = type === CanvasNodeType.Image ? 'image' : type
        try {
          const asset = await uploadPlaygroundAsset(file, kind)
          const store = useCanvasStore.getState()
          const node = store.addNode(
            type,
            { x: offsetX, y: position.y },
            {
              content: asset.url,
              assetId: asset.id,
              mimeType: file.type,
              status: 'success',
            }
          )
          store.updateNode(node.id, { title: file.name })
          if (type === CanvasNodeType.Image) {
            const size = await measureImage(asset.url)
            if (size) {
              useCanvasStore.getState().updateNode(node.id, {
                width: size.width,
                height: size.height,
                position: {
                  x: offsetX - size.width / 2,
                  y: position.y - size.height / 2,
                },
              })
              offsetX += size.width + IMPORT_GAP
              continue
            }
          }
          offsetX += node.width + IMPORT_GAP
        } catch {
          toast.error(t('Failed to upload the file'))
        }
      }
    },
    [t]
  )

  const importText = useCallback((text: string, position: Position) => {
    const trimmed = text.trim()
    if (!trimmed) return
    useCanvasStore.getState().addNode(CanvasNodeType.Text, position, {
      content: trimmed,
      status: 'idle',
    })
  }, [])

  return { importFiles, importText, replaceNodeMedia }
}
