import { useTranslation } from 'react-i18next'
import { DocCallout } from '../components/doc-callout'
import { DocCodeBlock } from '../components/doc-code-block'
import { DocPageHeader, DocSection, DocStepList } from '../components/doc-section'
import { FACEAPI_BASE_URL } from '../constants'

const GEMINI_ENV = `GOOGLE_GEMINI_BASE_URL=${FACEAPI_BASE_URL}/gemini
GEMINI_API_KEY=sk-xxxx
GEMINI_MODEL=gemini-2.5-flash`

export function GeminiCliPage() {
  const { t } = useTranslation()

  return (
    <article className='space-y-10'>
      <DocPageHeader
        title={t('Gemini CLI')}
        description={t(
          'Point the Google Gemini CLI at FaceCloud for Gemini-compatible API requests.'
        )}
      />

      <DocCallout title={t('Note')}>
        {t(
          'Gemini CLI loads environment variables from ~/.env by default. You can also export them in your shell profile.'
        )}
      </DocCallout>

      <DocSection title={t('Configure environment')}>
        <DocStepList
          steps={[
            <>
              <p>
                {t('Create or edit')}{' '}
                <code className='bg-muted rounded px-1 font-mono text-sm'>~/.env</code>{' '}
                {t('in your home directory.')}
              </p>
            </>,
            <>
              <p>{t('Add the following variables:')}</p>
              <DocCodeBlock code={GEMINI_ENV} filename='~/.env' language='env' />
            </>,
            <>
              <p>
                {t('Replace')}{' '}
                <code className='bg-muted rounded px-1 font-mono text-sm'>
                  sk-xxxx
                </code>{' '}
                {t('with your FaceCloud API key and set GEMINI_MODEL to a model your account supports.')}
              </p>
            </>,
            <p key='test'>{t('Run the Gemini CLI and send a test prompt to confirm connectivity.')}</p>,
          ]}
        />
      </DocSection>

      <DocSection title={t('Environment variables')}>
        <ul className='text-muted-foreground list-disc space-y-2 ps-5'>
          <li>
            <code className='text-foreground font-mono text-sm'>
              GOOGLE_GEMINI_BASE_URL
            </code>{' '}
            — {t('FaceCloud Gemini-compatible base URL')}
          </li>
          <li>
            <code className='text-foreground font-mono text-sm'>GEMINI_API_KEY</code> —{' '}
            {t('Your FaceCloud API key')}
          </li>
          <li>
            <code className='text-foreground font-mono text-sm'>GEMINI_MODEL</code> —{' '}
            {t('Default model name for requests')}
          </li>
        </ul>
      </DocSection>
    </article>
  )
}
