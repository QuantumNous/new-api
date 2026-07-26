/* Copyright (C) 2023-2026 QuantumNous. Licensed under AGPL-3.0. */
import {
  AlignCenter,
  AlignHorizontalDistributeCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalDistributeCenter,
  Columns3,
  Grid2X2,
  Rows3,
  Route,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import type { CanvasLayoutAction } from '../engine/canvas-layout'
import { useCanvasStore } from '../store/canvas-store'

const ACTIONS: Array<{
  action: CanvasLayoutAction
  label: string
  icon: typeof AlignLeft
}> = [
  { action: 'align-left', label: 'Align left', icon: AlignLeft },
  {
    action: 'align-center-x',
    label: 'Align horizontal centers',
    icon: AlignCenter,
  },
  { action: 'align-right', label: 'Align right', icon: AlignRight },
  { action: 'align-top', label: 'Align top', icon: AlignLeft },
  {
    action: 'align-center-y',
    label: 'Align vertical centers',
    icon: AlignCenter,
  },
  { action: 'align-bottom', label: 'Align bottom', icon: AlignRight },
  {
    action: 'distribute-x',
    label: 'Distribute horizontally',
    icon: AlignHorizontalDistributeCenter,
  },
  {
    action: 'distribute-y',
    label: 'Distribute vertically',
    icon: AlignVerticalDistributeCenter,
  },
  { action: 'row', label: 'Arrange in row', icon: Rows3 },
  { action: 'column', label: 'Arrange in column', icon: Columns3 },
  { action: 'grid', label: 'Arrange in grid', icon: Grid2X2 },
  { action: 'connections', label: 'Arrange by connections', icon: Route },
]

export function CanvasSelectionToolbar() {
  const { t } = useTranslation()
  const count = useCanvasStore((state) => state.selectedNodeIds.length)
  if (count < 2) return null
  return (
    <div
      role='toolbar'
      aria-label={t('Arrange selected nodes')}
      data-canvas-no-zoom
      className='bg-background/95 absolute top-4 left-1/2 z-20 flex max-w-[calc(100%-2rem)] -translate-x-1/2 gap-0.5 overflow-x-auto rounded-lg border p-1 shadow-lg'
    >
      {ACTIONS.map((item) => (
        <Button
          key={item.action}
          size='icon-sm'
          variant='ghost'
          aria-label={t(item.label)}
          title={t(item.label)}
          onClick={() => useCanvasStore.getState().layoutSelection(item.action)}
        >
          <item.icon className='size-4' />
        </Button>
      ))}
    </div>
  )
}
