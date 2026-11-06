import { Outlet, createFileRoute } from '@tanstack/react-router'
import '../styles/assets-a.css'

export const Route = createFileRoute('/a/$x')({
  head: ({ params }) => ({
    meta: [{ title: `SSR Assets ${params.x}` }],
    links: Array.from({ length: 2 }, (_, index) => ({
      rel: 'preload',
      as: 'image',
      href: `/asset-preload/${params.x}-${index}.png`,
    })),
  }),
  component: LevelAComponent,
})

function LevelAComponent() {
  const { x } = Route.useParams()

  return (
    <section className="assets-level-a">
      <p>assets-level-a-{x}</p>
      <Outlet />
    </section>
  )
}
