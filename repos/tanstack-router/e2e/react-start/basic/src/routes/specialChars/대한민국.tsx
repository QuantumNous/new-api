import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/specialChars/대한민국')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div data-testid="special-non-latin-heading">
      Hello "/specialChars/대한민국"!
    </div>
  )
}
