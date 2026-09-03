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
import { useNavigate } from '@tanstack/react-router'
import { Download, History, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ImagePreviewDialog } from '@/components/image-preview-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { STORAGE_KEYS } from '@/features/canvas/constants'
import {
  clearHistory,
  downloadImage,
  loadHistory,
  removeHistoryEntry,
  type CanvasHistoryEntry,
} from '@/features/canvas/lib/history'

export function CanvasHistory() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [entries, setEntries] = useState<CanvasHistoryEntry[]>([])
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)

  useEffect(() => {
    setEntries(loadHistory())
  }, [])

  const handleClear = () => {
    clearHistory()
    setEntries([])
  }

  const handleDelete = (id: string) => {
    removeHistoryEntry(id)
    setEntries(loadHistory())
  }

  const handleReuse = (entry: CanvasHistoryEntry) => {
    sessionStorage.setItem(
      STORAGE_KEYS.RESTORE,
      JSON.stringify({
        prompt: entry.prompt,
        model: entry.model,
        group: entry.group,
        size: entry.size,
        n: entry.n,
      })
    )
    navigate({ to: '/canvas' })
  }

  return (
    <div className='mx-auto max-w-6xl'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h1 className='text-lg font-bold'>{t('Drawing Records')}</h1>
          <p className='text-muted-foreground text-sm'>
            {t('Images and prompts generated in Canvas are saved here.')}
          </p>
        </div>
        {entries.length > 0 && (
          <Button variant='outline' onClick={handleClear}>
            <Trash2 className='h-4 w-4' />
            {t('Clear')}
          </Button>
        )}
      </div>

      {entries.length === 0 ? (
        <div className='border-border text-muted-foreground mt-6 flex h-64 flex-col items-center justify-center gap-2 rounded-xl border text-sm'>
          <History className='h-8 w-8' />
          <span>{t('No drawing records yet.')}</span>
        </div>
      ) : (
        <div className='mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
          {entries.map((entry) => (
            <Card key={entry.id} className='overflow-hidden'>
              <div className='relative aspect-square bg-muted'>
                <img
                  src={entry.image}
                  alt={entry.prompt || t('Generated image')}
                  onClick={() => setPreviewSrc(entry.image)}
                  className='h-full w-full cursor-zoom-in object-contain'
                />
                <div className='absolute right-2 top-2 flex gap-1'>
                  <button
                    type='button'
                    onClick={() =>
                      void downloadImage(entry.image, `canvas-${entry.id}.png`)
                    }
                    aria-label={t('Download')}
                    className='bg-background/80 rounded-md p-1.5'
                  >
                    <Download className='h-4 w-4' />
                  </button>
                  <button
                    type='button'
                    onClick={() => handleDelete(entry.id)}
                    aria-label={t('Delete')}
                    className='bg-background/80 rounded-md p-1.5'
                  >
                    <Trash2 className='h-4 w-4' />
                  </button>
                </div>
              </div>
              <CardContent className='space-y-2 p-3'>
                <p className='text-muted-foreground line-clamp-2 text-xs'>
                  {entry.prompt || t('No prompt')}
                </p>
                <div className='text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-[11px]'>
                  <span>{entry.model}</span>
                  <span>{entry.group}</span>
                  <span>{entry.size}</span>
                  <span>{new Date(entry.createdAt).toLocaleString()}</span>
                </div>
                <Button variant='ghost' size='sm' onClick={() => handleReuse(entry)}>
                  <RotateCcw className='h-3.5 w-3.5' />
                  {t('Reuse prompt')}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <ImagePreviewDialog src={previewSrc} onClose={() => setPreviewSrc(null)} />
    </div>
  )
}
