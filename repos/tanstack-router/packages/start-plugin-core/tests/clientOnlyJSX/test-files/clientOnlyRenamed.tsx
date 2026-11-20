// Test: ClientOnly imported with an alias should still be transformed
import { ClientOnly as CO } from '@tanstack/react-router'
import { WindowSize } from './WindowSize'

export function MyComponent() {
  return (
    <div>
      <CO fallback={<div>Loading...</div>}>
        <WindowSize />
      </CO>
    </div>
  )
}
