import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(tests)/nested-scroll-carry-over-b')({
  component: Component,
})

function ScrollBox({
  restorationId,
  testId,
}: {
  restorationId: string
  testId: string
}) {
  return (
    <div
      data-scroll-restoration-id={restorationId}
      data-testid={testId}
      className="h-24 overflow-auto rounded border p-2"
    >
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i}>Target row {i}</div>
      ))}
    </div>
  )
}

function Component() {
  return (
    <div className="grid gap-4 p-2">
      <h3>nested-scroll-carry-over-b</h3>
      <ScrollBox
        restorationId="carry-over-preserved"
        testId="carry-over-preserved"
      />
      <ScrollBox restorationId="carry-over-reset" testId="carry-over-reset" />
    </div>
  )
}
