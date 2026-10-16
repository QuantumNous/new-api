import { createFileRoute } from '@tanstack/react-router'

const createBits = () => ({
  component: AboutComponentImpl,
  loader: () => ({
    message: 'hello',
  }),
})

export const { component: AboutComponent, loader } = createBits()

function AboutComponentImpl() {
  return <div>About</div>
}

export const Route = createFileRoute('/about')({
  component: AboutComponent,
  loader,
})
