import { useState, useEffect, useMemo } from 'react'
import { useI18n } from '../i18n'
import { api } from '../lib/api'
import { sanitizeHtml } from '../lib/sanitize'

export function About() {
  const { t } = useI18n()
  const [rawContent, setRawContent] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<string>('/api/about')
      .then((data) => {
        setRawContent(typeof data === 'string' ? data : '')
      })
      .catch(() => setRawContent(''))
      .finally(() => setLoading(false))
  }, [])

  const safeContent = useMemo(() => sanitizeHtml(rawContent), [rawContent])

  return (
    <div className="page-container">
      <h1 className="page-title">{t('about.title')}</h1>
      {loading ? (
        <div className="page-loading"><div className="spinner" /></div>
      ) : (
        <div
          className="about-content"
          dangerouslySetInnerHTML={{ __html: safeContent }}
        />
      )}
    </div>
  )
}
