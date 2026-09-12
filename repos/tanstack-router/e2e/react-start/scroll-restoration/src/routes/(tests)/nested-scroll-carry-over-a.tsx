import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(tests)/nested-scroll-carry-over-a')({
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
        <div key={i}>Source row {i}</div>
      ))}
    </div>
  )
}

function Component() {
  return (
    <div className="grid gap-4 p-2">
      <h3>nested-scroll-carry-over-a</h3>
      <Link
        to="/nested-scroll-carry-over-b"
        data-testid="nested-scroll-carry-over-link"
      >
        Go to target
      </Link>

      <ScrollBox
        restorationId="carry-over-preserved"
        testId="carry-over-preserved"
      />
      <ScrollBox restorationId="carry-over-reset" testId="carry-over-reset" />
      <ScrollBox
        restorationId="carry-over-source-only"
        testId="carry-over-source-only"
      />
    </div>
  )
}
