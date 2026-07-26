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
import { Film, Loader2, Play, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePlaygroundStore } from '@/stores/playground-store'

import {
  STORYBOARD_FOOTER_HEIGHT,
  STORYBOARD_HEADER_HEIGHT,
  STORYBOARD_ROW_HEIGHT,
  storyboardTableHeight,
} from '../../constants'
import { createStoryboardRow } from '../../engine/canvas-domain'
import { requestStoryboardShots } from '../../engine/canvas-storyboard-ai'
import { useCanvasTheme } from '../../engine/canvas-theme'
import { useCanvasGeneration } from '../../hooks/use-canvas-generation'
import { useWorkbenchModels } from '../../hooks/use-workbench-models'
import { useCanvasStore } from '../../store/canvas-store'
import { CanvasNodeType, type StoryboardRow } from '../../types'
import { NodeModelSelect, type CanvasNodeBodyProps } from './node-shared'

function readStoryboardRows(nodeId: string): StoryboardRow[] {
  return (
    useCanvasStore.getState().nodes.find((node) => node.id === nodeId)?.metadata
      ?.storyboard?.rows ?? []
  )
}

export function StoryboardNodeBody(props: CanvasNodeBodyProps) {
  const { t } = useTranslation()
  const theme = useCanvasTheme()
  const models = useWorkbenchModels()
  const { generateNode } = useCanvasGeneration()
  const [isGeneratingAll, setIsGeneratingAll] = useState(false)
  const [isDrafting, setIsDrafting] = useState(false)
  const [ideaOpen, setIdeaOpen] = useState(false)
  const [idea, setIdea] = useState('')
  const [shotCount, setShotCount] = useState(6)

  const metadata = props.node.metadata ?? {}
  const rows = metadata.storyboard?.rows ?? []
  const tableHeight = storyboardTableHeight(props.node.height)
  const anyRowLoading =
    isGeneratingAll ||
    isDrafting ||
    rows.some((row) => row.status === 'loading')

  const patchRow = useCallback(
    (rowId: string, patch: Partial<StoryboardRow>) => {
      useCanvasStore.getState().updateStoryboardRow(props.node.id, rowId, patch)
    },
    [props.node.id]
  )

  const addShot = useCallback(() => {
    const current = readStoryboardRows(props.node.id)
    useCanvasStore
      .getState()
      .setStoryboardRows(props.node.id, [
        ...current,
        createStoryboardRow(current.length + 1),
      ])
  }, [props.node.id])

  const deleteRow = useCallback(
    (rowId: string) => {
      const current = readStoryboardRows(props.node.id)
      const next = current
        .filter((row) => row.id !== rowId)
        .map((row, index) => ({ ...row, shotNumber: index + 1 }))
      useCanvasStore.getState().setStoryboardRows(props.node.id, next)
    },
    [props.node.id]
  )

  const generateRowImage = useCallback(
    async (row: StoryboardRow, index: number) => {
      const store = useCanvasStore.getState()
      const node = store.nodes.find((item) => item.id === props.node.id)
      if (!node) return

      const latestRow =
        node.metadata?.storyboard?.rows.find((item) => item.id === row.id) ??
        row
      if (!latestRow.imageGenerationPrompt.trim()) return

      store.updateStoryboardRow(node.id, latestRow.id, {
        status: 'loading',
        errorDetails: undefined,
      })

      try {
        let imageNodeId = latestRow.imageNodeId
        if (imageNodeId) {
          const existing = store.nodes.find((item) => item.id === imageNodeId)
          if (!existing) {
            imageNodeId = undefined
          } else {
            store.updateNodeMetadata(imageNodeId, {
              prompt: latestRow.imageGenerationPrompt,
              model: node.metadata?.model,
            })
          }
        }

        if (!imageNodeId) {
          const imageNode = store.addNode(
            CanvasNodeType.Image,
            {
              x: node.position.x + node.width + 320,
              y: node.position.y + index * (STORYBOARD_ROW_HEIGHT + 260),
            },
            {
              prompt: latestRow.imageGenerationPrompt,
              model: node.metadata?.model,
            }
          )
          imageNodeId = imageNode.id
          store.connectNodes(node.id, imageNode.id, {
            firstHandleType: 'source',
            fromHandleId: `row:${latestRow.id}`,
          })
          store.updateStoryboardRow(node.id, latestRow.id, {
            imageNodeId: imageNode.id,
          })
        }

        await generateNode(imageNodeId)

        const imageNode = useCanvasStore
          .getState()
          .nodes.find((item) => item.id === imageNodeId)
        if (imageNode?.metadata?.status === 'error') {
          store.updateStoryboardRow(node.id, latestRow.id, {
            status: 'error',
            errorDetails:
              imageNode.metadata.errorDetails || t('Generation failed'),
          })
          return
        }

        store.updateStoryboardRow(node.id, latestRow.id, {
          status: 'idle',
          errorDetails: undefined,
        })
      } catch (error) {
        store.updateStoryboardRow(node.id, latestRow.id, {
          status: 'error',
          errorDetails:
            error instanceof Error && error.message
              ? error.message
              : t('Generation failed'),
        })
      }
    },
    [generateNode, props.node.id, t]
  )

  const generateRowVideo = useCallback(
    async (row: StoryboardRow) => {
      const store = useCanvasStore.getState()
      const node = store.nodes.find((item) => item.id === props.node.id)
      if (!node) return

      const latestRow =
        node.metadata?.storyboard?.rows.find((item) => item.id === row.id) ??
        row
      const imageNode = latestRow.imageNodeId
        ? store.nodes.find((item) => item.id === latestRow.imageNodeId)
        : undefined
      if (!imageNode?.metadata?.content) {
        toast.error(t('Generate the shot image first'))
        return
      }

      const motion =
        latestRow.videoMotionPrompt.trim() ||
        latestRow.imageGenerationPrompt.trim()
      const prompt = latestRow.negativePrompt.trim()
        ? `${motion}\nNegative: ${latestRow.negativePrompt.trim()}`
        : motion
      const seconds = latestRow.durationSeconds
        ? String(latestRow.durationSeconds)
        : undefined

      store.updateStoryboardRow(node.id, latestRow.id, {
        status: 'loading',
        errorDetails: undefined,
      })

      try {
        let videoNodeId = latestRow.videoNodeId
        if (
          videoNodeId &&
          !store.nodes.some((item) => item.id === videoNodeId)
        ) {
          videoNodeId = undefined
        }

        if (videoNodeId) {
          store.updateNodeMetadata(videoNodeId, {
            prompt,
            seconds,
            model: node.metadata?.videoModel,
          })
        } else {
          const videoNode = store.addNode(
            CanvasNodeType.Video,
            {
              x: imageNode.position.x + imageNode.width + 240,
              y: imageNode.position.y,
            },
            { prompt, seconds, model: node.metadata?.videoModel }
          )
          videoNodeId = videoNode.id
          store.connectNodes(imageNode.id, videoNode.id, {
            firstHandleType: 'source',
          })
          store.updateStoryboardRow(node.id, latestRow.id, {
            videoNodeId: videoNode.id,
          })
        }

        await generateNode(videoNodeId)

        const generated = useCanvasStore
          .getState()
          .nodes.find((item) => item.id === videoNodeId)
        if (generated?.metadata?.status === 'error') {
          store.updateStoryboardRow(node.id, latestRow.id, {
            status: 'error',
            errorDetails:
              generated.metadata.errorDetails || t('Generation failed'),
          })
          return
        }

        store.updateStoryboardRow(node.id, latestRow.id, {
          status: 'idle',
          errorDetails: undefined,
        })
      } catch (error) {
        store.updateStoryboardRow(node.id, latestRow.id, {
          status: 'error',
          errorDetails:
            error instanceof Error && error.message
              ? error.message
              : t('Generation failed'),
        })
      }
    },
    [generateNode, props.node.id, t]
  )

  const generateAllVideos = useCallback(async () => {
    if (isGeneratingAll) return
    setIsGeneratingAll(true)
    try {
      const current = readStoryboardRows(props.node.id)
      for (const row of current) {
        await generateRowVideo(row)
      }
    } finally {
      setIsGeneratingAll(false)
    }
  }, [generateRowVideo, isGeneratingAll, props.node.id])

  const draftShotsWithAi = useCallback(async () => {
    const trimmedIdea = idea.trim()
    if (!trimmedIdea || isDrafting) return
    const chatModel = models.byModality('chat')[0]?.value
    if (!chatModel) {
      toast.error(t('No chat model is available'))
      return
    }
    setIsDrafting(true)
    try {
      const shots = await requestStoryboardShots({
        model: chatModel,
        group: usePlaygroundStore.getState().config.group,
        idea: trimmedIdea,
        shotCount,
      })
      if (!shots.length) {
        toast.error(t('The model did not return any shots'))
        return
      }
      const current = readStoryboardRows(props.node.id)
      const appended = shots.map((shot, index) => ({
        ...createStoryboardRow(current.length + index + 1),
        plotDescription: shot.plotDescription,
        imageGenerationPrompt: shot.imageGenerationPrompt,
        videoMotionPrompt: shot.videoMotionPrompt,
        durationSeconds: shot.durationSeconds,
      }))
      useCanvasStore
        .getState()
        .setStoryboardRows(props.node.id, [...current, ...appended])
      setIdeaOpen(false)
      setIdea('')
      toast.success(t('Added {{count}} shots', { count: appended.length }))
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t('Generation failed')
      )
    } finally {
      setIsDrafting(false)
    }
  }, [idea, isDrafting, models, props.node.id, shotCount, t])

  const generateAllShots = useCallback(async () => {
    if (isGeneratingAll) return
    setIsGeneratingAll(true)
    try {
      const current = readStoryboardRows(props.node.id)
      for (let index = 0; index < current.length; index += 1) {
        const row = current[index]
        if (!row.imageGenerationPrompt.trim()) continue
        await generateRowImage(row, index)
      }
    } finally {
      setIsGeneratingAll(false)
    }
  }, [generateRowImage, isGeneratingAll, props.node.id])

  return (
    <div className='flex h-full min-h-0 flex-col' data-canvas-no-zoom>
      <div
        className='flex shrink-0 flex-col gap-2 border-b px-1 pb-2'
        style={{
          minHeight: STORYBOARD_HEADER_HEIGHT,
          borderColor: theme.node.stroke,
        }}
      >
        <label className='flex flex-col gap-1 text-xs'>
          <span style={{ color: theme.node.muted }}>
            {t('Storyboard title')}
          </span>
          <Input
            value={metadata.workflowTitle ?? ''}
            placeholder={t('Storyboard title')}
            className='h-7 text-xs'
            onPointerDown={(event) => event.stopPropagation()}
            onChange={(event) =>
              props.onMetadataChange({ workflowTitle: event.target.value })
            }
          />
        </label>
        <div className='flex items-center gap-2'>
          <span
            className='shrink-0 text-xs'
            style={{ color: theme.node.muted }}
          >
            {t('Image model')}
          </span>
          <NodeModelSelect
            value={metadata.model}
            options={models.byModality('image')}
            onChange={(model) => props.onMetadataChange({ model })}
          />
        </div>
        <div className='flex items-center gap-2'>
          <span
            className='shrink-0 text-xs'
            style={{ color: theme.node.muted }}
          >
            {t('Video model')}
          </span>
          <NodeModelSelect
            value={metadata.videoModel}
            options={models.byModality('video')}
            onChange={(videoModel) => props.onMetadataChange({ videoModel })}
          />
        </div>
        <div className='flex items-center gap-2'>
          <Button
            size='sm'
            variant='outline'
            className='h-7 gap-1 px-2 text-xs'
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setIdeaOpen((open) => !open)}
          >
            <Sparkles className='size-3.5' />
            {t('Draft shots with AI')}
          </Button>
        </div>
        {ideaOpen ? (
          <div className='flex items-center gap-2'>
            <Input
              value={idea}
              placeholder={t('Describe the story idea')}
              className='h-7 min-w-0 flex-1 text-xs'
              onPointerDown={(event) => event.stopPropagation()}
              onChange={(event) => setIdea(event.target.value)}
            />
            <Input
              type='number'
              min={1}
              max={20}
              value={shotCount}
              className='h-7 w-14 shrink-0 text-xs'
              onPointerDown={(event) => event.stopPropagation()}
              onChange={(event) => {
                const next = Number(event.target.value)
                setShotCount(
                  Number.isFinite(next) ? Math.min(20, Math.max(1, next)) : 6
                )
              }}
            />
            <Button
              size='sm'
              className='h-7 gap-1 px-2 text-xs'
              disabled={isDrafting || !idea.trim()}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => {
                void draftShotsWithAi()
              }}
            >
              {isDrafting ? (
                <Loader2 className='size-3.5 animate-spin' />
              ) : (
                <Sparkles className='size-3.5' />
              )}
              {t('Generate')}
            </Button>
          </div>
        ) : null}
      </div>

      <div
        className='min-h-0 flex-1 overflow-auto'
        style={{ height: tableHeight }}
        data-canvas-wheel-scroll
        data-canvas-no-zoom
      >
        {rows.length === 0 ? (
          <div
            className='flex h-full min-h-[96px] flex-col items-center justify-center gap-3 px-3 text-center text-xs'
            style={{ color: theme.node.placeholder }}
          >
            <span>{t('Add your first shot to start the storyboard')}</span>
            <Button
              size='sm'
              className='h-7 gap-1 px-2 text-xs'
              onPointerDown={(event) => event.stopPropagation()}
              onClick={addShot}
            >
              <Plus className='size-3.5' />
              {t('Add shot')}
            </Button>
          </div>
        ) : (
          <div className='flex flex-col'>
            {rows.map((row, index) => (
              <div
                key={row.id}
                className='relative flex items-center gap-1 border-b px-1'
                style={{
                  height: STORYBOARD_ROW_HEIGHT,
                  borderColor: theme.node.stroke,
                }}
              >
                <span
                  className='w-8 shrink-0 text-center text-[11px] font-medium'
                  style={{ color: theme.node.muted }}
                >
                  #{row.shotNumber}
                </span>
                <Input
                  value={row.plotDescription}
                  placeholder={t('Plot')}
                  className='h-7 min-w-0 flex-1 text-xs'
                  onPointerDown={(event) => event.stopPropagation()}
                  onChange={(event) =>
                    patchRow(row.id, { plotDescription: event.target.value })
                  }
                />
                <Input
                  value={row.imageGenerationPrompt}
                  placeholder={t('Image prompt')}
                  className='h-7 min-w-0 flex-[1.2] text-xs'
                  onPointerDown={(event) => event.stopPropagation()}
                  onChange={(event) =>
                    patchRow(row.id, {
                      imageGenerationPrompt: event.target.value,
                    })
                  }
                />
                <Input
                  value={row.videoMotionPrompt}
                  placeholder={t('Video motion')}
                  className='h-7 min-w-0 flex-1 text-xs'
                  onPointerDown={(event) => event.stopPropagation()}
                  onChange={(event) =>
                    patchRow(row.id, {
                      videoMotionPrompt: event.target.value,
                    })
                  }
                />
                <Input
                  type='number'
                  min={0}
                  step={0.5}
                  value={row.durationSeconds}
                  className='h-7 w-14 shrink-0 text-xs'
                  onPointerDown={(event) => event.stopPropagation()}
                  onChange={(event) => {
                    const next = Number(event.target.value)
                    patchRow(row.id, {
                      durationSeconds: Number.isFinite(next) ? next : 0,
                    })
                  }}
                />
                <div className='flex w-28 shrink-0 items-center justify-end gap-1'>
                  {row.status === 'loading' ? (
                    <Loader2
                      className='size-3.5 animate-spin'
                      style={{ color: theme.accent.primary }}
                    />
                  ) : null}
                  {row.status === 'error' ? (
                    <span
                      className='max-w-[52px] truncate text-[10px]'
                      style={{ color: theme.accent.danger }}
                      title={row.errorDetails}
                    >
                      {row.errorDetails || t('Generation failed')}
                    </span>
                  ) : null}
                  <Button
                    size='sm'
                    variant='ghost'
                    className='size-7 p-0'
                    disabled={row.status === 'loading' || anyRowLoading}
                    title={t('Generate')}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => {
                      void generateRowImage(row, index)
                    }}
                  >
                    <Play className='size-3.5' />
                  </Button>
                  <Button
                    size='sm'
                    variant='ghost'
                    className='size-7 p-0'
                    disabled={row.status === 'loading' || anyRowLoading}
                    title={t('Generate video')}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => {
                      void generateRowVideo(row)
                    }}
                  >
                    <Film className='size-3.5' />
                  </Button>
                  <Button
                    size='sm'
                    variant='ghost'
                    className='size-7 p-0'
                    disabled={row.status === 'loading'}
                    title={t('Delete shot')}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => deleteRow(row.id)}
                  >
                    <Trash2 className='size-3.5' />
                  </Button>
                </div>
                <span
                  data-handle-id={`row:${row.id}`}
                  data-handle-type='source'
                  className='absolute top-1/2 right-0 size-2.5 translate-x-1/2 -translate-y-1/2 rounded-full border'
                  style={{
                    background: theme.accent.primary,
                    borderColor: theme.node.fill,
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {rows.length > 0 ? (
        <div
          className='flex shrink-0 items-center gap-2 border-t px-1 pt-2'
          style={{
            minHeight: STORYBOARD_FOOTER_HEIGHT,
            borderColor: theme.node.stroke,
          }}
        >
          <Button
            size='sm'
            variant='outline'
            className='h-7 gap-1 px-2 text-xs'
            onPointerDown={(event) => event.stopPropagation()}
            onClick={addShot}
          >
            <Plus className='size-3.5' />
            {t('Add shot')}
          </Button>
          <Button
            size='sm'
            className='ml-auto h-7 gap-1 px-2 text-xs'
            disabled={anyRowLoading}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => {
              void generateAllShots()
            }}
          >
            {isGeneratingAll ? (
              <Loader2 className='size-3.5 animate-spin' />
            ) : (
              <Play className='size-3.5' />
            )}
            {t('Generate all shots')}
          </Button>
          <Button
            size='sm'
            variant='outline'
            className='h-7 gap-1 px-2 text-xs'
            disabled={anyRowLoading}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => {
              void generateAllVideos()
            }}
          >
            <Film className='size-3.5' />
            {t('Generate all videos')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
