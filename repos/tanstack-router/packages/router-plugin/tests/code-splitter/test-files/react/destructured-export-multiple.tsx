import { createFileRoute } from '@tanstack/react-router'

export const getConfig = () => ({
  baseUrl: 'https://api.example.com',
  timeout: 5000,
})

export const { baseUrl, timeout } = getConfig()

export const [first, second] = [1, 2]

export const Route = createFileRoute('/about')({
  component: AboutComponent,
})

function AboutComponent() {
  return (
    <div>
      <p>Base URL: {baseUrl}</p>
      <p>Timeout: {timeout}</p>
    </div>
  )
}
