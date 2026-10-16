import { createFileRoute } from '@tanstack/react-router'

const isProd = import.meta.env.PROD

export const Route = createFileRoute('/scripts')({
  head: () => ({
    scripts: [
      {
        src: 'script.js',
      },
      isProd
        ? undefined
        : {
            src: 'script2.js',
          },
    ],
  }),
  component: ScriptsComponent,
})

function ScriptsComponent() {
  return (
    <div className="p-2">
      <h3 data-testid="scripts-test-heading">Scripts Test</h3>
      <p>
        Both `script.js` and `script2.js` are included in development, but only
        `script.js` is included in production.
      </p>
    </div>
  )
}
