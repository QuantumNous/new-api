import styles from './conditionalOrange.module.css'

export function ConditionalOrangePanel() {
  return (
    <section
      className={styles.panel}
      data-testid="rsc-conditional-orange-panel"
    >
      <span className={styles.label} data-testid="rsc-conditional-orange-label">
        ORANGE VARIANT
      </span>
      <p data-testid="rsc-conditional-orange-copy">
        This branch renders only the orange module.
      </p>
    </section>
  )
}
