import { createFileRoute } from '@tanstack/react-router'

const getConfig = () => ({
  api: {
    baseUrl: 'https://api.example.com',
  },
  timeout: 5000,
  extra: 'data',
})

export const {
  api: { baseUrl },
  ...rest
} = getConfig()

export const Route = createFileRoute('/about')({
  component: AboutComponent,
})

function AboutComponent() {
  return (
    <div>
      <p>Base URL: {baseUrl}</p>
    </div>
  )
}
