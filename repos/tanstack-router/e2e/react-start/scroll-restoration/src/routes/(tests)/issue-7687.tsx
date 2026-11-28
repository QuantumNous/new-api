import { Link, Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(tests)/issue-7687')({
  component: Component,
})

function Component() {
  return (
    <div className="grid gap-4 p-2">
      <nav className="fixed top-2 right-2 z-50 flex gap-2 rounded border bg-white p-2 dark:bg-black">
        <Link to="/issue-7687" data-testid="issue-7687-list-link">
          List
        </Link>
        <Link to="/issue-7687/detail" data-testid="issue-7687-detail-link">
          Detail
        </Link>
        <Link
          to="/issue-7687/detail"
          resetScroll={false}
          data-testid="issue-7687-detail-no-reset-link"
        >
          Detail without reset
        </Link>
      </nav>

      <div
        id="issue-7687-scroller"
        data-scroll-restoration-id="issue-7687-scroller"
        data-testid="issue-7687-scroller"
        className="h-48 overflow-auto rounded border p-2"
      >
        <Outlet />
      </div>

      <div
        id="issue-7687-stale-selector"
        data-scroll-restoration-id="issue-7687-stale-source"
        data-testid="issue-7687-stale-selector"
        className="h-24 overflow-auto rounded border p-2"
      >
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i}>Stale selector row {i}</div>
        ))}
      </div>

      <div aria-hidden className="h-[1600px]" />
    </div>
  )
}
