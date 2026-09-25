import { createFileRoute } from '@tanstack/react-router'

export function getObjectCallback() {
  return { getObject: () => ({ constA: 10, constB: 5 }) }
}

export const { getObject } = getObjectCallback()

export const Route = createFileRoute('/about')({
  component: AboutComponent,
})

function AboutComponent() {
  return (
    <div className="p-2">
      <h3>About</h3>
    </div>
  )
}
