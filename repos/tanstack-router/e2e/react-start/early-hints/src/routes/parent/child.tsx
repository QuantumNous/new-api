/// <reference types="vite/client" />
import { createFileRoute, Outlet } from '@tanstack/react-router'
import childCss from '../../styles/child.css?url'
import styles from '../../styles/child.module.css'

export const Route = createFileRoute('/parent/child')({
  head: () => ({
    links: [{ rel: 'stylesheet', href: childCss }],
  }),
  beforeLoad: async () => {
    await new Promise((resolve) => setTimeout(resolve, 10))
    return { childData: 'from-child-beforeLoad' }
  },
  loader: async () => {
    await new Promise((resolve) => setTimeout(resolve, 10))
    return { childLoaderData: 'child-loader-result' }
  },
  component: ChildComponent,
})

function ChildComponent() {
  const { childLoaderData } = Route.useLoaderData()
  return (
    <div className={`child-container ${styles.container}`} data-testid="child">
      <h3 className={`child-title ${styles.title}`}>Child Route</h3>
      <p data-testid="child-data">{childLoaderData}</p>
      <Outlet />
    </div>
  )
}
