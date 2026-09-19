import { Outlet, createFileRoute } from '@tanstack/react-router'
import z from 'zod'

export const Route = createFileRoute('/not-found/deep')({
  validateSearch: z.object({
    throwAt: z.enum(['b', 'c', 'd']).optional(),
  }),
  component: () => <Outlet />,
})
