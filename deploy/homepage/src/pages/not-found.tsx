import { useI18n } from '../i18n'

export function NotFound() {
  const { t } = useI18n()

  return (
    <div className="not-found-page">
      <div className="not-found-content">
        <h1 className="not-found-code">404</h1>
        <h2 className="not-found-title">{t('notFound.title')}</h2>
        <p className="not-found-message">{t('notFound.message')}</p>
        <a href="/" className="btn-primary">{t('notFound.home')}</a>
      </div>
    </div>
  )
}
