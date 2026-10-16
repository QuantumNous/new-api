import { createFileRoute } from '@tanstack/react-router'

// Physical about route - conflicts with virtual about.tsx -> /about
export const Route = createFileRoute('/about')({
  component: () => <div>About (physical)</div>,
})
