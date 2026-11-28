import styles from '~/styles/nested-panel.module.css'

export function NestedPanel({ label }: { label: string }) {
  return (
    <section className={styles.panel} data-testid="nested-panel">
      <strong className={styles.label}>{label}</strong>
    </section>
  )
}
