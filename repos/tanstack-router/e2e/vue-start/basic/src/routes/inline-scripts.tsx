import { createFileRoute } from '@tanstack/vue-router'

export const Route = createFileRoute('/inline-scripts')({
  head: () => ({
    scripts: [
      {
        children: `window.INLINE_SCRIPT_1 = true`,
      },
      {
        children: `window.INLINE_SCRIPT_2 = "test"`,
      },
    ],
  }),
  component: InlineScriptsComponent,
})

function InlineScriptsComponent() {
  return (
    <div class="p-2">
      <h3 data-testid="inline-scripts-test-heading">Inline Scripts Test</h3>
      <p>Check console for inline script logs.</p>
    </div>
  )
}
