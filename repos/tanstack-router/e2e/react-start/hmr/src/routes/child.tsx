import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/child')({
  component: Child,
  beforeLoad: () => ({
    greeting: 'Hello',
  }),
  loader: () => ({
    crumb: 'Child',
  }),
})

function Child() {
  const context = Route.useRouteContext()
  return (
    <main className="hmr-card flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="hmr-label">Child route</p>
          <p
            className="mt-2 text-2xl font-bold text-[var(--color-night)]"
            data-testid="child"
          >
            child
          </p>
        </div>
        <span className="hmr-kbd">loader + beforeLoad</span>
      </div>
      {context.greeting ? (
        <div className="hmr-stat">
          <p className="hmr-label">Greeting</p>
          <p
            className="mt-2 text-lg font-semibold text-[var(--color-night)]"
            data-testid="child-greeting"
          >
            {context.greeting}
          </p>
        </div>
      ) : null}
    </main>
  )
}
