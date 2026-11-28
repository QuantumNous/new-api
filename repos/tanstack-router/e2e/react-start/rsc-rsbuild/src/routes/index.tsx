import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <main>
      <h1>Rsbuild RSC fixture</h1>
      <Link to="/rsc-node-module-client">Node module client component</Link>
    </main>
  )
}
