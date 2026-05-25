import { useTranslation } from 'react-i18next'
import { DocCallout } from '../components/doc-callout'
import { DocCodeBlock } from '../components/doc-code-block'
import { DocPageHeader, DocSection, DocStepList } from '../components/doc-section'
import { FACEAPI_BASE_URL } from '../constants'

const OPENCODE_CONFIG = `{
  "providers": {
    "facecloud": {
      "baseURL": "${FACEAPI_BASE_URL}/v1",
      "apiKey": "sk-xxxx"
    }
  },
  "defaultProvider": "facecloud"
}`

export function OpenCodePage() {
  const { t } = useTranslation()

  return (
    <article className='space-y-10'>
      <DocPageHeader
        title={t('OpenCode')}
        description={t(
          'Add FaceCloud as a custom OpenAI-compatible provider in OpenCode.'
        )}
      />

      <DocCallout title={t('Note')}>
        {t(
          'OpenCode configuration lives at ~/.config/opencode/opencode.json. You can also authenticate interactively with opencode auth login.'
        )}
      </DocCallout>

      <DocSection title={t('Manual configuration')}>
        <DocStepList
          steps={[
            <>
              <p>
                {t('Create the config directory if it does not exist:')}{' '}
                <code className='bg-muted rounded px-1 font-mono text-sm'>
                  ~/.config/opencode/
                </code>
              </p>
            </>,
            <>
              <p>{t('Edit opencode.json with the FaceCloud provider:')}</p>
              <DocCodeBlock
                code={OPENCODE_CONFIG}
                filename='~/.config/opencode/opencode.json'
                language='json'
              />
            </>,
            <>
              <p>
                {t('Replace')}{' '}
                <code className='bg-muted rounded px-1 font-mono text-sm'>
                  sk-xxxx
                </code>{' '}
                {t('with your FaceCloud API key.')}
              </p>
            </>,
            <p key='launch'>{t('Launch OpenCode and verify that requests route through FaceCloud.')}</p>,
          ]}
        />
      </DocSection>

      <DocSection title={t('Interactive login')}>
        <p className='text-muted-foreground leading-relaxed'>
          {t(
            'Alternatively, run opencode auth login and choose to add a custom provider. Set the provider id to facecloud, base URL to the FaceCloud /v1 endpoint, and paste your API key when prompted.'
          )}
        </p>
        <DocCodeBlock
          code={`opencode auth login\n# Provider id: facecloud\n# Base URL: ${FACEAPI_BASE_URL}/v1\n# API key: sk-xxxx`}
          language='bash'
        />
      </DocSection>
    </article>
  )
}
