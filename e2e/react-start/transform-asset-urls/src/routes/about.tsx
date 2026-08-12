import { createFileRoute } from '@tanstack/react-router'
import styles from './about.module.css'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <div data-testid="about-card" className={styles.aboutCard}>
      <h1 data-testid="about-heading" className={styles.title}>
        About
      </h1>
      <p data-testid="about-content" className={styles.content}>
        This route is loaded on client navigation.
      </p>
    </div>
  )
}
