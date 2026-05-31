import { useI18n } from '../i18n'

export function Footer() {
  const { t } = useI18n()

  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="footer-mark">V</span>
          Vynex API
        </div>
        <div className="footer-links">
          <a href="/docs/">{t('footer.docs')}</a>
          <span className="footer-divider" />
          <a href="/pricing">{t('footer.pricing')}</a>
          <span className="footer-divider" />
          <a href="/sign-in">{t('footer.console')}</a>
        </div>
      </div>
    </footer>
  )
}
