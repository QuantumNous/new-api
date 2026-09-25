// This should NOT be transformed because ClientOnly is not from @tanstack/*-router
import { ClientOnly } from 'some-other-package'

export function MyComponent() {
  return (
    <div>
      <ClientOnly fallback={<div>Loading...</div>}>
        <div>This should remain as-is</div>
      </ClientOnly>
    </div>
  )
}
