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
import {
  Download,
  FileText,
  Globe,
  ImageIcon,
  Sparkles,
  Video,
  type LucideIcon,
} from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import {
  CodeBlock,
  CodeBlockCopyButton,
} from '@/components/ai-elements/code-block'
import { Loader } from '@/components/ai-elements/loader'
import { MessageContent } from '@/components/ai-elements/message'
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning'
import { Response } from '@/components/ai-elements/response'
import { Shimmer } from '@/components/ai-elements/shimmer'
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from '@/components/ai-elements/sources'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { MESSAGE_STATUS } from '../../constants'
import { useVideoTaskResult } from '../../hooks/use-video-task-result'
import {
  getMessageAlignmentClass,
  getMessageContentState,
  isErrorMessage,
  type MessageAlignment,
} from '../../lib'
import { attachmentPreviewSrc } from '../../lib/attachments/attachment-utils'
import { downloadGeneratedMedia } from '../../lib/download-generated-media'
import { getMessageContentStyles } from '../../lib/message/message-styles'
import type { Message } from '../../types'
import { MediaLightbox, type LightboxItem } from '../media/media-lightbox'
import {
  ImagePlaceholder,
  VideoPlaceholder,
} from '../workspace/generation-progress'
import { MessageError } from './message-error'
import { MessageMetadata } from './message-metadata'

const MANAGED_TOOL_META: Record<
  string,
  { titleKey: string; Icon: LucideIcon; tile: string }
> = {
  generate_image: {
    titleKey: 'Image generation',
    Icon: ImageIcon,
    tile: 'bg-chart-3/15 text-chart-3',
  },
  generate_video: {
    titleKey: 'Video generation',
    Icon: Video,
    tile: 'bg-warning/15 text-warning',
  },
  web_search: {
    titleKey: 'Web search',
    Icon: Globe,
    tile: 'bg-info/15 text-info',
  },
}

const DEFAULT_TOOL_META = {
  titleKey: 'Platform tool',
  Icon: Sparkles,
  tile: 'bg-primary/15 text-primary',
}

type PlaygroundMessageContentProps = {
  actions: ReactNode
  alignment: MessageAlignment
  errorActions?: ReactNode
  isSourceVisible?: boolean
  message: Message
  versionContent: string
}

