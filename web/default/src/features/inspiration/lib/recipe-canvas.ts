/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { createCanvasNode } from '@/features/workbench/engine/canvas-domain'
import { DEFAULT_VIEWPORT } from '@/features/workbench/store/canvas-store'
import {
  CanvasNodeType,
  type CanvasDocument,
  type CanvasNodeMetadata,
} from '@/features/workbench/types'

import type { AppliedInspirationRecipe, InspirationSeries } from '../types'

const FIRST_NODE_POSITION = { x: 420, y: 320 }
const SECOND_NODE_POSITION = { x: 960, y: 320 }

export function withNegativePrompt(
  prompt: string,
  negativePrompt: string | undefined
): string {
  const negative = negativePrompt?.trim()
  if (!negative) return prompt
  return `${prompt}\n\nNegative: ${negative}`
}

export function recipeNodeMetadata(
  recipe: AppliedInspirationRecipe,
  options?: { asNote?: boolean }
): CanvasNodeMetadata {
  const prompt = withNegativePrompt(recipe.prompt, recipe.negativePrompt)
  if (options?.asNote || recipe.modality === 'chat') {
    return { content: prompt, status: 'idle' }
  }
  const parameters = recipe.parameters ?? {}
  const readString = (key: string) => {
    const value = parameters[key]
    return typeof value === 'string' || typeof value === 'number'
      ? String(value)
      : undefined
  }
  return {
    prompt,
    model: recipe.model,
    status: 'idle',
    size: readString('size'),
    quality: readString('quality'),
    seconds: readString('duration') ?? readString('seconds'),
    count: Number(parameters.n) > 0 ? Number(parameters.n) : undefined,
    workflowTitle: recipe.title,
  }
}

export function blankCanvasDocument(): CanvasDocument {
  return {
    nodes: [],
    connections: [],
    viewport: DEFAULT_VIEWPORT,
    backgroundMode: 'lines',
    experienceMode: 'professional',
  }
}

/** Image recipes seed one node; video recipes seed an image → video chain. */
export function canvasDocumentFromRecipe(
  recipe: AppliedInspirationRecipe
): CanvasDocument {
  const document = blankCanvasDocument()

  if (recipe.modality === 'video') {
    const imageNode = createCanvasNode(
      CanvasNodeType.Image,
      FIRST_NODE_POSITION,
      recipeNodeMetadata({ ...recipe, modality: 'image', model: '' })
    )
    imageNode.title = recipe.title
    const videoNode = createCanvasNode(
      CanvasNodeType.Video,
      SECOND_NODE_POSITION,
      recipeNodeMetadata(recipe)
    )
    videoNode.title = recipe.title
    document.nodes = [imageNode, videoNode]
    document.connections = [
      {
        id: `connection-${imageNode.id}-${videoNode.id}`,
        fromNodeId: imageNode.id,
        toNodeId: videoNode.id,
      },
    ]
    return document
  }

  const typeByModality: Record<string, CanvasNodeType> = {
    image: CanvasNodeType.Image,
    audio: CanvasNodeType.Audio,
  }
  const type = typeByModality[recipe.modality] ?? CanvasNodeType.Text
  const node = createCanvasNode(
    type,
    FIRST_NODE_POSITION,
    recipeNodeMetadata(recipe, { asNote: type === CanvasNodeType.Text })
  )
  node.title = recipe.title
  document.nodes = [node]
  return document
}

export function seriesForModality(modality: string): InspirationSeries {
  return modality === 'video' ? 'video' : 'image'
}
