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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { downloadDrawingImage } from '../lib/drawing'

type DrawingResultProps = {
  resultUrl: string
  isLoading: boolean
}

export function DrawingResult(props: DrawingResultProps) {
  const { t } = useTranslation()
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownload = async () => {
    if (!props.resultUrl || isDownloading) return
    setIsDownloading(true)
    try {
      await downloadDrawingImage(props.resultUrl)
    } catch {
      toast.error(t('Download failed'))
    } finally {
      setIsDownloading(false)
    }
  }

  let resultContent = (
    <div className='text-muted-foreground grid justify-items-center gap-2 text-sm'>
      <ImageIcon className='size-9' aria-hidden='true' />
      <span>{t('Ready')}</span>
    </div>
  )

  if (props.isLoading) {
    resultContent = (
      <div className='text-muted-foreground grid justify-items-center gap-3 text-sm'>
        <LoaderCircle className='size-8 animate-spin' aria-hidden='true' />
        <span>{t('Generating image')}</span>
      </div>
    )
  } else if (props.resultUrl) {
    resultContent = (
      <img
        src={props.resultUrl}
        alt={t('Generated image')}
        className='max-h-full w-full object-contain'
      />
    )
  }

  return (
    <Card className='min-h-[22rem] md:min-h-0'>
      <CardHeader className='grid-cols-[1fr_auto]'>
        <CardTitle className='flex items-center gap-2'>
          <WandSparkles className='size-4' aria-hidden='true' />
          {t('Result')}
        </CardTitle>
        {props.resultUrl && (
          <Button
            size='sm'
            variant='outline'
            disabled={isDownloading}
            onClick={handleDownload}
          >
            {isDownloading ? (
              <LoaderCircle className='animate-spin' aria-hidden='true' />
            ) : (
              <Download aria-hidden='true' />
            )}
            {t('Download')}
          </Button>
        )}
      </CardHeader>
      <CardContent className='flex min-h-0 flex-1'>
        <div className='bg-muted/20 flex min-h-[18rem] flex-1 items-center justify-center overflow-hidden rounded-lg border border-dashed'>
          {resultContent}
        </div>
      </CardContent>
    </Card>
  )
}
