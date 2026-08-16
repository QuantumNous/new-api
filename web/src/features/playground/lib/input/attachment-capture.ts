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
const CAPTURE_MIME_TYPE = 'image/png'

const TEXT_LIKE_EXTENSIONS = [
  '.csv',
  '.json',
  '.log',
  '.md',
  '.markdown',
  '.sql',
  '.txt',
  '.xml',
  '.yaml',
  '.yml',
]

const TEXT_LIKE_MIME_TYPES = new Set([
  'application/json',
  'application/xml',
  'application/x-yaml',
])

export type MediaCaptureKind = 'camera' | 'screen'

/**
 * File name for a capture, timestamped so several captures stay distinguishable
 * in the attachment list.
 */
export function buildCaptureFileName(
  kind: MediaCaptureKind,
  now: Date = new Date()
): string {
  const stamp = now
    .toISOString()
    .replaceAll(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19)
  return `${kind === 'camera' ? 'photo' : 'screenshot'}-${stamp}.png`
}

export function isScreenCaptureSupported(): boolean {
  return typeof navigator?.mediaDevices?.getDisplayMedia === 'function'
}

export function isCameraCaptureSupported(): boolean {
  return typeof navigator?.mediaDevices?.getUserMedia === 'function'
}

/**
 * True for files whose text content can be inlined into the prompt. Playground
 * models only accept images as binary parts, so other documents are rejected
 * instead of being silently dropped.
 */
export function isTextLikeFile(file: File): boolean {
  if (file.type.startsWith('text/')) {
    return true
  }
  if (TEXT_LIKE_MIME_TYPES.has(file.type)) {
    return true
  }
  const name = file.name.toLowerCase()
  return TEXT_LIKE_EXTENSIONS.some((extension) => name.endsWith(extension))
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

/**
 * Render the prompt snippet for an inlined text file so the model sees the file
 * name together with its content.
 */
export function buildTextFileSnippet(
  filename: string,
  content: string
): string {
  return `${filename}:\n\`\`\`\n${content.trim()}\n\`\`\``
}

export async function readTextFile(file: File): Promise<string> {
  return file.text()
}

export function stopMediaStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((track) => track.stop())
}

/**
 * Grab the first painted frame of a live media stream as a PNG file.
 */
export async function captureStreamFrame(
  stream: MediaStream,
  kind: MediaCaptureKind
): Promise<File> {
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.srcObject = stream

  try {
    await waitForVideoFrame(video)

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context || canvas.width === 0 || canvas.height === 0) {
      throw new Error('capture-unavailable')
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    const blob = await canvasToBlob(canvas)
    return new File([blob], buildCaptureFileName(kind), {
      type: CAPTURE_MIME_TYPE,
    })
  } finally {
    video.pause()
    video.srcObject = null
  }
}

/**
 * Ask the browser for a screen/window/tab stream, grab one frame and release it
 * immediately so no sharing indicator stays active.
 */
export async function captureScreenshotFile(): Promise<File> {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
  try {
    return await captureStreamFrame(stream, 'screen')
  } finally {
    stopMediaStream(stream)
  }
}

async function waitForVideoFrame(video: HTMLVideoElement): Promise<void> {
  await video.play()

  if (video.readyState >= 2 && video.videoWidth > 0) {
    return
  }

  await new Promise<void>((resolve, reject) => {
    const onLoaded = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('capture-unavailable'))
    }
    const cleanup = () => {
      video.removeEventListener('loadeddata', onLoaded)
      video.removeEventListener('error', onError)
    }
    video.addEventListener('loadeddata', onLoaded)
    video.addEventListener('error', onError)
  })
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
        return
      }
      reject(new Error('capture-unavailable'))
    }, CAPTURE_MIME_TYPE)
  })
}
