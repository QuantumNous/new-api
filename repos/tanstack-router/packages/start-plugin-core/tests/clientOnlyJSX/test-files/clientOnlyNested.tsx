import { ClientOnly } from '@tanstack/react-router'

export function MyComponent() {
  return (
    <div>
      <ClientOnly fallback={<div>Outer loading</div>}>
        <div>
          Outer content
          <ClientOnly fallback={<span>Inner loading</span>}>
            <span>Inner client only</span>
          </ClientOnly>
        </div>
      </ClientOnly>
    </div>
  )
}
