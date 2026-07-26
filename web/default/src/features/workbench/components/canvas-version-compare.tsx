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
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { useCanvasStore } from '../store/canvas-store'
import { CanvasNodeType } from '../types'

export function CanvasVersionCompare() {
  const { t } = useTranslation()
  const nodes = useCanvasStore((state) => state.nodes)
  const [nodeId, setNodeId] = useState<string | null>(null)
  useEffect(() => {
    const open = (event: Event) =>
      setNodeId((event as CustomEvent<string>).detail)
    window.addEventListener('canvas:compare-versions', open)
    return () => window.removeEventListener('canvas:compare-versions', open)
  }, [])
  const selected = nodes.find((node) => node.id === nodeId)
  const rootId = selected?.metadata?.versionRootId ?? selected?.id
  const versions = rootId
    ? nodes.filter(
        (node) => (node.metadata?.versionRootId ?? node.id) === rootId
      )
    : []

  return (
    <Dialog
      open={Boolean(nodeId)}
      onOpenChange={(open) => {
        if (!open) setNodeId(null)
      }}
    >
      <DialogContent className='max-w-5xl'>
        <DialogHeader>
          <DialogTitle>{t('Compare versions')}</DialogTitle>
        </DialogHeader>
        <div className='grid gap-4 md:grid-cols-3'>
          {versions.map((node) => (
            <section key={node.id} className='space-y-3 rounded-lg border p-3'>
              <div className='flex items-center justify-between'>
                <strong>
                  {t('Version {{label}}', {
                    label: node.metadata?.versionLabel ?? 'A',
                  })}
                </strong>
                {node.metadata?.versionPrimary ? (
                  <span className='text-primary text-xs'>{t('Primary')}</span>
                ) : null}
              </div>
              <div className='bg-muted flex aspect-video items-center justify-center overflow-hidden rounded'>
                {node.type === CanvasNodeType.Image &&
                node.metadata?.content ? (
                  <img
                    src={node.metadata.content}
                    alt=''
                    className='h-full w-full object-contain'
                  />
                ) : null}
                {node.type === CanvasNodeType.Video &&
                node.metadata?.content ? (
                  <video
                    src={node.metadata.content}
                    controls
                    className='h-full w-full'
                  />
                ) : null}
                {node.type === CanvasNodeType.Audio &&
                node.metadata?.content ? (
                  <audio
                    src={node.metadata.content}
                    controls
                    className='w-full'
                  />
                ) : null}
                {!node.metadata?.content ? (
                  <span className='text-muted-foreground text-sm'>
                    {t('No result yet')}
                  </span>
                ) : null}
              </div>
              <dl className='text-sm'>
                <dt className='text-muted-foreground'>{t('Model')}</dt>
                <dd>
                  {node.metadata?.model ?? node.metadata?.videoModel ?? '—'}
                </dd>
                <dt className='text-muted-foreground mt-2'>{t('Size')}</dt>
                <dd>{node.metadata?.size ?? '—'}</dd>
                <dt className='text-muted-foreground mt-2'>{t('Prompt')}</dt>
                <dd className='max-h-24 overflow-auto whitespace-pre-wrap'>
                  {node.metadata?.prompt ?? '—'}
                </dd>
              </dl>
              <div className='flex gap-2'>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent('canvas:focus-node', { detail: node.id })
                    )
                    setNodeId(null)
                  }}
                >
                  {t('Locate node')}
                </Button>
                <Button
                  size='sm'
                  disabled={node.metadata?.versionPrimary}
                  onClick={() =>
                    useCanvasStore.getState().setPrimaryNodeVersion(node.id)
                  }
                >
                  {t('Set as primary')}
                </Button>
              </div>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
