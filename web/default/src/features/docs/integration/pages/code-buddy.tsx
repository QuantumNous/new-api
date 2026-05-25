import { useTranslation } from 'react-i18next'
import { DocCallout } from '../components/doc-callout'
import { DocCodeBlock } from '../components/doc-code-block'
import { DocPageHeader, DocSection, DocStepList } from '../components/doc-section'
import { FACEAPI_BASE_URL } from '../constants'

const CODEBUDDY_SHELL = `export CODEBUDDY_API_KEY="sk-xxxx"
export CODEBUDDY_BASE_URL="${FACEAPI_BASE_URL}/v1"
codebuddy --model your-model-name`

const CODEBUDDY_SETTINGS = `{
  "env": {
    "CODEBUDDY_API_KEY": "sk-xxxx",
    "CODEBUDDY_BASE_URL": "${FACEAPI_BASE_URL}/v1"
  }
}`

export function CodeBuddyPage() {
  const { t } = useTranslation()

  return (
    <article className='space-y-10'>
      <DocPageHeader
        title={t('Code Buddy')}
        description={t(
          'Connect Tencent CodeBuddy CLI to FaceCloud using environment variables or settings.json.'
        )}
      />

      <DocCallout title={t('Note')}>
        {t(
          'CodeBuddy reads CODEBUDDY_API_KEY and CODEBUDDY_BASE_URL to locate the API. Replace your-model-name with a model enabled on your FaceCloud account.'
        )}
      </DocCallout>

      <DocSection title={t('Shell environment')}>
        <DocStepList
          steps={[
            <>
              <p>{t('Export the following variables in your terminal or shell profile:')}</p>
              <DocCodeBlock code={CODEBUDDY_SHELL} language='bash' />
            </>,
            <>
              <p>
                {t('Replace')}{' '}
                <code className='bg-muted rounded px-1 font-mono text-sm'>
                  sk-xxxx
                </code>{' '}
                {t('and your-model-name with your API key and desired model.')}
              </p>
            </>,
            <p key='run'>{t('Run codebuddy from the same shell session to use FaceCloud.')}</p>,
          ]}
        />
      </DocSection>

      <DocSection title={t('settings.json (optional)')}>
        <p className='text-muted-foreground mb-4 leading-relaxed'>
          {t(
            'If CodeBuddy supports a settings.json env block (similar to Claude Code), you can persist configuration:'
          )}
        </p>
        <DocCodeBlock
          code={CODEBUDDY_SETTINGS}
          filename='settings.json'
          language='json'
        />
      </DocSection>

      <DocSection title={t('Environment variables')}>
        <ul className='text-muted-foreground list-disc space-y-2 ps-5'>
          <li>
            <code className='text-foreground font-mono text-sm'>
              CODEBUDDY_API_KEY
            </code>{' '}
            — {t('Your FaceCloud API key')}
          </li>
          <li>
            <code className='text-foreground font-mono text-sm'>
              CODEBUDDY_BASE_URL
            </code>{' '}
            — {t('OpenAI-compatible base URL at {{url}}', {
              url: `${FACEAPI_BASE_URL}/v1`,
            })}
          </li>
        </ul>
      </DocSection>
    </article>
  )
}
