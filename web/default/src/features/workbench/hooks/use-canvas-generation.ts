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
/*
Adapted from open-ai-canvas (https://github.com/ddcat-ai/open-ai-canvas),
based on basketikun/infinite-canvas. AGPL-3.0; see THIRD-PARTY-LICENSES.md.
*/
import { useCallback, useEffect, useRef, useState } from 'react'

import { usePlaygroundStore } from '@/stores/playground-store'

import { MISSING_MODEL_ERROR } from '../components/nodes/node-shared'
import { NODE_DEFAULT_SIZE } from '../constants'
import { createCanvasNode } from '../engine/canvas-domain'
import { buildNodeGenerationContext } from '../engine/canvas-generation-context'
import {
  runCanvasAudioGeneration,
  runCanvasImageGeneration,
  runCanvasVideoGeneration,
  type CanvasGenerationSettings,
} from '../engine/canvas-generation-runner'
import { fitNodeSize } from '../engine/canvas-viewport'
import { useCanvasStore } from '../store/canvas-store'
import {
  CanvasNodeType,
  type CanvasNodeData,
  type CanvasNodeMetadata,
} from '../types'

const BATCH_GAP = 24

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return String(error)
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function pickDefinedMetadata(
  source: CanvasNodeMetadata | undefined,
  keys: Array<keyof CanvasNodeMetadata>
): Partial<CanvasNodeMetadata> {
  const result: Partial<CanvasNodeMetadata> = {}
  if (!source) return result
  keys.forEach((key) => {
    const value = source[key]
    if (value !== undefined && value !== null && value !== '') {
      ;(result as Record<string, unknown>)[key] = value
    }
  })
  return result
}

function resolveGenerationSettings(
  node: CanvasNodeData,
  nodes: CanvasNodeData[],
  presetNodeId?: string
): CanvasGenerationSettings {
  const preset = presetNodeId
    ? nodes.find((item) => item.id === presetNodeId)
    : undefined
  const keys: Array<keyof CanvasNodeMetadata> = [
    'model',
    'size',
    'quality',
    'count',
    'seconds',
    'audioVoice',
    'audioFormat',
    'audioSpeed',
  ]
  // Preset supplies defaults only for fields the node itself does not define.
  const merged = {
    ...pickDefinedMetadata(preset?.metadata, keys),
    ...pickDefinedMetadata(node.metadata, keys),
  }
  const group = usePlaygroundStore.getState().config.group || ''
  return {
    model: typeof merged.model === 'string' ? merged.model : '',
    group,
    size: typeof merged.size === 'string' ? merged.size : undefined,
    quality: typeof merged.quality === 'string' ? merged.quality : undefined,
    count: typeof merged.count === 'number' ? merged.count : undefined,
    seconds: typeof merged.seconds === 'string' ? merged.seconds : undefined,
    audioVoice:
      typeof merged.audioVoice === 'string' ? merged.audioVoice : undefined,
    audioFormat:
      typeof merged.audioFormat === 'string' ? merged.audioFormat : undefined,
    audioSpeed:
      typeof merged.audioSpeed === 'string' ? merged.audioSpeed : undefined,
  }
}

function applyImageSize(
  nodeId: string,
  naturalWidth?: number,
  naturalHeight?: number
) {
  if (!naturalWidth || !naturalHeight) return
  const size = fitNodeSize(naturalWidth, naturalHeight)
  useCanvasStore.getState().updateNode(nodeId, {
    width: size.width,
    height: size.height,
  })
}

function applyImageToNode(
  nodeId: string,
  image: {
    url: string
    assetId?: number
    naturalWidth?: number
    naturalHeight?: number
  },
  extra: Partial<CanvasNodeMetadata> = {}
) {
  applyImageSize(nodeId, image.naturalWidth, image.naturalHeight)
  useCanvasStore.getState().updateNodeMetadata(nodeId, {
    content: image.url,
    assetId: image.assetId,
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
    status: 'success',
    errorDetails: undefined,
    ...extra,
  })
}

function createBatchChildNodes(
  root: CanvasNodeData,
  images: Array<{
    url: string
    assetId?: number
    naturalWidth?: number
    naturalHeight?: number
  }>
): CanvasNodeData[] {
  const defaultSize = NODE_DEFAULT_SIZE[CanvasNodeType.Image]
  let offsetX = root.position.x + root.width + BATCH_GAP

  return images.map((image, index) => {
    const fitted =
      image.naturalWidth && image.naturalHeight
        ? fitNodeSize(image.naturalWidth, image.naturalHeight)
        : { width: defaultSize.width, height: defaultSize.height }
    const center = {
      x: offsetX + fitted.width / 2,
      y: root.position.y + fitted.height / 2,
    }
    const child = createCanvasNode(CanvasNodeType.Image, center, {
      content: image.url,
      assetId: image.assetId,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      status: 'success',
      batchRootId: root.id,
      prompt: root.metadata?.prompt,
      model: root.metadata?.model,
      size: root.metadata?.size,
      quality: root.metadata?.quality,
    })
    child.width = fitted.width
    child.height = fitted.height
    child.position = { x: offsetX, y: root.position.y }
    child.title = `${root.title} ${index + 2}`
    offsetX += fitted.width + BATCH_GAP
    return child
  })
}

