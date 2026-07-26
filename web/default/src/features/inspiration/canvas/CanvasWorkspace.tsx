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
import { useQuery } from '@tanstack/react-query'
/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/
import {
  ImagePlus,
  Link2,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  Trash2,
  Type,
  Video,
  WandSparkles,
} from 'lucide-react'
import { nanoid } from 'nanoid'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  generateImages,
  getUserGroups,
  getUserModels,
  submitVideo,
} from '@/features/playground/api'
import { useVideoTaskResult } from '@/features/playground/hooks/use-video-task-result'
import { persistGeneratedMediaAsset } from '@/features/playground/lib/download-generated-media'
import { DEFAULT_STUDIO_SETTINGS } from '@/features/playground/lib/storage/store-migration'
import { isPlaygroundImageModel } from '@/features/playground/lib/studio/image-request-schema'
import { getModelModality } from '@/features/playground/lib/studio/model-modality'
import { FormNavigationGuard } from '@/features/system-settings/components/form-navigation-guard'

import {
  CanvasRevisionConflictError,
  useCanvasProject,
  useUpdateCanvasProject,
} from './api'
import { InfiniteCanvas } from './InfiniteCanvas'
import {
  CANVAS_SNAPSHOT_VERSION,
  type CanvasNode,
  type CanvasNodeKind,
  type CanvasSnapshotV1,
} from './types'

