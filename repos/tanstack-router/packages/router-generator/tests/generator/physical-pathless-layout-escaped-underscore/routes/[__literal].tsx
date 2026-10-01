import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/__literal')({
  component: () => 'Literal Double Underscore',
})
