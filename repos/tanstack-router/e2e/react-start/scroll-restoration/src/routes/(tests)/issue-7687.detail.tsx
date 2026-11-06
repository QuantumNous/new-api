import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(tests)/issue-7687/detail')({
  component: Component,
})

function Component() {
  return (
    <div className="grid gap-4">
      <h3>issue-7687-detail</h3>
      {Array.from({ length: 40 }).map((_, i) => (
        <div key={i}>Detail row {i}</div>
      ))}
    </div>
  )
}
