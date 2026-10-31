import styles from '~/styles/shared-widget.module.css'

export function SharedWidget() {
  return (
    <div className={styles.widget} data-testid="shared-widget">
      <div className={styles.title} data-testid="shared-widget-title">
        Shared widget styles
      </div>
      <div className={styles.content} data-testid="shared-widget-content">
        This widget uses CSS shared by a static route and a lazy route.
      </div>
    </div>
  )
}