export function CanvasWorkspace(props: { projectId: string }) {
  const { t } = useTranslation()
  const project = useCanvasProject(props.projectId)
  const save = useUpdateCanvasProject(props.projectId)
  const mutateSave = save.mutate
  const [title, setTitle] = useState('')
  const [snapshot, setSnapshot] = useState<CanvasSnapshotV1 | null>(null)
  const revisionRef = useRef(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [connectFrom, setConnectFrom] = useState<string | null>(null)
  const hydratedRef = useRef(false)
  const [savedDocument, setSavedDocument] = useState('')
  const failedDocumentRef = useRef('')
  const [saveAttempt, setSaveAttempt] = useState(0)
  const [generatingNodeId, setGeneratingNodeId] = useState<string | null>(null)
  const [videoTask, setVideoTask] = useState<{
    nodeId: string
    taskId: string
  } | null>(null)
  const groups = useQuery({
    queryKey: ['inspiration', 'canvas', 'groups'],
    queryFn: getUserGroups,
  })
  const activeGroup =
    groups.data?.find((group) => group.value === 'default')?.value ??
    groups.data?.find((group) => group.value !== 'auto')?.value ??
    groups.data?.[0]?.value ??
    'default'
  const models = useQuery({
    queryKey: ['inspiration', 'canvas', 'models', activeGroup],
    queryFn: () => getUserModels(activeGroup),
  })
  const imageModels = (models.data ?? []).filter((model) =>
    isPlaygroundImageModel(model.value)
  )
  const videoModels = (models.data ?? []).filter(
    (model) => getModelModality({ model_name: model.value }) === 'video'
  )
  const videoResult = useVideoTaskResult(
    videoTask?.taskId,
    Boolean(videoTask?.taskId)
  )

  useEffect(() => {
    if (!project.data || hydratedRef.current) return
    setTitle(project.data.title)
    revisionRef.current = project.data.revision
    setSnapshot(project.data.snapshot)
    const pendingVideo = project.data.snapshot.nodes.find(
      (node) => node.kind === 'video' && node.taskId
    )
    if (pendingVideo?.taskId) {
      setGeneratingNodeId(pendingVideo.id)
      setVideoTask({ nodeId: pendingVideo.id, taskId: pendingVideo.taskId })
    }
    setSavedDocument(
      JSON.stringify({
        title: project.data.title,
        snapshot: project.data.snapshot,
      })
    )
    hydratedRef.current = true
  }, [project.data])

  useEffect(() => {
    if (!snapshot || !hydratedRef.current || save.isPending) return
    const document = JSON.stringify({ title, snapshot })
    if (document === savedDocument || document === failedDocumentRef.current) {
      return
    }
    const timer = window.setTimeout(() => {
      const expectedRevision = revisionRef.current
      mutateSave(
        {
          revision: expectedRevision,
          title,
          snapshot_version: CANVAS_SNAPSHOT_VERSION,
          snapshot,
        },
        {
          onSuccess: (updated) => {
            revisionRef.current = updated.revision
            setSavedDocument(document)
            failedDocumentRef.current = ''
          },
          onError: () => {
            failedDocumentRef.current = document
          },
        }
      )
    }, 800)
    return () => window.clearTimeout(timer)
  }, [mutateSave, save.isPending, saveAttempt, savedDocument, snapshot, title])

  useEffect(() => {
    if (!videoTask || (!videoResult.ready && !videoResult.failed)) return
    const task = videoTask
    setVideoTask(null)
    if (videoResult.failed) {
      setGeneratingNodeId(null)
      setSnapshot((current) =>
        current
          ? {
              ...current,
              nodes: current.nodes.map((node) =>
                node.id === task.nodeId ? { ...node, taskId: undefined } : node
              ),
            }
          : current
      )
      toast.error(videoResult.failReason || t('Something went wrong'))
      return
    }
    void persistGeneratedMediaAsset(
      videoResult.resultUrl,
      `canvas-video-${task.nodeId}`,
      'video'
    )
      .then((asset) => {
        setSnapshot((current) =>
          current
            ? {
                ...current,
                nodes: current.nodes.map((node) =>
                  node.id === task.nodeId
                    ? { ...node, content: asset.url, taskId: undefined }
                    : node
                ),
              }
            : current
        )
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error ? error.message : t('Something went wrong')
        )
      })
      .finally(() => setGeneratingNodeId(null))
  }, [
    t,
    videoResult.failed,
    videoResult.failReason,
    videoResult.ready,
    videoResult.resultUrl,
    videoTask,
  ])

  if (project.isPending) {
    return (
      <div
        className='grid h-full place-items-center'
        aria-label={t('Loading canvas')}
      >
        <Loader2 className='animate-spin' />
      </div>
    )
  }
  if (project.isError || !snapshot) {
    return (
      <div className='grid h-full place-items-center gap-3 text-center'>
        <p>{t('Could not load canvas project')}</p>
        <Button variant='outline' onClick={() => void project.refetch()}>
          {t('Try again')}
        </Button>
      </div>
    )
  }

  const document = JSON.stringify({ title, snapshot })
  const isDirty = document !== savedDocument
  let saveStatus = t('Saved')
  if (save.isPending) {
    saveStatus = t('Saving…')
  } else if (save.error instanceof CanvasRevisionConflictError) {
    saveStatus = t('This project changed elsewhere. Reload to continue safely.')
  } else if (save.isError) {
    saveStatus = t('Save failed')
  } else if (isDirty) {
    saveStatus = t('Unsaved changes')
  }

  const updateNode = (id: string, patch: Partial<CanvasNode>) =>
    setSnapshot((current) =>
      current
        ? {
            ...current,
            nodes: current.nodes.map((node) =>
              node.id === id ? { ...node, ...patch } : node
            ),
          }
        : current
    )
  const addNode = (kind: CanvasNodeKind) => {
    const labels = { text: t('New text'), image: '', video: '' }
    const node: CanvasNode = {
      id: nanoid(),
      kind,
      x: (120 - snapshot.viewport.x) / snapshot.viewport.k,
      y: (120 - snapshot.viewport.y) / snapshot.viewport.k,
      width: 280,
      height: kind === 'text' ? 160 : 280,
      content: labels[kind],
      model: kind === 'image' ? imageModels[0]?.value : undefined,
      group: kind === 'image' || kind === 'video' ? activeGroup : undefined,
    }
    if (kind === 'video') node.model = videoModels[0]?.value
    setSnapshot({ ...snapshot, nodes: [...snapshot.nodes, node] })
    setSelectedId(node.id)
  }
  const deleteSelected = () => {
    if (!selectedId) return
    if (snapshot.nodes.find((node) => node.id === selectedId)?.taskId) return
    setSnapshot({
      ...snapshot,
      nodes: snapshot.nodes.filter((node) => node.id !== selectedId),
      edges: snapshot.edges.filter(
        (edge) => edge.from !== selectedId && edge.to !== selectedId
      ),
    })
    setSelectedId(null)
    setConnectFrom(null)
  }
  const generateImageNode = async (node: CanvasNode) => {
    const incoming = snapshot.edges.find((edge) => edge.to === node.id)
    const promptNode = snapshot.nodes.find(
      (candidate) =>
        candidate.id === incoming?.from && candidate.kind === 'text'
    )
    if (!promptNode?.content.trim()) {
      toast.error(t('Connect a text node before generating.'))
      return
    }
    const model = imageModels.some((item) => item.value === node.model)
      ? (node.model as string)
      : imageModels[0]?.value
    const group = activeGroup
    if (!model) {
      toast.error(t('No compatible model is available'))
      return
    }
    setGeneratingNodeId(node.id)
    try {
      const generated = await generateImages({
        model,
        group,
        prompt: promptNode.content,
        settings: DEFAULT_STUDIO_SETTINGS,
      })
      if (!generated[0]?.url) throw new Error(t('Something went wrong'))
      const asset = await persistGeneratedMediaAsset(
        generated[0].url,
        `canvas-image-${node.id}`,
        'image'
      )
      updateNode(node.id, { content: asset.url, model, group })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('Something went wrong')
      )
    } finally {
      setGeneratingNodeId(null)
    }
  }
  const generateVideoNode = async (node: CanvasNode) => {
    const incoming = snapshot.edges.find((edge) => edge.to === node.id)
    const promptNode = snapshot.nodes.find(
      (candidate) =>
        candidate.id === incoming?.from && candidate.kind === 'text'
    )
    if (!promptNode?.content.trim()) {
      toast.error(t('Connect a text node before generating.'))
      return
    }
    const model = videoModels.some((item) => item.value === node.model)
      ? (node.model as string)
      : videoModels[0]?.value
    const group = activeGroup
    if (!model) {
      toast.error(t('No compatible model is available'))
      return
    }
    setGeneratingNodeId(node.id)
    try {
      const submission = await submitVideo({
        model,
        group,
        prompt: promptNode.content,
        settings: DEFAULT_STUDIO_SETTINGS,
      })
      if (!submission.taskId) throw new Error(t('Something went wrong'))
      updateNode(node.id, { model, group, taskId: submission.taskId })
      setVideoTask({ nodeId: node.id, taskId: submission.taskId })
    } catch (error) {
      setGeneratingNodeId(null)
      toast.error(
        error instanceof Error ? error.message : t('Something went wrong')
      )
    }
  }

  return (
    <main className='bg-background flex h-full min-h-0 flex-col'>
      <FormNavigationGuard when={isDirty} />
      <header className='border-border flex h-14 shrink-0 items-center gap-2 border-b px-3'>
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-label={t('Project title')}
          className='max-w-72 border-transparent font-semibold shadow-none'
        />
        <div className='ml-auto text-xs' role='status'>
          {saveStatus}
        </div>
        {save.error instanceof CanvasRevisionConflictError && (
          <Button size='sm' variant='outline' onClick={() => location.reload()}>
            {t('Reload')}
          </Button>
        )}
        {save.isError &&
          !(save.error instanceof CanvasRevisionConflictError) && (
            <Button
              size='sm'
              variant='outline'
              onClick={() => {
                failedDocumentRef.current = ''
                setSaveAttempt((attempt) => attempt + 1)
              }}
            >
              {t('Retry')}
            </Button>
          )}
      </header>
      <div className='relative min-h-0 flex-1'>
        <InfiniteCanvas
          viewport={snapshot.viewport}
          onViewportChange={(viewport) =>
            setSnapshot({ ...snapshot, viewport })
          }
          onDeselect={() => setSelectedId(null)}
        >
          <svg className='pointer-events-none absolute overflow-visible'>
            {snapshot.edges.map((edge) => {
              const from = snapshot.nodes.find((node) => node.id === edge.from)
              const to = snapshot.nodes.find((node) => node.id === edge.to)
              if (!from || !to) return null
              return (
                <line
                  key={edge.id}
                  x1={from.x + from.width / 2}
                  y1={from.y + from.height / 2}
                  x2={to.x + to.width / 2}
                  y2={to.y + to.height / 2}
                  className='stroke-primary'
                  strokeWidth='2'
                />
              )
            })}
          </svg>
          {snapshot.nodes.map((node) => (
            <CanvasNodeCard
              key={node.id}
              node={node}
              viewportScale={snapshot.viewport.k}
              models={
                node.kind === 'video'
                  ? videoModels.map((model) => model.value)
                  : imageModels.map((model) => model.value)
              }
              generating={generatingNodeId === node.id}
              generationLocked={
                generatingNodeId !== null || Boolean(node.taskId)
              }
              selected={selectedId === node.id}
              onChange={(patch) =>
                updateNode(
                  node.id,
                  patch.model ? { ...patch, group: activeGroup } : patch
                )
              }
              onGenerate={() =>
                node.kind === 'video'
                  ? generateVideoNode(node)
                  : generateImageNode(node)
              }
              onSelect={() => {
                setSelectedId(node.id)
                if (connectFrom && connectFrom !== node.id) {
                  setSnapshot({
                    ...snapshot,
                    edges: [
                      ...snapshot.edges,
                      { id: nanoid(), from: connectFrom, to: node.id },
                    ],
                  })
                  setConnectFrom(null)
                }
              }}
            />
          ))}
        </InfiniteCanvas>
        <div className='bg-card border-border absolute top-3 left-3 flex gap-1 rounded-lg border p-1 shadow-sm'>
          <Button
            size='icon-sm'
            variant='ghost'
            aria-label={t('Add text')}
            onClick={() => addNode('text')}
          >
            <Type />
          </Button>
          <Button
            size='icon-sm'
            variant='ghost'
            aria-label={t('Add image')}
            onClick={() => addNode('image')}
          >
            <ImagePlus />
          </Button>
          <Button
            size='icon-sm'
            variant='ghost'
            aria-label={t('Add video')}
            onClick={() => addNode('video')}
          >
            <Video />
          </Button>
          <Button
            size='icon-sm'
            variant={connectFrom ? 'default' : 'ghost'}
            disabled={!selectedId}
            aria-label={t('Connect node')}
            onClick={() => setConnectFrom(selectedId)}
          >
            <Link2 />
          </Button>
          <Button
            size='icon-sm'
            variant='ghost'
            disabled={
              !selectedId ||
              Boolean(
                snapshot.nodes.find((node) => node.id === selectedId)?.taskId
              )
            }
            aria-label={t('Delete node')}
            onClick={deleteSelected}
          >
            <Trash2 />
          </Button>
        </div>
        <div className='bg-card border-border absolute right-3 bottom-3 flex items-center gap-1 rounded-lg border p-1 shadow-sm'>
          <Button
            size='icon-sm'
            variant='ghost'
            aria-label={t('Zoom out')}
            onClick={() =>
              setSnapshot({
                ...snapshot,
                viewport: {
                  ...snapshot.viewport,
                  k: Math.max(0.1, snapshot.viewport.k - 0.1),
                },
              })
            }
          >
            <Minus />
          </Button>
          <span className='w-12 text-center text-xs tabular-nums'>
            {Math.round(snapshot.viewport.k * 100)}%
          </span>
          <Button
            size='icon-sm'
            variant='ghost'
            aria-label={t('Zoom in')}
            onClick={() =>
              setSnapshot({
                ...snapshot,
                viewport: {
                  ...snapshot.viewport,
                  k: Math.min(2.5, snapshot.viewport.k + 0.1),
                },
              })
            }
          >
            <Plus />
          </Button>
          <Button
            size='icon-sm'
            variant='ghost'
            aria-label={t('Reset view')}
            onClick={() =>
              setSnapshot({ ...snapshot, viewport: { x: 80, y: 80, k: 1 } })
            }
          >
            <RotateCcw />
          </Button>
        </div>
      </div>
    </main>
  )
}

