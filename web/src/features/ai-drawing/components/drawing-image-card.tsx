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
import { Download, ImageIcon, LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

import { getDrawingImage } from '../api'
import { saveDrawingBlob } from '../lib/drawing'
import type { DrawingItem } from '../types'

type DrawingImageCardProps = { item: DrawingItem; now: number; ratio: string }
export function DrawingImageCard(props: DrawingImageCardProps) {
  const { t } = useTranslation()
  const item = props.item
  const ready = item.status === 'succeeded' && item.expires_at > props.now
  const active =
    item.status === 'queued' ||
    item.status === 'running' ||
    item.status === 'recovering'
  const [preview, setPreview] = useState('')
  const [loadError, setLoadError] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!ready) return
    const controller = new AbortController()
    let url = ''
    let timer: ReturnType<typeof setTimeout> | undefined
    setPreview('')
    setLoadError(false)
    getDrawingImage(item.id, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted || Date.now() >= item.expires_at * 1000) {
          return
        }
        url = URL.createObjectURL(blob)
        setPreview(url)
        timer = setTimeout(
          () => {
            URL.revokeObjectURL(url)
            setPreview('')
          },
          Math.max(0, item.expires_at * 1000 - Date.now())
        )
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadError(true)
      })
    return () => {
      controller.abort()
      if (timer) clearTimeout(timer)
      if (url) URL.revokeObjectURL(url)
    }
  }, [item.id, item.attempts, item.expires_at, ready])
  const download = async () => {
    setBusy(true)
    try {
      const blob = await getDrawingImage(item.id)
      const ext =
        item.mime === 'image/jpeg' ? 'jpg' : item.mime.split('/')[1] || 'png'
      saveDrawingBlob(blob, `${String(item.position).padStart(2, '0')}.${ext}`)
    } catch {
      toast.error(t('Download failed'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className='flex min-w-0 flex-col gap-1'>
      <div
        className='bg-muted/20 flex items-center justify-center overflow-hidden rounded-lg'
        style={{ aspectRatio: props.ratio.replace(':', '/') }}
      >
        {ready && preview ? (
          <img
            src={preview}
            loading='lazy'
            alt={t('Generated image')}
            className='size-full object-contain'
          />
        ) : (
          <div
            className='text-muted-foreground flex size-full items-center justify-center'
            role='status'
            aria-label={t(
              active || (ready && !loadError) ? 'Generating image' : 'Failed'
            )}
          >
            {active || (ready && !loadError) ? (
              <LoaderCircle
                className='size-5 animate-spin'
                aria-hidden='true'
              />
            ) : (
              <ImageIcon className='size-5' aria-hidden='true' />
            )}
          </div>
        )}
      </div>
      <Button
        size='sm'
        variant='ghost'
        className='self-end'
        disabled={!ready || busy}
        onClick={download}
      >
        <Download className='size-3.5' aria-hidden='true' />
        {t('Download')}
      </Button>
    </div>
  )
}
