import { createFileRoute } from '@tanstack/react-router'

function defaultLoader() {
  return { message: 'default' }
}

function DefaultComponent() {
  return <div>Default</div>
}

const createBits = () => ({
  component: ActualComponent,
  loader: () => ({
    message: 'hello',
  }),
})

const { component: MyComponent = DefaultComponent, loader = defaultLoader } =
  createBits()

function ActualComponent() {
  return <div>About</div>
}

export const Route = createFileRoute('/about')({
  component: MyComponent,
  loader,
})
