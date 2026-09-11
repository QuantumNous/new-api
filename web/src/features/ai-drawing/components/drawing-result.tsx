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
import { Download, ImageIcon, LoaderCircle, WandSparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import { getDrawingZip } from '../api'
import { saveDrawingBlob } from '../lib/drawing'
import type { DrawingBatch } from '../types'
import { DrawingImageCard } from './drawing-image-card'

type DrawingResultProps = { batch?: DrawingBatch; isLoading: boolean }
export function DrawingResult(props: DrawingResultProps) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(timer)
  }, [])
  const items = (props.batch?.items ?? []).filter(
    (item) =>
      item.expires_at > now ||
      item.status === 'running' ||
      item.status === 'recovering'
  )
  const succeeded = items.filter(
    (item) => item.status === 'succeeded' && item.expires_at > now
  ).length
  const downloadAll = async () => {
    if (!props.batch) return
    setBusy(true)
    try {
      saveDrawingBlob(
        await getDrawingZip(props.batch.id),
        `ai-drawing-${props.batch.id}.zip`
      )
    } catch {
      toast.error(t('Download failed'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card className='min-h-[22rem] shrink-0 md:min-h-0 md:shrink'>
      <CardHeader className='grid-cols-[1fr_auto]'>
        <CardTitle className='flex items-center gap-2'>
          <WandSparkles className='size-4' aria-hidden='true' />
          {t('Result')}
        </CardTitle>
        {succeeded > 0 && (
          <Button
            size='sm'
            variant='outline'
            disabled={busy}
            onClick={downloadAll}
          >
            {busy ? (
              <LoaderCircle className='animate-spin' aria-hidden='true' />
            ) : (
              <Download aria-hidden='true' />
            )}
            {t('Download as ZIP')}
          </Button>
        )}
      </CardHeader>
      <CardContent className='flex min-h-0 flex-1 flex-col'>
        {items.length === 0 ? (
          <div
            className='bg-muted/20 flex min-h-[18rem] flex-1 items-center justify-center rounded-lg border border-dashed'
            role='status'
            aria-label={t(props.isLoading ? 'Loading' : 'Ready')}
          >
            {props.isLoading ? (
              <LoaderCircle
                className='text-muted-foreground size-7 animate-spin'
                aria-hidden='true'
              />
            ) : (
              <ImageIcon
                className='text-muted-foreground size-7'
                aria-hidden='true'
              />
            )}
          </div>
        ) : (
          <div
            data-testid='drawing-results'
            data-layout={items.length === 1 ? 'single' : 'grid'}
            className={cn(
              'grid min-h-0 content-start items-start gap-3 overflow-y-auto',
              items.length === 1
                ? 'grid-cols-1 justify-items-center'
                : 'grid-cols-2 sm:grid-cols-[repeat(auto-fill,9rem)]'
            )}
          >
            {items.map((item) => (
              <div
                key={item.id}
                data-testid='drawing-result-item'
                className={cn('min-w-0', {
                  'w-full max-w-5xl': items.length === 1,
                })}
              >
                <DrawingImageCard
                  item={item}
                  now={now}
                  ratio={props.batch?.ratio ?? '1:1'}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
