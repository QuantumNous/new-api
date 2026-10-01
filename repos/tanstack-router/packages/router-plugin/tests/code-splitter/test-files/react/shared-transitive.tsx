import { createFileRoute } from '@tanstack/react-router'

const BASE_URL = 'https://api.example.com'
const config = { url: BASE_URL, timeout: 5000 }
const fetcher = (path: string) => fetch(`${config.url}${path}`)

export const Route = createFileRoute('/api')({
  loader: async () => {
    return fetcher('/data')
  },
  component: () => <div>Timeout: {config.timeout}</div>,
})
