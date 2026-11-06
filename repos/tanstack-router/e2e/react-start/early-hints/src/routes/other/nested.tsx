/// <reference types="vite/client" />
import { createFileRoute } from '@tanstack/react-router'
import nestedCss from '../../styles/nested.css?url'
import styles from '../../styles/nested.module.css'

export const Route = createFileRoute('/other/nested')({
  head: () => ({
    links: [{ rel: 'stylesheet', href: nestedCss }],
  }),
  beforeLoad: async () => {
    await new Promise((resolve) => setTimeout(resolve, 10))
    return { nestedData: 'from-nested-beforeLoad' }
  },
  loader: async () => {
    await new Promise((resolve) => setTimeout(resolve, 10))
    return { nestedLoaderData: 'nested-loader-result' }
  },
  component: NestedComponent,
})

function NestedComponent() {
  const { nestedLoaderData } = Route.useLoaderData()
  return (
    <div
      className={`nested-container ${styles.container}`}
      data-testid="nested"
    >
      <h3 className={`nested-title ${styles.title}`}>
        Nested Route (under Other)
      </h3>
      <p data-testid="nested-data">{nestedLoaderData}</p>
    </div>
  )
}
