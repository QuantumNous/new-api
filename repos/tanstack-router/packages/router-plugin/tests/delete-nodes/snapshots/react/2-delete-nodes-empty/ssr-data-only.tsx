import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  ssr: 'data-only',
  component: () => {
    return <div className="p-2">hello world</div>
  },
})
