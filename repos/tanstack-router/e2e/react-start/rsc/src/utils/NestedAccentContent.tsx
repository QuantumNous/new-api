import styles from './nestedAccent.module.css'

export function NestedAccentContent() {
  return (
    <section className={styles.accentBox} data-testid="rsc-css-nested-accent">
      <div
        className={styles.accentTitle}
        data-testid="rsc-css-nested-accent-title"
      >
        Nested Accent Module
      </div>
      <p data-testid="rsc-css-nested-accent-copy">
        This nested server component owns a second CSS module.
      </p>
    </section>
  )
}