function CanvasNodeCard(props: {
  node: CanvasNode
  viewportScale: number
  models: string[]
  generating: boolean
  generationLocked: boolean
  selected: boolean
  onSelect: () => void
  onChange: (patch: Partial<CanvasNode>) => void
  onGenerate: () => Promise<void>
}) {
  const { t } = useTranslation()
  const nodeLabels: Record<CanvasNodeKind, string> = {
    text: t('Text'),
    image: t('Image'),
    video: t('Video'),
  }
  const dragRef = useRef<{
    x: number
    y: number
    nodeX: number
    nodeY: number
  } | null>(null)
  return (
    <article
      data-node-id={props.node.id}
      className={`bg-card absolute overflow-hidden rounded-xl border shadow-md ${props.selected ? 'border-primary ring-primary/20 ring-4' : 'border-border'}`}
      style={{
        transform: `translate(${props.node.x}px, ${props.node.y}px)`,
        width: props.node.width,
        height: props.node.height,
      }}
      onPointerDown={(event) => {
        props.onSelect()
        if ((event.target as Element).closest('[data-canvas-no-zoom]')) return
        event.currentTarget.setPointerCapture(event.pointerId)
        dragRef.current = {
          x: event.clientX,
          y: event.clientY,
          nodeX: props.node.x,
          nodeY: props.node.y,
        }
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current
        if (drag) {
          props.onChange({
            x: drag.nodeX + (event.clientX - drag.x) / props.viewportScale,
            y: drag.nodeY + (event.clientY - drag.y) / props.viewportScale,
          })
        }
      }}
      onPointerUp={() => (dragRef.current = null)}
    >
      <div className='bg-muted/70 border-border border-b px-3 py-2 text-xs font-medium'>
        {nodeLabels[props.node.kind]}
      </div>
      {props.node.kind === 'text' ? (
        <textarea
          data-canvas-no-zoom
          value={props.node.content}
          onChange={(event) => props.onChange({ content: event.target.value })}
          aria-label={t('Text content')}
          className='h-[calc(100%-33px)] w-full resize-none bg-transparent p-3 text-sm outline-none'
        />
      ) : (
        <div className='flex h-[calc(100%-33px)] flex-col gap-2 p-3'>
          <Input
            data-canvas-no-zoom
            value={props.node.content}
            onChange={(event) =>
              props.onChange({ content: event.target.value })
            }
            placeholder={t('Media URL')}
            aria-label={t('Media URL')}
          />
          {(props.node.kind === 'image' || props.node.kind === 'video') && (
            <div className='flex gap-2' data-canvas-no-zoom>
              <select
                value={props.node.model ?? props.models[0] ?? ''}
                onChange={(event) =>
                  props.onChange({ model: event.target.value })
                }
                aria-label={t('Model')}
                className='border-input bg-background min-w-0 flex-1 rounded-md border px-2 text-xs'
              >
                {props.models.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
              <Button
                size='sm'
                disabled={props.generationLocked || props.models.length === 0}
                onClick={() => void props.onGenerate()}
              >
                {props.generating ? (
                  <Loader2 className='animate-spin' />
                ) : (
                  <WandSparkles />
                )}
                {t('Generate')}
              </Button>
            </div>
          )}
          {props.node.content &&
            (props.node.kind === 'image' ? (
              <img
                src={props.node.content}
                alt=''
                className='min-h-0 flex-1 rounded object-contain'
              />
            ) : (
              <video
                src={props.node.content}
                controls
                data-canvas-no-zoom
                className='min-h-0 flex-1 rounded'
              />
            ))}
        </div>
      )}
    </article>
  )
}
