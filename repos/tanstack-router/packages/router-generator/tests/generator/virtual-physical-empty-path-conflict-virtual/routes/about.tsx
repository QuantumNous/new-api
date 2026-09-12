import { createFileRoute } from '@tanstack/react-router'

// Virtual about route - conflicts with merged/about.tsx
export const Route = createFileRoute('/about')({
  component: () => <div>About (virtual)</div>,
})
