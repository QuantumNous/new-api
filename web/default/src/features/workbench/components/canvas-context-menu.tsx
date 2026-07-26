/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { useCanvasTheme } from '../engine/canvas-theme'
import { CanvasNodeType, type ContextMenuState } from '../types'

export type CanvasContextMenuActions = {
  onAddNode: (type: CanvasNodeType) => void
  onPaste: () => void
  onFitView: () => void
  onCopyNode: () => void
  onDuplicateNode: () => void
  onDownloadNode: () => void
  onGenerateNode: () => void
  onDeleteNode: () => void
  onDeleteConnection: () => void
}

const NODE_TYPE_LABELS: Array<{ type: CanvasNodeType; label: string }> = [
  { type: CanvasNodeType.Image, label: 'Image' },
  { type: CanvasNodeType.Video, label: 'Video' },
  { type: CanvasNodeType.Audio, label: 'Audio' },
  { type: CanvasNodeType.Text, label: 'Note' },
  { type: CanvasNodeType.Script, label: 'Storyboard' },
  { type: CanvasNodeType.Config, label: 'Generation preset' },
  { type: CanvasNodeType.Frame, label: 'Frame' },
]

export function CanvasContextMenu(props: {
  state: ContextMenuState
  canPaste: boolean
  canDownload: boolean
  canGenerate: boolean
  /** Connection released on empty canvas: only offer connectable node types. */
  connectMode?: boolean
  actions: CanvasContextMenuActions
  onClose: () => void
}) {
  const { t } = useTranslation()
  const theme = useCanvasTheme()
  const ref = useRef<HTMLDivElement>(null)
  const onClose = props.onClose

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (ref.current?.contains(event.target as Node)) return
      onClose()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const run = (action: () => void) => {
    action()
    onClose()
  }

  const itemClass =
    'w-full rounded px-2 py-1.5 text-left text-xs hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/10'

  return (
    <div
      ref={ref}
      data-canvas-no-zoom
      className='fixed z-50 min-w-44 rounded-lg border p-1 shadow-lg backdrop-blur'
      style={{
        left: props.state.x,
        top: props.state.y,
        background: theme.toolbar.panel,
        borderColor: theme.toolbar.border,
        color: theme.node.text,
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      {props.state.type === 'canvas' ? (
        <>
          {NODE_TYPE_LABELS.filter(
            (item) => !props.connectMode || item.type !== CanvasNodeType.Frame
          ).map((item) => (
            <button
              key={item.type}
              type='button'
              className={itemClass}
              onClick={() => run(() => props.actions.onAddNode(item.type))}
            >
              {props.connectMode
                ? t('Connect to {{name}}', { name: t(item.label) })
                : t('Add {{name}}', { name: t(item.label) })}
            </button>
          ))}
          {props.connectMode ? null : (
            <>
              <div
                className='my-1 h-px'
                style={{ background: theme.toolbar.border }}
              />
              <button
                type='button'
                className={itemClass}
                disabled={!props.canPaste}
                onClick={() => run(props.actions.onPaste)}
              >
                {t('Paste')}
              </button>
              <button
                type='button'
                className={itemClass}
                onClick={() => run(props.actions.onFitView)}
              >
                {t('Fit view')}
              </button>
            </>
          )}
        </>
      ) : null}

      {props.state.type === 'node' ? (
        <>
          <button
            type='button'
            className={itemClass}
            disabled={!props.canGenerate}
            onClick={() => run(props.actions.onGenerateNode)}
          >
            {t('Generate')}
          </button>
          <button
            type='button'
            className={itemClass}
            onClick={() => run(props.actions.onCopyNode)}
          >
            {t('Copy')}
          </button>
          <button
            type='button'
            className={itemClass}
            onClick={() => run(props.actions.onDuplicateNode)}
          >
            {t('Duplicate')}
          </button>
          <button
            type='button'
            className={itemClass}
            disabled={!props.canDownload}
            onClick={() => run(props.actions.onDownloadNode)}
          >
            {t('Download')}
          </button>
          <div
            className='my-1 h-px'
            style={{ background: theme.toolbar.border }}
          />
          <button
            type='button'
            className={itemClass}
            onClick={() => run(props.actions.onDeleteNode)}
          >
            {t('Delete')}
          </button>
        </>
      ) : null}

      {props.state.type === 'connection' ? (
        <button
          type='button'
          className={itemClass}
          onClick={() => run(props.actions.onDeleteConnection)}
        >
          {t('Delete connection')}
        </button>
      ) : null}
    </div>
  )
}
