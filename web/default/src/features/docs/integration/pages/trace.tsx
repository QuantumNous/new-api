import { useTranslation } from 'react-i18next'
import { DocCallout } from '../components/doc-callout'
import { DocCodeBlock } from '../components/doc-code-block'
import { DocPageHeader, DocSection, DocStepList } from '../components/doc-section'
import { FACEAPI_BASE_URL } from '../constants'

const OPENAI_ENDPOINT = `${FACEAPI_BASE_URL}/v1/chat/completions`
const ANTHROPIC_ENDPOINT = `${FACEAPI_BASE_URL}/v1/messages`

export function TracePage() {
  const { t } = useTranslation()

  return (
    <article className='space-y-10'>
      <DocPageHeader
        title={t('Trace (Trae IDE)')}
        description={t(
          'Configure Trae IDE / Trae Agent (Trace) with full FaceCloud endpoint paths for custom models.'
        )}
      />

      <DocCallout variant='warning' title={t('Important')}>
        {t(
          'Trae requires complete endpoint URLs including the path segment. Do not use only the base domain — include /v1/chat/completions or /v1/messages as shown below.'
        )}
      </DocCallout>

      <DocSection title={t('OpenAI-compatible models')}>
        <DocStepList
          steps={[
            <p key='open-settings'>
              {t('Open Trae IDE settings and navigate to Custom Model or AI Provider configuration.')}
            </p>,
            <>
              <p>{t('For OpenAI-compatible models, set the request URL to:')}</p>
              <DocCodeBlock code={OPENAI_ENDPOINT} language='text' />
            </>,
            <>
              <p>
                {t('Set the API key to your FaceCloud key (')}{' '}
                <code className='bg-muted rounded px-1 font-mono text-sm'>sk-xxxx</code>
                {t(') and choose a model name available on your account.')}
              </p>
            </>,
          ]}
        />
      </DocSection>

      <DocSection title={t('Anthropic-compatible models')}>
        <DocStepList
          steps={[
            <p key='add-provider'>
              {t('Add a custom Anthropic provider or Claude model in Trae settings.')}
            </p>,
            <>
              <p>{t('Set the messages endpoint to:')}</p>
              <DocCodeBlock code={ANTHROPIC_ENDPOINT} language='text' />
            </>,
            <p key='auth'>
              {t('Use Bearer authentication with your FaceCloud API key in the Authorization header.')}
            </p>,
          ]}
        />
      </DocSection>

      <DocSection title={t('Endpoint reference')}>
        <div className='overflow-x-auto'>
          <table className='w-full border-collapse text-sm'>
            <thead>
              <tr className='border-b'>
                <th className='py-2 pe-4 text-start font-semibold'>{t('Provider')}</th>
                <th className='py-2 text-start font-semibold'>{t('Full endpoint URL')}</th>
              </tr>
            </thead>
            <tbody className='text-muted-foreground'>
              <tr className='border-b'>
                <td className='text-foreground py-3 pe-4 font-medium'>OpenAI</td>
                <td className='font-mono text-xs break-all'>{OPENAI_ENDPOINT}</td>
              </tr>
              <tr className='border-b'>
                <td className='text-foreground py-3 pe-4 font-medium'>Anthropic</td>
                <td className='font-mono text-xs break-all'>{ANTHROPIC_ENDPOINT}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </DocSection>

      <DocCallout title={t('Tip')}>
        {t(
          'If requests fail with 404, double-check that the full path is entered in Trae and that your FaceCloud deployment exposes the corresponding relay routes.'
        )}
      </DocCallout>
    </article>
  )
}
