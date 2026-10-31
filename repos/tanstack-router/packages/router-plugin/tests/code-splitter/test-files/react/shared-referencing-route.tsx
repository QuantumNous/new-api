import { createFileRoute } from '@tanstack/react-router'

const HEADER = 'Page'

function usePageTitle() {
  return `${HEADER} - ${Route.fullPath}`
}

export const Route = createFileRoute('/about')({
  loader: async () => {
    const title = usePageTitle()
    return { title }
  },
  component: () => {
    const title = usePageTitle()
    return <div>{title}</div>
  },
})
