import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <div>
      <h1 data-testid="about-heading">About Page</h1>
      <p data-testid="about-content">This is the about page.</p>
    </div>
  )
}