export function useCanvasGeneration(): {
  generateNode: (nodeId: string) => Promise<void>
  cancelNode: (nodeId: string) => void
  isNodeRunning: (nodeId: string) => boolean
} {
  const controllersRef = useRef(new Map<string, AbortController>())
  const [runningIds, setRunningIds] = useState<string[]>([])

  const syncRunningIds = useCallback(() => {
    setRunningIds([...controllersRef.current.keys()])
  }, [])

  useEffect(() => {
    const controllers = controllersRef.current
    return () => {
      controllers.forEach((controller) => controller.abort())
      controllers.clear()
    }
  }, [])

  const cancelNode = useCallback(
    (nodeId: string) => {
      const controller = controllersRef.current.get(nodeId)
      if (!controller) return
      controller.abort()
      controllersRef.current.delete(nodeId)
      syncRunningIds()
      useCanvasStore.getState().updateNodeMetadata(nodeId, {
        status: 'idle',
        errorDetails: undefined,
      })
    },
    [syncRunningIds]
  )

  const isNodeRunning = useCallback(
    (nodeId: string) => runningIds.includes(nodeId),
    [runningIds]
  )

  const generateNode = useCallback(
    async (nodeId: string) => {
      const store = useCanvasStore.getState()
      const node = store.nodes.find((item) => item.id === nodeId)
      if (!node) return
      if (
        node.type !== CanvasNodeType.Image &&
        node.type !== CanvasNodeType.Video &&
        node.type !== CanvasNodeType.Audio
      ) {
        return
      }

      const existing = controllersRef.current.get(nodeId)
      if (existing) existing.abort()

      const controller = new AbortController()
      controllersRef.current.set(nodeId, controller)
      syncRunningIds()

      const context = buildNodeGenerationContext(
        nodeId,
        store.nodes,
        store.connections,
        node.metadata?.prompt ?? ''
      )
      const settings = resolveGenerationSettings(
        node,
        store.nodes,
        context.presetNodeId
      )

      if (!settings.model) {
        store.updateNodeMetadata(nodeId, {
          status: 'error',
          errorDetails: MISSING_MODEL_ERROR,
        })
        controllersRef.current.delete(nodeId)
        syncRunningIds()
        return
      }

      store.updateNodeMetadata(nodeId, {
        status: 'loading',
        errorDetails: undefined,
        taskStatus: undefined,
        taskProgress: undefined,
      })

      try {
        if (node.type === CanvasNodeType.Image) {
          const result = await runCanvasImageGeneration({
            prompt: context.prompt,
            referenceImages: context.referenceImages,
            settings,
          })
          if (controller.signal.aborted) {
            const abortError = new Error('Aborted')
            abortError.name = 'AbortError'
            throw abortError
          }

          const images = result.images
          if (!images.length) {
            throw new Error('No images were generated')
          }

          if (images.length === 1) {
            applyImageToNode(nodeId, images[0], {
              isBatchRoot: undefined,
              batchChildIds: undefined,
              primaryImageId: undefined,
              imageBatchExpanded: undefined,
            })
          } else {
            const [first, ...rest] = images
            const latestRoot =
              useCanvasStore
                .getState()
                .nodes.find((item) => item.id === nodeId) || node
            const children = createBatchChildNodes(latestRoot, rest)
            applyImageToNode(nodeId, first, {
              isBatchRoot: true,
              primaryImageId: nodeId,
              batchChildIds: children.map((child) => child.id),
              imageBatchExpanded: false,
            })
            useCanvasStore.getState().insertNodes(children)
          }
          return
        }

        if (node.type === CanvasNodeType.Video) {
          const result = await runCanvasVideoGeneration({
            prompt: context.prompt,
            referenceImages: context.referenceImages,
            disableLastFrame: node.metadata?.disableLastFrame,
            settings,
            signal: controller.signal,
            onProgress: (progress) => {
              if (controller.signal.aborted) return
              useCanvasStore.getState().updateNodeMetadata(nodeId, {
                taskId: progress.taskId,
                taskStatus: progress.status,
                taskProgress:
                  progress.percent === null ? undefined : progress.percent,
                status: 'loading',
              })
            },
          })
          useCanvasStore.getState().updateNodeMetadata(nodeId, {
            content: result.url,
            assetId: result.assetId,
            taskId: result.taskId,
            taskStatus: 'SUCCESS',
            taskProgress: 100,
            status: 'success',
            errorDetails: undefined,
          })
          return
        }

        const audioText = context.prompt || node.metadata?.content || ''
        const result = await runCanvasAudioGeneration({
          text: audioText,
          settings,
        })
        if (controller.signal.aborted) {
          const abortError = new Error('Aborted')
          abortError.name = 'AbortError'
          throw abortError
        }
        useCanvasStore.getState().updateNodeMetadata(nodeId, {
          content: result.url,
          assetId: result.assetId,
          status: 'success',
          errorDetails: undefined,
        })
      } catch (error) {
        if (isAbortError(error) || controller.signal.aborted) {
          useCanvasStore.getState().updateNodeMetadata(nodeId, {
            status: 'idle',
            errorDetails: undefined,
          })
          return
        }
        useCanvasStore.getState().updateNodeMetadata(nodeId, {
          status: 'error',
          errorDetails: errorMessage(error),
        })
      } finally {
        if (controllersRef.current.get(nodeId) === controller) {
          controllersRef.current.delete(nodeId)
          syncRunningIds()
        }
      }
    },
    [syncRunningIds]
  )

  return { generateNode, cancelNode, isNodeRunning }
}
