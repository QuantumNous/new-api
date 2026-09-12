import styles from './conditionalViolet.module.css'

export function ConditionalVioletPanel() {
  return (
    <section
      className={styles.panel}
      data-testid="rsc-conditional-violet-panel"
    >
      <span className={styles.label} data-testid="rsc-conditional-violet-label">
        VIOLET VARIANT
      </span>
      <p data-testid="rsc-conditional-violet-copy">
        This branch renders only the violet module.
      </p>
    </section>
  )
}
