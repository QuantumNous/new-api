import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/inline-scripts')({
  head: () => ({
    scripts: [
      {
        children:
          'window.INLINE_SCRIPT_1 = true; console.log("Inline script 1 executed");',
      },
      {
        children:
          'window.INLINE_SCRIPT_2 = "test"; console.log("Inline script 2 executed");',
        type: 'text/javascript',
      },
    ],
  }),
  component: InlineScriptsComponent,
})

function InlineScriptsComponent() {
  return (
    <div className="p-2">
      <h3 data-testid="inline-scripts-test-heading">Inline Scripts Test</h3>
      <p>
        This route tests inline script duplication prevention. Two inline
        scripts should be loaded.
      </p>
    </div>
  )
}
