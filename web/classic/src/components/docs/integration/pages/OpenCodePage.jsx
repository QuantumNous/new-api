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
import { DocPageHeader, DocSection, DocStepList } from '../DocSection';
import { FACEAPI_BASE_URL } from '../constants';

const OPENCODE_CONFIG = `{
  "providers": {
    "facecloud": {
      "baseURL": "${FACEAPI_BASE_URL}/v1",
      "apiKey": "sk-xxxx"
    }
  },
  "defaultProvider": "facecloud"
}`;

const OpenCodePage = () => {
  const { t } = useTranslation();

  return (
    <article>
      <DocPageHeader
        title={t('OpenCode')}
        description={t('Add FaceCloud as a custom OpenAI-compatible provider in OpenCode.')}
      />

      <DocCallout title={t('Note')}>
        {t(
          'OpenCode configuration lives at ~/.config/opencode/opencode.json. You can also authenticate interactively with opencode auth login.',
        )}
      </DocCallout>

      <DocSection title={t('Manual configuration')}>
        <DocStepList
          steps={[
            <>
              <p>
                {t('Create the config directory if it does not exist:')}{' '}
                <DocInlineCode>~/.config/opencode/</DocInlineCode>
              </p>
            </>,
            <>
              <p>{t('Edit opencode.json with the FaceCloud provider:')}</p>
              <DocCodeBlock
                code={OPENCODE_CONFIG}
                filename='~/.config/opencode/opencode.json'
              />
            </>,
            <>
              <p>
                {t('Replace')} <DocInlineCode>sk-xxxx</DocInlineCode> {t('with your FaceCloud API key.')}
              </p>
            </>,
            <p key='launch'>{t('Launch OpenCode and verify that requests route through FaceCloud.')}</p>,
          ]}
        />
      </DocSection>

      <DocSection title={t('Interactive login')}>
        <Typography.Paragraph type='secondary' style={{ lineHeight: 1.7, marginBottom: '16px' }}>
          {t(
            'Alternatively, run opencode auth login and choose to add a custom provider. Set the provider id to facecloud, base URL to the FaceCloud /v1 endpoint, and paste your API key when prompted.',
          )}
        </Typography.Paragraph>
        <DocCodeBlock
          code={`opencode auth login\n# Provider id: facecloud\n# Base URL: ${FACEAPI_BASE_URL}/v1\n# API key: sk-xxxx`}
        />
      </DocSection>
    </article>
  );
};

export default OpenCodePage;
