import { useTranslation } from 'react-i18next'
import { DocCallout } from '../components/doc-callout'
import { DocCodeBlock } from '../components/doc-code-block'
import { DocPageHeader, DocSection, DocStepList } from '../components/doc-section'
import { FACEAPI_BASE_URL } from '../constants'

const CLAUDE_SETTINGS = `{
  "env": {
    "ANTHROPIC_BASE_URL": "${FACEAPI_BASE_URL}",
    "ANTHROPIC_AUTH_TOKEN": "sk-xxxx",
    "CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS": "1",
    "CLAUDE_CODE_ATTRIBUTION_HEADER": "0"
  }
}`

export function ClaudeCodePage() {
  const { t } = useTranslation()

  return (
    <article className='space-y-10'>
      <DocPageHeader
        title={t('Claude Code')}
        description={t(
          'Use FaceCloud as the Anthropic API endpoint for Claude Code CLI in your terminal.'
        )}
      />

      <DocCallout title={t('Note')}>
        {t(
          'Claude Code reads configuration from ~/.claude/settings.json. Restart the CLI after saving changes.'
        )}
      </DocCallout>

      <DocSection title={t('Install Claude Code')}>
        <DocCodeBlock
          code='npm install -g @anthropic-ai/claude-code'
          language='bash'
        />
      </DocSection>

      <DocSection title={t('Configure FaceCloud')}>
        <DocStepList
          steps={[
            <>
              <p>
                {t('Create or edit')}{' '}
                <code className='bg-muted rounded px-1 font-mono text-sm'>
                  ~/.claude/settings.json
                </code>
                .
              </p>
            </>,
            <>
              <p>{t('Add the following environment variables:')}</p>
              <DocCodeBlock
                code={CLAUDE_SETTINGS}
                filename='~/.claude/settings.json'
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
            <p key='verify'>{t('Run claude in a new terminal session to verify the connection.')}</p>,
          ]}
        />
      </DocSection>

      <DocSection title={t('Environment variables')}>
        <ul className='text-muted-foreground list-disc space-y-2 ps-5'>
          <li>
            <code className='text-foreground font-mono text-sm'>
              ANTHROPIC_BASE_URL
            </code>{' '}
            — {t('FaceCloud gateway URL')}
          </li>
          <li>
            <code className='text-foreground font-mono text-sm'>
              ANTHROPIC_AUTH_TOKEN
            </code>{' '}
            — {t('Your FaceCloud API key')}
          </li>
          <li>
            <code className='text-foreground font-mono text-sm'>
              CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS
            </code>{' '}
            — {t('Disables experimental beta headers for third-party gateways')}
          </li>
          <li>
            <code className='text-foreground font-mono text-sm'>
              CLAUDE_CODE_ATTRIBUTION_HEADER
            </code>{' '}
            — {t('Disables attribution header when using a proxy')}
          </li>
        </ul>
      </DocSection>
    </article>
  )
}
