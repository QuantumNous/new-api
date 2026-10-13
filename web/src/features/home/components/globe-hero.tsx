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
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { useStatus } from '@/hooks/use-status'

// Isolate the demo's document-level WebGL renderer and dark palette from the
// application's theme. Its assets load only when this home component mounts.
export function GlobeHero() {
  const { t } = useTranslation()
  const { status } = useStatus()
  const frameRef = useRef<HTMLIFrameElement>(null)
  const visibleRef = useRef(true)
  const syncVisibility = useCallback(() => {
    frameRef.current?.contentWindow?.postMessage(
      { type: 'home-globe-visibility', visible: visibleRef.current },
      '*'
    )
  }, [])

  const syncCopy = useCallback(() => {
    frameRef.current?.contentWindow?.postMessage(
      {
        type: 'home-globe-copy',
        copy: {
          categoryLabel: {
            chat: t('Chat'),
            image: t('Image'),
            video: t('Video'),
            audio: t('Audio'),
          },
          categoryLine: {
            chat: t('Reasoning, writing and code in one conversation.'),
            image: t(
              'From prompts to images, with control over style and consistency.'
            ),
            video: t('Turn reference material into ready-to-use video.'),
            audio: t('Generate speech, clone voices and transcribe audio.'),
          },
          modelWord: t('Models'),
        },
      },
      '*'
    )
  }, [t])

  useEffect(syncCopy, [syncCopy])

  useEffect(() => {
    const frame = frameRef.current
    if (!frame || !('IntersectionObserver' in window)) return
    const updateVisibility = () => {
      const bounds = frame.getBoundingClientRect()
      const overlay = frame
        .closest('section')
        ?.querySelector('[data-home-overlay]')
      const covered = overlay ? overlay.getBoundingClientRect().top <= 0 : false
      visibleRef.current =
        bounds.bottom > 0 && bounds.top < window.innerHeight && !covered
      syncVisibility()
    }
    const observer = new IntersectionObserver(([entry]) => {
      visibleRef.current = entry.isIntersecting
      syncVisibility()
    })
    window.addEventListener('scroll', updateVisibility, { passive: true })
    observer.observe(frame)
    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', updateVisibility)
    }
  }, [syncVisibility])

  return (
    <iframe
      ref={frameRef}
      src={
        status?.home_globe_domestic_only === true
          ? '/home-globe/globe.html?domestic=1'
          : '/home-globe/globe.html'
      }
      sandbox='allow-scripts'
      title={t('AI models')}
      tabIndex={-1}
      className='block h-svh max-h-[1000px] min-h-[420px] w-full border-0 bg-[#08090a]'
      onLoad={() => {
        syncVisibility()
        syncCopy()
      }}
    />
  )
}
