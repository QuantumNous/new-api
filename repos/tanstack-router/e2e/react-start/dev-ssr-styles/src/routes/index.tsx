import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div>
      <h1 data-testid="home-heading">Dev SSR Styles Test</h1>
      <div className="styled-box" data-testid="styled-box">
        This box should have a blue background when dev styles are enabled.
      </div>
    </div>
  )
}
