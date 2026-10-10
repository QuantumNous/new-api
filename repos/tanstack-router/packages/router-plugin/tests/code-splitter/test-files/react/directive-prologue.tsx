'use client'

import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/directive')({
  component: () => {
    return <div>directive preserved</div>
  },
})
