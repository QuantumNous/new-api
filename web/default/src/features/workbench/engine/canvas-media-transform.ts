/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
export type CropRect = { x: number; y: number; width: number; height: number }

export const KEYBOARD_STEP = 1
export const KEYBOARD_LARGE_STEP = 10

export function keyboardStep(shiftKey: boolean): number {
  return shiftKey ? KEYBOARD_LARGE_STEP : KEYBOARD_STEP
}

export function arrowDelta(
  key: string,
  step: number
): { x: number; y: number } {
  if (key === 'ArrowLeft') return { x: -step, y: 0 }
  if (key === 'ArrowRight') return { x: step, y: 0 }
  if (key === 'ArrowUp') return { x: 0, y: -step }
  if (key === 'ArrowDown') return { x: 0, y: step }
  return { x: 0, y: 0 }
}

export function normalizeCrop(
  start: { x: number; y: number },
  end: { x: number; y: number }
): CropRect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  }
}

export async function transformImage(
  source: string,
  crop?: CropRect,
  quarterTurns = 0
): Promise<File> {
  const response = await fetch(source, { credentials: 'include' })
  if (!response.ok) throw new Error('image-fetch-failed')
  const bitmap = await createImageBitmap(await response.blob())
  const area = crop ?? {
    x: 0,
    y: 0,
    width: bitmap.width,
    height: bitmap.height,
  }
  if (area.width < 1 || area.height < 1) throw new Error('empty-crop')
  const turns = ((quarterTurns % 4) + 4) % 4
  const swap = turns % 2 === 1
  const canvas = document.createElement('canvas')
  canvas.width = swap ? area.height : area.width
  canvas.height = swap ? area.width : area.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas-unavailable')
  context.translate(canvas.width / 2, canvas.height / 2)
  context.rotate((turns * Math.PI) / 2)
  context.drawImage(
    bitmap,
    area.x,
    area.y,
    area.width,
    area.height,
    -area.width / 2,
    -area.height / 2,
    area.width,
    area.height
  )
  bitmap.close()
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) =>
        value ? resolve(value) : reject(new Error('image-encode-failed')),
      'image/png'
    )
  )
  return new File([blob], 'canvas-image.png', { type: 'image/png' })
}

export async function captureVideoFrame(
  video: HTMLVideoElement,
  atEnd: boolean
): Promise<File> {
  if (!video.videoWidth || !video.videoHeight) {
    throw new Error('video-not-ready')
  }
  if (atEnd) {
    video.currentTime = Math.max(0, video.duration - 0.05)
    await new Promise<void>((resolve, reject) => {
      video.addEventListener('seeked', () => resolve(), { once: true })
      video.addEventListener(
        'error',
        () => reject(new Error('video-seek-failed')),
        { once: true }
      )
    })
  }
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas-unavailable')
  context.drawImage(video, 0, 0)
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) =>
        value ? resolve(value) : reject(new Error('video-cors-blocked')),
      'image/png'
    )
  )
  return new File([blob], atEnd ? 'tail-frame.png' : 'current-frame.png', {
    type: 'image/png',
  })
}
