import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomeRoute,
})

function HomeRoute() {
  return (
    <section>
      <h1>Start manifest fixture</h1>
      <p data-testid="home-copy">
        Use this page to navigate between CSS module routes.
      </p>
    </section>
  )
}
