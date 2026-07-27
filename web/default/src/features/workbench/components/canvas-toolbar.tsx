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
import {
  Camera,
  CircleDot,
  Download,
  Frame,
  Image as ImageIcon,
  Maximize,
  Music,
  Redo2,
  Settings2,
  StickyNote,
  Table,
  Undo2,
  Upload,
  Video,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'

import { useCanvasTheme } from '../engine/canvas-theme'
import {
  CanvasNodeType,
  type CanvasBackgroundMode,
  type CanvasExperienceMode,
} from '../types'

type CanvasToolbarProps = {
  scale: number
  canUndo: boolean
  canRedo: boolean
  onAddNode: (type: CanvasNodeType) => void
  onUndo: () => void
  onRedo: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onFitView: () => void
  onExportDocument: () => void
  onExportArchive: () => void
  onImportDocument: () => void
  onExportImage: () => void
  backgroundMode: CanvasBackgroundMode
  experienceMode: CanvasExperienceMode
  onBackgroundModeChange: (mode: CanvasBackgroundMode) => void
}

const NODE_BUTTONS = [
  { type: CanvasNodeType.Image, icon: ImageIcon, label: 'Image' },
  { type: CanvasNodeType.Video, icon: Video, label: 'Video' },
  { type: CanvasNodeType.Audio, icon: Music, label: 'Audio' },
  { type: CanvasNodeType.Text, icon: StickyNote, label: 'Note' },
  { type: CanvasNodeType.Script, icon: Table, label: 'Storyboard' },
  { type: CanvasNodeType.Config, icon: Settings2, label: 'Generation preset' },
  { type: CanvasNodeType.Frame, icon: Frame, label: 'Frame' },
] as const

export function CanvasToolbar(props: CanvasToolbarProps) {
  const { t } = useTranslation()
  const theme = useCanvasTheme()

  return (
    <div
      data-canvas-no-zoom
      data-guide='canvas-toolbar'
      className='absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border px-2 py-1.5 shadow-lg backdrop-blur-xl'
      style={{
        background: theme.toolbar.panel,
        borderColor: theme.toolbar.border,
        color: theme.toolbar.item,
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {NODE_BUTTONS.filter(
        (button) =>
          props.experienceMode === 'professional' ||
          ![
            CanvasNodeType.Audio,
            CanvasNodeType.Script,
            CanvasNodeType.Config,
          ].includes(button.type)
      ).map((button) => (
        <Button
          key={button.type}
          size='icon'
          variant='ghost'
          className='size-8 rounded-full'
          title={t(button.label)}
          onClick={() => props.onAddNode(button.type)}
        >
          <button.icon className='size-4' />
        </Button>
      ))}

      <Separator orientation='vertical' className='mx-1 h-5' />

      <Select
        value={props.backgroundMode}
        onValueChange={(value) =>
          props.onBackgroundModeChange(value as CanvasBackgroundMode)
        }
      >
        <SelectTrigger
          size='sm'
          className='w-24'
          aria-label={t('Canvas background')}
        >
          <CircleDot />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='dots'>{t('Dots')}</SelectItem>
          <SelectItem value='lines'>{t('Lines')}</SelectItem>
          <SelectItem value='blank'>{t('Blank')}</SelectItem>
        </SelectContent>
      </Select>

      <Separator orientation='vertical' className='mx-1 h-5' />

      <Button
        size='icon'
        variant='ghost'
        className='size-8 rounded-full'
        title={t('Undo')}
        disabled={!props.canUndo}
        onClick={props.onUndo}
      >
        <Undo2 className='size-4' />
      </Button>
      <Button
        size='icon'
        variant='ghost'
        className='size-8 rounded-full'
        title={t('Redo')}
        disabled={!props.canRedo}
        onClick={props.onRedo}
      >
        <Redo2 className='size-4' />
      </Button>

      <Separator orientation='vertical' className='mx-1 h-5' />

      <Button
        size='icon'
        variant='ghost'
        className='size-8 rounded-full'
        title={t('Zoom out')}
        onClick={props.onZoomOut}
      >
        <ZoomOut className='size-4' />
      </Button>
      <span className='w-12 text-center text-xs tabular-nums'>
        {Math.round(props.scale * 100)}%
      </span>
      <Button
        size='icon'
        variant='ghost'
        className='size-8 rounded-full'
        title={t('Zoom in')}
        onClick={props.onZoomIn}
      >
        <ZoomIn className='size-4' />
      </Button>
      <Button
        size='icon'
        variant='ghost'
        className='size-8 rounded-full'
        title={t('Fit view')}
        onClick={props.onFitView}
      >
        <Maximize className='size-4' />
      </Button>

      <Separator orientation='vertical' className='mx-1 h-5' />

      <Button
        size='icon'
        variant='ghost'
        className='size-8 rounded-full'
        title={t('Export canvas file')}
        onClick={props.onExportDocument}
      >
        <Download className='size-4' />
      </Button>
      <Button
        size='icon'
        variant='ghost'
        className='size-8 rounded-full'
        title={t('Export canvas archive')}
        onClick={props.onExportArchive}
      >
        <Download className='size-4' />
      </Button>
      <Button
        size='icon'
        variant='ghost'
        className='size-8 rounded-full'
        title={t('Import canvas file')}
        onClick={props.onImportDocument}
      >
        <Upload className='size-4' />
      </Button>
      <Button
        size='icon'
        variant='ghost'
        className='size-8 rounded-full'
        title={t('Export as image')}
        onClick={props.onExportImage}
      >
        <Camera className='size-4' />
      </Button>
    </div>
  )
}
