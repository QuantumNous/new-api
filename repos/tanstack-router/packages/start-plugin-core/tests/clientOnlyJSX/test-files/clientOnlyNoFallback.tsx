import { ClientOnly } from '@tanstack/react-router'
import { HeavyAnimation } from 'animation-library'

export function MyComponent() {
  return (
    <div>
      <ClientOnly>
        <HeavyAnimation type="fade" />
      </ClientOnly>
    </div>
  )
}
