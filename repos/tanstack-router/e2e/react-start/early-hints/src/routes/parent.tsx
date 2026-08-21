/// <reference types="vite/client" />
import { createFileRoute, Outlet } from '@tanstack/react-router'
import parentCss from '../styles/parent.css?url'
import styles from '../styles/parent.module.css'

export const Route = createFileRoute('/parent')({
  head: () => ({
    links: [{ rel: 'stylesheet', href: parentCss }],
  }),
  beforeLoad: async () => {
    // Simulate some async work in beforeLoad
    await new Promise((resolve) => setTimeout(resolve, 10))
    return { parentData: 'from-beforeLoad' }
  },
  loader: async () => {
    // Simulate loading data
    await new Promise((resolve) => setTimeout(resolve, 10))
    return { parentLoaderData: 'parent-loader-result' }
  },
  component: ParentComponent,
})

function ParentComponent() {
  const { parentLoaderData } = Route.useLoaderData()
  return (
    <div
      className={`parent-container ${styles.container}`}
      data-testid="parent"
    >
      <h2 className={`parent-title ${styles.title}`}>Parent Route</h2>
      <p data-testid="parent-data">{parentLoaderData}</p>
      <Outlet />
    </div>
  )
}
