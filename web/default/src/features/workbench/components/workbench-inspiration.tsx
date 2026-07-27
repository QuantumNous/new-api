/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useNavigate } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { InspirationGallery } from '@/features/inspiration/components/inspiration-gallery'
import { recipeNodeMetadata } from '@/features/inspiration/lib/recipe-canvas'
import type {
  AppliedInspirationRecipe,
  InspirationApplyTarget,
} from '@/features/inspiration/types'
import { useAuthStore } from '@/stores/auth-store'

import { createStoryboardRow } from '../engine/canvas-domain'
import { useCanvasGeneration } from '../hooks/use-canvas-generation'
import { useWorkbenchModels } from '../hooks/use-workbench-models'
import { useCanvasStore } from '../store/canvas-store'
import { CanvasNodeType, type StoryboardRow } from '../types'

function canvasCenter(store: ReturnType<typeof useCanvasStore.getState>) {
  return {
    x: -store.viewport.x / store.viewport.k + 420,
    y: -store.viewport.y / store.viewport.k + 320,
  }
}

function storyboardPromptPatch(
  recipe: AppliedInspirationRecipe
): Partial<StoryboardRow> {
  const negative = recipe.negativePrompt?.trim() ?? ''
  if (recipe.modality === 'video') {
    return { videoMotionPrompt: recipe.prompt, negativePrompt: negative }
  }
  return { imageGenerationPrompt: recipe.prompt, negativePrompt: negative }
}

function isEmptyStoryboardRow(row: StoryboardRow): boolean {
  return (
    !row.imageGenerationPrompt.trim() &&
    !row.videoMotionPrompt.trim() &&
    !row.plotDescription.trim() &&
    !row.dialogue.trim()
  )
}

function applyToStoryboardRow(
  recipe: AppliedInspirationRecipe,
  t: (key: string) => string
): boolean {
  const store = useCanvasStore.getState()
  const selectedStoryboards = store.nodes.filter(
    (node) =>
      node.type === CanvasNodeType.Script &&
      store.selectedNodeIds.includes(node.id)
  )
  const patch = storyboardPromptPatch(recipe)

  if (selectedStoryboards.length === 1) {
    const storyboard = selectedStoryboards[0]
    const rows = storyboard.metadata?.storyboard?.rows ?? []
    const targetRow =
      rows.find((row) => isEmptyStoryboardRow(row)) ?? rows[0] ?? null
    if (targetRow) {
      store.updateStoryboardRow(storyboard.id, targetRow.id, patch)
    } else {
      store.setStoryboardRows(storyboard.id, [
        ...rows,
        createStoryboardRow(rows.length + 1, patch),
      ])
    }
    return true
  }

  const storyboard = store.nodes.find(
    (node) => node.type === CanvasNodeType.Script
  )
  if (!storyboard) {
    toast.error(t('Select a storyboard node first'))
    return false
  }

  const rows = storyboard.metadata?.storyboard?.rows ?? []
  store.setStoryboardRows(storyboard.id, [
    ...rows,
    createStoryboardRow(rows.length + 1, patch),
  ])
  return true
}

function nodeTypeForTarget(
  target: InspirationApplyTarget
): CanvasNodeType | null {
  if (target === 'image') return CanvasNodeType.Image
  if (target === 'video') return CanvasNodeType.Video
  if (target === 'audio') return CanvasNodeType.Audio
  if (target === 'note') return CanvasNodeType.Text
  return null
}

export function WorkbenchInspiration(props: { onApplied?: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.auth.user)
  const models = useWorkbenchModels()
  const { generateNode } = useCanvasGeneration()

  const availableModels = useMemo(
    () =>
      models.options.map((option) => ({
        name: option.value,
        modality: option.modality,
      })),
    [models.options]
  )

  return (
    <div className='overflow-y-auto px-4 pb-6'>
      <InspirationGallery
        isAuthenticated={Boolean(user)}
        availableModels={availableModels}
        onRequireAuth={() => void navigate({ to: '/sign-in' })}
        onApply={(recipe, options) => {
          const store = useCanvasStore.getState()
          const center = canvasCenter(store)
          const generateIds: string[] = []

          if (options.target === 'storyboard-row') {
            if (!applyToStoryboardRow(recipe, t)) return
            toast.success(t('Applied to storyboard row'))
            props.onApplied?.()
            return
          }

          if (options.target === 'image-to-video') {
            const imageNode = store.addNode(
              CanvasNodeType.Image,
              center,
              recipeNodeMetadata({ ...recipe, modality: 'image' })
            )
            store.updateNode(imageNode.id, {
              title: recipe.title || t('Image'),
            })
            const videoNode = store.addNode(
              CanvasNodeType.Video,
              { x: center.x + 420, y: center.y },
              recipeNodeMetadata(
                recipe.modality === 'video'
                  ? recipe
                  : { ...recipe, modality: 'video' }
              )
            )
            store.updateNode(videoNode.id, {
              title: recipe.title || t('Video'),
            })
            store.connectNodes(imageNode.id, videoNode.id)
            generateIds.push(imageNode.id, videoNode.id)
          } else {
            const type = nodeTypeForTarget(options.target)
            if (!type) return
            const node = store.addNode(
              type,
              center,
              recipeNodeMetadata(recipe, {
                asNote: options.target === 'note',
              })
            )
            store.updateNode(node.id, { title: recipe.title })
            if (
              options.target === 'image' ||
              options.target === 'video' ||
              options.target === 'audio'
            ) {
              generateIds.push(node.id)
            }
          }

          toast.success(t('Added to the canvas'))
          if (options.autoRun) {
            for (const id of generateIds) void generateNode(id)
          }
          props.onApplied?.()
        }}
      />
    </div>
  )
}
