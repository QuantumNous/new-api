import styles from '~/styles/shared-card.module.css'

export function SharedCard({ label }: { label: string }) {
  return (
    <div className={styles.card} data-testid="shared-card">
      Shared card {label}
    </div>
  )
}
