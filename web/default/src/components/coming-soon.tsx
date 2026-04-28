import { Telescope } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function ComingSoon() {
  const { t } = useTranslation()
  return (
    <div className='h-svh'>
      <div className='m-auto flex h-full w-full flex-col items-center justify-center gap-2'>
        <Telescope size={72} />
        <h1 className='text-4xl leading-tight font-bold'>
          {t('Coming Soon!')}
        </h1>
        <p className='text-muted-foreground text-center'>
          {t('This page has not been created yet.')} <br />
          {t('Stay tuned though!')}
        </p>
      </div>
    </div>
  )
}
