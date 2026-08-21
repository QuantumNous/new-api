import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/async-scripts')({
  head: () => ({
    scripts: [
      {
        src: 'script.js',
        async: true,
      },
      {
        src: 'script2.js',
        defer: true,
      },
    ],
  }),
  component: AsyncScriptsComponent,
})

function AsyncScriptsComponent() {
  return (
    <div className="p-2">
      <h3 data-testid="async-scripts-test-heading">Async Scripts Test</h3>
      <p>This page tests scripts with async and defer attributes.</p>
    </div>
  )
}