export function PlaygroundMessageContent({
  actions,
  alignment,
  errorActions,
  isSourceVisible = false,
  message,
  versionContent,
}: PlaygroundMessageContentProps) {
  const { t } = useTranslation()
  const {
    displayContent,
    hasReasoning,
    hasSources,
    reasoningContent,
    showLoader,
    showMessageContent,
    sources,
  } = getMessageContentState(message, versionContent)
  const isError = isErrorMessage(message)
  const isMessageFinal =
    message.status !== MESSAGE_STATUS.LOADING &&
    message.status !== MESSAGE_STATUS.STREAMING
  const videoResult = useVideoTaskResult(
    message.managedTool?.taskId,
    message.managedTool?.action === 'generate_video',
    message.managedTool?.runId
  )
  const toolVideoUrl = videoResult.resultUrl || message.managedTool?.videoUrl
  const toolStatus =
    message.managedTool?.action === 'generate_video' && videoResult.status
      ? videoResult.status.toLowerCase()
      : message.managedTool?.status
  const toolError =
    message.managedTool?.action === 'generate_video' && videoResult.failed
      ? videoResult.failReason
      : message.managedTool?.error

  const shouldReduce = useReducedMotion()
  const [lightbox, setLightbox] = useState<{
    items: LightboxItem[]
    index: number
  } | null>(null)
  const toolMeta = message.managedTool
    ? (MANAGED_TOOL_META[message.managedTool.action] ?? DEFAULT_TOOL_META)
    : DEFAULT_TOOL_META
  const ToolIcon = toolMeta.Icon
  const isToolFailed =
    Boolean(toolError) ||
    toolStatus === 'failed' ||
    toolStatus === 'unavailable'
  const isToolDone =
    !isToolFailed &&
    (toolStatus === 'completed' ||
      toolStatus === 'success' ||
      Boolean(message.managedTool?.images?.length) ||
      Boolean(toolVideoUrl))
  const isToolRunning =
    Boolean(message.managedTool) && !isToolFailed && !isToolDone

  return (
    <div
      className={cn(
        'flex w-full min-w-0 flex-col',
        getMessageAlignmentClass(alignment)
      )}
    >
      {message.attachments && message.attachments.length > 0 && (
        <div className='mb-2 flex flex-wrap gap-2'>
          {message.attachments.map((attachment, index) =>
            attachmentPreviewSrc(attachment) ? (
              <button
                key={attachment.id}
                type='button'
                className='focus-visible:ring-ring cursor-zoom-in rounded-lg outline-none focus-visible:ring-2'
                aria-label={t('Attachment {{index}}', { index: index + 1 })}
                onClick={() => {
                  const items = (message.attachments ?? [])
                    .map((item) => attachmentPreviewSrc(item))
                    .filter((src): src is string => Boolean(src))
                    .map((src) => ({ url: src }))
                  const src = attachmentPreviewSrc(attachment)
                  setLightbox({
                    items,
                    index: Math.max(
                      0,
                      items.findIndex((item) => item.url === src)
                    ),
                  })
                }}
              >
                <img
                  src={attachmentPreviewSrc(attachment)}
                  alt={t('Attachment {{index}}', { index: index + 1 })}
                  className='border-border size-24 rounded-lg border object-cover'
                />
              </button>
            ) : (
              <div
                key={attachment.id}
                className='border-border bg-muted flex max-w-64 items-center gap-2 rounded-lg border px-3 py-2'
              >
                <FileText className='text-muted-foreground size-5 shrink-0' />
                <span className='truncate text-sm' title={attachment.name}>
                  {attachment.name}
                </span>
              </div>
            )
          )}
        </div>
      )}

      {hasSources && (
        <Sources>
          <SourcesTrigger count={sources.length} />
          <SourcesContent>
            {sources.map((source) => (
              <Source
                href={source.href}
                key={`${source.href}-${source.title}`}
                title={source.title}
              />
            ))}
          </SourcesContent>
        </Sources>
      )}

      {message.managedTool && (
        <section className='border-border from-muted/40 to-muted/15 mb-2 rounded-xl border bg-gradient-to-br p-3'>
          <div className='flex flex-wrap items-center justify-between gap-2 text-sm'>
            <span className='flex min-w-0 items-center gap-2'>
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-lg',
                  toolMeta.tile
                )}
              >
                <ToolIcon className='size-3.5' aria-hidden='true' />
              </span>
              <span className='truncate font-medium'>
                {t(toolMeta.titleKey)}
              </span>
            </span>
            <span
              className={cn(
                'flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs',
                isToolFailed && 'bg-destructive/10 text-destructive',
                isToolDone && 'bg-success/10 text-success',
                isToolRunning && 'bg-primary/10 text-primary'
              )}
            >
              {isToolRunning && (
                <span
                  className={cn(
                    'bg-primary size-1.5 rounded-full',
                    !shouldReduce && 'animate-pulse'
                  )}
                  aria-hidden='true'
                />
              )}
              {t(toolStatus || message.managedTool.status)}
            </span>
          </div>
          {toolError && (
            <p className='text-destructive mt-2 text-sm'>{toolError}</p>
          )}
          {isToolRunning && message.managedTool.action === 'generate_image' && (
            <div className='mt-3'>
              <ImagePlaceholder
                delayMs={0}
                reduceMotion={Boolean(shouldReduce)}
                aspectCss='4 / 3'
                sizeLabel={null}
              />
            </div>
          )}
          {isToolRunning && message.managedTool.action === 'generate_video' && (
            <div className='mt-3'>
              <VideoPlaceholder reduceMotion={Boolean(shouldReduce)} />
            </div>
          )}
          {isToolRunning && message.managedTool.action === 'web_search' && (
            <div className='mt-3 space-y-1.5' aria-hidden='true'>
              <div className='skeleton-shimmer h-3 w-4/5 rounded-full' />
              <div className='skeleton-shimmer h-3 w-3/5 rounded-full' />
              <div className='skeleton-shimmer h-3 w-2/3 rounded-full' />
            </div>
          )}
          {message.managedTool.images && (
            <div
              className={cn(
                'mt-3 grid gap-2',
                message.managedTool.images.length > 1
                  ? 'sm:grid-cols-2'
                  : 'max-w-md'
              )}
            >
              {message.managedTool.images.map((url, index) => (
                <ManagedToolImage
                  key={url}
                  url={url}
                  index={index}
                  alt={t('Generated image')}
                  downloadLabel={t('Download')}
                  onOpen={() => {
                    const items = (message.managedTool?.images ?? []).map(
                      (imageUrl, imageIndex) => ({
                        url: imageUrl,
                        alt: t('Generated image'),
                        downloadName: `image-${imageIndex + 1}`,
                      })
                    )
                    setLightbox({ items, index })
                  }}
                />
              ))}
            </div>
          )}
          {toolVideoUrl && (
            <div className='generation-result-enter border-border/70 bg-muted/30 group relative mt-3 overflow-hidden rounded-xl border'>
              <video src={toolVideoUrl} controls className='w-full' />
              <Button
                size='icon-sm'
                variant='secondary'
                className='bg-background/85 absolute top-2 right-2 shadow-sm backdrop-blur-sm'
                aria-label={t('Download')}
                onClick={() =>
                  void downloadGeneratedMedia(toolVideoUrl, 'video', 'video')
                }
              >
                <Download aria-hidden='true' />
              </Button>
            </div>
          )}
        </section>
      )}

      {hasReasoning && (
        <Reasoning
          defaultOpen
          duration={message.reasoning?.duration}
          isStreaming={message.isReasoningStreaming}
        >
          <ReasoningTrigger />
          <ReasoningContent>{reasoningContent}</ReasoningContent>
        </Reasoning>
      )}

      {showLoader && (
        <div className='flex items-center gap-2 py-2'>
          <Loader />
          <Shimmer className='text-sm' duration={1}>
            {t('Responding...')}
          </Shimmer>
        </div>
      )}

      {isError && (
        <>
          <MessageError message={message} className='mb-2' />
          <MessageMetadata alignment={alignment} message={message} />
          {errorActions}
        </>
      )}

      {!isError && showMessageContent && (
        <>
          {isSourceVisible ? (
            <CodeBlock
              code={versionContent}
              className='my-0 group-[.is-assistant]:w-full group-[.is-assistant]:max-w-[78ch]'
              collapsedLines={24}
              defaultCollapsed={false}
              language='markdown'
              maxExpandedLines={48}
              showLineNumbers
              showToolbar
              title={t('Raw response')}
            >
              <CodeBlockCopyButton />
            </CodeBlock>
          ) : (
            <MessageContent
              variant='flat'
              className={cn(getMessageContentStyles())}
            >
              <Response final={isMessageFinal}>{displayContent}</Response>
            </MessageContent>
          )}
          <MessageMetadata alignment={alignment} message={message} />
          {actions}
        </>
      )}

      <MediaLightbox
        open={lightbox != null}
        onOpenChange={(open) => {
          if (!open) setLightbox(null)
        }}
        items={lightbox?.items ?? []}
        index={lightbox?.index ?? 0}
        onIndexChange={(index) =>
          setLightbox((state) => (state ? { ...state, index } : state))
        }
      />
    </div>
  )
}

