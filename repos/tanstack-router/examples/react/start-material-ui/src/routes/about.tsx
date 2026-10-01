import { createFileRoute } from '@tanstack/react-router'
import { Typography } from '@mui/material'

export const Route = createFileRoute('/about')({
  component: RouteComponent,
})

function RouteComponent() {
  return <Typography variant="h2">About</Typography>
}
