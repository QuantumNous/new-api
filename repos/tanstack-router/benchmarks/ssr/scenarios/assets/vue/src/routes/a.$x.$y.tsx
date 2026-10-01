import { createFileRoute } from '@tanstack/vue-router'
import '../styles/assets-leaf.css'

export const Route = createFileRoute('/a/$x/$y')({
  head: ({ params }) => ({
    meta: [{ title: `SSR Assets ${params.x} ${params.y}` }],
    links: Array.from({ length: 3 }, (_, index) => ({
      rel: 'preload',
      as: 'image',
      href: `/asset-preload/${params.y}-${index}.png`,
    })),
  }),
  component: LeafComponent,
})

function LeafComponent() {
  const params = Route.useParams()

  return (
    <section class="assets-leaf">
      <p>
        assets-leaf-{params.value.x}-{params.value.y}
      </p>
    </section>
  )
}
