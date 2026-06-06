import { Languages } from 'lucide-react'
import { type Lang, useI18n } from '../i18n'

type LanguageSelectProps = {
  className?: string
}

export function LanguageSelect({ className = 'btn-ghost-sm' }: LanguageSelectProps) {
  const { lang, languages, setLanguage } = useI18n()

  return (
    <label className={`language-select ${className}`} title="Switch language">
      <Languages size={14} />
      <select
        aria-label="Switch language"
        value={lang}
        onChange={(event) => setLanguage(event.target.value as Lang)}
      >
        {languages.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  )
}
