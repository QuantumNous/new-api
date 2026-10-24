/// <reference types="vite/client" />
import { createFileRoute } from '@tanstack/react-router'
import grandchildCss from '../../../styles/grandchild.css?url'
import styles from '../../../styles/grandchild.module.css'

export const Route = createFileRoute('/parent/child/grandchild')({
  head: () => ({
    links: [{ rel: 'stylesheet', href: grandchildCss }],
  }),
  beforeLoad: async () => {
    await new Promise((resolve) => setTimeout(resolve, 10))
    return { grandchildData: 'from-grandchild-beforeLoad' }
  },
  loader: async () => {
    await new Promise((resolve) => setTimeout(resolve, 10))
    return { grandchildLoaderData: 'grandchild-loader-result' }
  },
  component: GrandchildComponent,
})

function GrandchildComponent() {
  const { grandchildLoaderData } = Route.useLoaderData()
  return (
    <div
      className={`grandchild-container ${styles.container}`}
      data-testid="grandchild"
    >
      <h4 className={`grandchild-title ${styles.title}`}>Grandchild Route</h4>
      <p data-testid="grandchild-data">{grandchildLoaderData}</p>
    </div>
  )
}
