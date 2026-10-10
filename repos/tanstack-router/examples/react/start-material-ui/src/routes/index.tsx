import { createFileRoute } from '@tanstack/react-router'
import { Stack, Typography } from '@mui/material'
import z from 'zod'
import { Counter } from '~/components/Counter'

export const Route = createFileRoute('/')({
  validateSearch: z.object({
    count: z.number().optional(),
  }),
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <Stack alignItems="center">
      <Typography variant="h1" marginBlockEnd={4}>
        Hello world!
      </Typography>
      <Counter />
    </Stack>
  )
}
