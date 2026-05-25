import { useTranslation } from 'react-i18next'
import { DocCallout } from '../components/doc-callout'
import { DocCodeBlock } from '../components/doc-code-block'
import { DocPageHeader, DocSection, DocStepList } from '../components/doc-section'
import { FACEAPI_BASE_URL } from '../constants'

const CODEX_CONFIG = `model = "o3"
model_provider = "openai-chat-completions"

[model_providers.openai-chat-completions]
name = "FaceCloud"
base_url = "${FACEAPI_BASE_URL}/v1"
env_key = "FACEAPI_API_KEY"
wire_api = "chat"`

const CODEX_ENV = `export FACEAPI_API_KEY="sk-xxxx"`

export function CodexPage() {
  const { t } = useTranslation()

  return (
    <article className='space-y-10'>
      <DocPageHeader
        title={t('Codex')}
        description={t(
          'Configure OpenAI Codex CLI to use FaceCloud via OpenAI-compatible chat completions.'
        )}
      />

      <DocCallout variant='info' title={t('Note')}>
        {t(
          'Codex uses TOML configuration at ~/.codex/config.toml and reads the API key from the FACEAPI_API_KEY environment variable.'
        )}
      </DocCallout>

      <DocSection title={t('Set your API key')}>
        <DocCodeBlock code={CODEX_ENV} filename='~/.bashrc or ~/.zshrc' language='bash' />
        <p className='text-muted-foreground text-sm'>
          {t('Reload your shell or run source on the file after exporting the variable.')}
        </p>
      </DocSection>

      <DocSection title={t('Configure Codex')}>
        <DocStepList
          steps={[
            <>
              <p>
                {t('Create or edit')}{' '}
                <code className='bg-muted rounded px-1 font-mono text-sm'>
                  ~/.codex/config.toml
                </code>
                .
              </p>
            </>,
            <>
              <p>{t('Add the FaceCloud provider configuration:')}</p>
              <DocCodeBlock
                code={CODEX_CONFIG}
                filename='~/.codex/config.toml'
                language='toml'
              />
            </>,
            <p key='run'>
              {t('Start Codex and select the FaceCloud provider. Adjust model to one available on your account.')}
            </p>,
          ]}
        />
      </DocSection>

      <DocSection title={t('Configuration reference')}>
        <ul className='text-muted-foreground list-disc space-y-2 ps-5'>
          <li>
            <code className='text-foreground font-mono text-sm'>base_url</code> —{' '}
            {t('OpenAI-compatible endpoint at {{url}}', {
              url: `${FACEAPI_BASE_URL}/v1`,
            })}
          </li>
          <li>
            <code className='text-foreground font-mono text-sm'>env_key</code> —{' '}
            {t('Environment variable holding your API key')}
          </li>
          <li>
            <code className='text-foreground font-mono text-sm'>wire_api</code> —{' '}
            {t('Use chat completions wire format')}
          </li>
        </ul>
      </DocSection>
    </article>
  )
}
