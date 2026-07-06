import { createFileRoute, redirect } from '@tanstack/react-router'

// Legacy path — Model Data was renamed to Channel Data. Redirect old
// bookmarks/console links so they keep working.
export const Route = createFileRoute('/_authenticated/model-data/')({
  beforeLoad: () => {
    throw redirect({ to: '/channel-data' })
  },
})
