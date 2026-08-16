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
import { CameraIcon, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { captureStreamFrame, stopMediaStream } from '../../lib'

type PlaygroundCameraDialogProps = {
  onCapture: (file: File) => void
  onOpenChange: (open: boolean) => void
  open: boolean
}

/**
 * Live camera preview that turns the current frame into an image attachment.
 */
export function PlaygroundCameraDialog(props: PlaygroundCameraDialogProps) {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [capturing, setCapturing] = useState(false)

  const releaseStream = useCallback(() => {
    stopMediaStream(streamRef.current)
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setReady(false)
  }, [])

  useEffect(() => {
    if (!props.open) {
      releaseStream()
      return
    }

    let cancelled = false
    setError(null)

    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        if (cancelled) {
          stopMediaStream(stream)
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
        setReady(true)
      })
      .catch(() => {
        if (!cancelled) {
          setError(t('Camera access was denied or is unavailable'))
        }
      })

    return () => {
      cancelled = true
      releaseStream()
    }
  }, [props.open, releaseStream, t])

  const handleCapture = async () => {
    const stream = streamRef.current
    if (!stream) return

    setCapturing(true)
    try {
      const file = await captureStreamFrame(stream, 'camera')
      props.onCapture(file)
      props.onOpenChange(false)
    } catch {
      setError(t('Could not capture the photo, please try again'))
    } finally {
      setCapturing(false)
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{t('Take photo')}</DialogTitle>
          <DialogDescription>
            {t('Capture a photo with your camera and attach it to the message')}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p className='text-destructive text-sm'>{error}</p>
        ) : (
          <div className='bg-muted relative overflow-hidden rounded-lg'>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              autoPlay
              className='max-h-[50vh] w-full object-contain'
              muted
              playsInline
              ref={videoRef}
            />
            {!ready && (
              <div className='absolute inset-0 flex items-center justify-center'>
                <Loader2 className='text-muted-foreground size-5 animate-spin' />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            onClick={() => props.onOpenChange(false)}
            type='button'
            variant='outline'
          >
            {t('Cancel')}
          </Button>
          <Button
            disabled={!ready || capturing || Boolean(error)}
            onClick={handleCapture}
            type='button'
          >
            <CameraIcon className='size-4' />
            {t('Capture')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
