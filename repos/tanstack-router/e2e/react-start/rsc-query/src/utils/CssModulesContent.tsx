/// <reference types="vite/client" />
/// <reference types="@vitejs/plugin-rsc/types" />
import styles from './serverComponent.module.css'

export function CssModulesContent({ data }: { data: { title?: string } }) {
  const serverTimestamp = Date.now()

  const features = [
    { id: 1, icon: '✓', text: 'Scoped class names prevent conflicts' },
    { id: 2, icon: '✓', text: 'Works seamlessly in server components' },
    { id: 3, icon: '✓', text: 'CSS is extracted and optimized' },
    { id: 4, icon: '✓', text: 'Full IDE support with TypeScript' },
  ]

  return (
    <div className={styles.container} data-testid="rsc-css-modules-content">
      <div className={styles.header}>
        <span className={styles.badge} data-testid="rsc-css-modules-badge">
          SERVER RENDERED
        </span>
        <span
          className={styles.timestamp}
          data-testid="rsc-css-modules-timestamp"
        >
          Fetched: {new Date(serverTimestamp).toLocaleTimeString()}
        </span>
      </div>

      <h2 className={styles.title} data-testid="rsc-css-modules-title">
        {data.title || 'CSS Modules in RSC'}
      </h2>

      <p className={styles.description}>
        This server component uses CSS Modules for styling. The class names are
        automatically scoped to prevent conflicts with other styles.
      </p>

      <ul className={styles.featureList} data-testid="rsc-css-modules-features">
        {features.map((feature) => (
          <li
            key={feature.id}
            className={styles.featureItem}
            data-testid={`rsc-css-modules-feature-${feature.id}`}
          >
            <span className={styles.featureIcon}>{feature.icon}</span>
            <span>{feature.text}</span>
          </li>
        ))}
      </ul>

      <div className={styles.footer}>
        Component ID: css-mod-{Math.random().toString(36).slice(2, 8)}
      </div>
    </div>
  )
}
