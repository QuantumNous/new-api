import { createFileRoute } from '@tanstack/vue-router'
import '~/styles/global.css'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div>
      <h1>CSS Collection Test - Global CSS</h1>
      <p>This page tests that global CSS is collected and served during SSR.</p>

      <div class="global-container" data-testid="global-styled">
        <div class="global-title" data-testid="global-title">
          Global CSS Applied
        </div>
        <div class="global-description" data-testid="global-description">
          This container should have a blue background, white text, and rounded
          corners even with JavaScript disabled.
        </div>
      </div>
    </div>
  )
}
