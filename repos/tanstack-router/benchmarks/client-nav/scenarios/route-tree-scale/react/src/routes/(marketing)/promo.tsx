import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(marketing)/promo')({
  component: Page,
})

function Page() {
  return <div data-testid="scale-state">promo</div>
}
