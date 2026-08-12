import { ClientOnly } from '@tanstack/react-router'
import { VideoPlayer } from 'video-player-lib'
import { AudioVisualizer } from 'audio-viz-lib'

export function MyComponent() {
  return (
    <div>
      <ClientOnly fallback={<span>Loading video...</span>}>
        <VideoPlayer src="/video.mp4" />
      </ClientOnly>
      <p>Some server content</p>
      <ClientOnly fallback={<span>Loading audio...</span>}>
        <AudioVisualizer frequency={440} />
      </ClientOnly>
    </div>
  )
}
