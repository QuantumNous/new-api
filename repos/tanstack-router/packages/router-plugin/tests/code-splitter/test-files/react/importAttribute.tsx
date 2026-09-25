import { createFileRoute } from '@tanstack/react-router'

import { test } from './test' with { type: 'macro' }

export const Route = createFileRoute('/')({
  component: () => test,
})
