/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React from 'react';
import { Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import DocCallout from '../DocCallout';
import DocCodeBlock, { DocInlineCode } from '../DocCodeBlock';
import { DocPageHeader, DocSection, DocStepList, DocBulletList } from '../DocSection';
import { FACEAPI_BASE_URL } from '../constants';

const CODEX_CONFIG = `model = "o3"
model_provider = "openai-chat-completions"

[model_providers.openai-chat-completions]
name = "FaceCloud"
base_url = "${FACEAPI_BASE_URL}/v1"
env_key = "FACEAPI_API_KEY"
wire_api = "chat"`;

const CODEX_ENV = `export FACEAPI_API_KEY="sk-xxxx"`;

const CodexPage = () => {
  const { t } = useTranslation();

  return (
    <article>
      <DocPageHeader
        title={t('Codex')}
        description={t(
          'Configure OpenAI Codex CLI to use FaceCloud via OpenAI-compatible chat completions.',
        )}
      />

      <DocCallout title={t('Note')}>
        {t(
          'Codex uses TOML configuration at ~/.codex/config.toml and reads the API key from the FACEAPI_API_KEY environment variable.',
        )}
      </DocCallout>

      <DocSection title={t('Set your API key')}>
        <DocCodeBlock code={CODEX_ENV} filename='~/.bashrc or ~/.zshrc' />
        <Typography.Paragraph type='secondary' size='small' style={{ marginTop: '8px' }}>
          {t('Reload your shell or run source on the file after exporting the variable.')}
        </Typography.Paragraph>
      </DocSection>

      <DocSection title={t('Configure Codex')}>
        <DocStepList
          steps={[
            <>
              <p>
                {t('Create or edit')} <DocInlineCode>~/.codex/config.toml</DocInlineCode>.
              </p>
            </>,
            <>
              <p>{t('Add the FaceCloud provider configuration:')}</p>
              <DocCodeBlock code={CODEX_CONFIG} filename='~/.codex/config.toml' />
            </>,
            <p key='run'>
              {t(
                'Start Codex and select the FaceCloud provider. Adjust model to one available on your account.',
              )}
            </p>,
          ]}
        />
      </DocSection>

      <DocSection title={t('Configuration reference')}>
        <DocBulletList
          items={[
            <>
              <DocInlineCode>base_url</DocInlineCode> —{' '}
              {t('OpenAI-compatible endpoint at {{url}}', {
                url: `${FACEAPI_BASE_URL}/v1`,
              })}
            </>,
            <>
              <DocInlineCode>env_key</DocInlineCode> — {t('Environment variable holding your API key')}
            </>,
            <>
              <DocInlineCode>wire_api</DocInlineCode> — {t('Use chat completions wire format')}
            </>,
          ]}
        />
      </DocSection>
    </article>
  );
};

export default CodexPage;