function ManagedToolImage(props: {
  url: string
  index: number
  alt: string
  downloadLabel: string
  onOpen?: () => void
}) {
  const [sizeLabel, setSizeLabel] = useState<string | null>(null)

  return (
    <div
      className='generation-result-enter border-border/70 bg-muted/30 relative overflow-hidden rounded-xl border'
      style={{ animationDelay: `${props.index * 70}ms` }}
    >
      <img
        src={props.url}
        alt={props.alt}
        className='generation-image-reveal max-h-80 w-full object-cover'
        referrerPolicy='no-referrer'
        loading='lazy'
        decoding='async'
        onLoad={(event) => {
          const img = event.currentTarget
          if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            setSizeLabel(`${img.naturalWidth}×${img.naturalHeight}`)
          }
        }}
      />
      {props.onOpen && (
        <button
          type='button'
          className='absolute inset-0 cursor-zoom-in'
          aria-label={props.alt}
          onClick={props.onOpen}
        />
      )}
      {sizeLabel && (
        <span className='generation-size-badge bg-background/85 text-foreground/90 absolute top-2 left-2 rounded-full px-2 py-0.5 font-mono text-[11px] shadow-sm backdrop-blur-sm'>
          {sizeLabel}
        </span>
      )}
      <Button
        size='icon-sm'
        variant='secondary'
        className='absolute right-2 bottom-2'
        aria-label={props.downloadLabel}
        onClick={() =>
          void downloadGeneratedMedia(
            props.url,
            `image-${props.index + 1}`,
            'image'
          )
        }
      >
        <Download aria-hidden='true' />
      </Button>
    </div>
  )
}
