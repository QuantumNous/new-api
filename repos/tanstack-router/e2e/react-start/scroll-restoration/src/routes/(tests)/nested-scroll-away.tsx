import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(tests)/nested-scroll-away')({
  component: Component,
})

function Component() {
  return (
    <div className="grid gap-4 p-2">
      <h3>nested-scroll-away</h3>
      <p>This route intentionally has no nested scroll container.</p>
    </div>
  )
}
