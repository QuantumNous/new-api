/// <reference types="vite/client" />
import { createFileRoute, Outlet } from '@tanstack/react-router'
import otherCss from '../styles/other.css?url'
import styles from '../styles/other.module.css'

export const Route = createFileRoute('/other')({
  head: () => ({
    links: [{ rel: 'stylesheet', href: otherCss }],
  }),
  beforeLoad: async () => {
    await new Promise((resolve) => setTimeout(resolve, 10))
    return { otherData: 'from-other-beforeLoad' }
  },
  loader: async () => {
    await new Promise((resolve) => setTimeout(resolve, 10))
    return { otherLoaderData: 'other-loader-result' }
  },
  component: OtherComponent,
})

function OtherComponent() {
  const { otherLoaderData } = Route.useLoaderData()
  return (
    <div className={`other-container ${styles.container}`} data-testid="other">
      <h2 className={`other-title ${styles.title}`}>Other Route</h2>
      <p data-testid="other-data">{otherLoaderData}</p>
      <Outlet />
    </div>
  )
}
