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

const CODEBUDDY_SHELL = `export CODEBUDDY_API_KEY="sk-xxxx"
export CODEBUDDY_BASE_URL="${FACEAPI_BASE_URL}/v1"
codebuddy --model your-model-name`;

const CODEBUDDY_SETTINGS = `{
  "env": {
    "CODEBUDDY_API_KEY": "sk-xxxx",
    "CODEBUDDY_BASE_URL": "${FACEAPI_BASE_URL}/v1"
  }
}`;

const CodeBuddyPage = () => {
  const { t } = useTranslation();

  return (
    <article>
      <DocPageHeader
        title={t('Code Buddy')}
        description={t(
          'Connect Tencent CodeBuddy CLI to FaceCloud using environment variables or settings.json.',
        )}
      />

      <DocCallout title={t('Note')}>
        {t(
          'CodeBuddy reads CODEBUDDY_API_KEY and CODEBUDDY_BASE_URL to locate the API. Replace your-model-name with a model enabled on your FaceCloud account.',
        )}
      </DocCallout>

      <DocSection title={t('Shell environment')}>
        <DocStepList
          steps={[
            <>
              <p>{t('Export the following variables in your terminal or shell profile:')}</p>
              <DocCodeBlock code={CODEBUDDY_SHELL} />
            </>,
            <>
              <p>
                {t('Replace')} <DocInlineCode>sk-xxxx</DocInlineCode>{' '}
                {t('and your-model-name with your API key and desired model.')}
              </p>
            </>,
            <p key='run'>{t('Run codebuddy from the same shell session to use FaceCloud.')}</p>,
          ]}
        />
      </DocSection>

      <DocSection title={t('settings.json (optional)')}>
        <Typography.Paragraph type='secondary' style={{ marginBottom: '16px', lineHeight: 1.7 }}>
          {t(
            'If CodeBuddy supports a settings.json env block (similar to Claude Code), you can persist configuration:',
          )}
        </Typography.Paragraph>
        <DocCodeBlock code={CODEBUDDY_SETTINGS} filename='settings.json' />
      </DocSection>

      <DocSection title={t('Environment variables')}>
        <DocBulletList
          items={[
            <>
              <DocInlineCode>CODEBUDDY_API_KEY</DocInlineCode> — {t('Your FaceCloud API key')}
            </>,
            <>
              <DocInlineCode>CODEBUDDY_BASE_URL</DocInlineCode> —{' '}
              {t('OpenAI-compatible base URL at {{url}}', {
                url: `${FACEAPI_BASE_URL}/v1`,
              })}
            </>,
          ]}
        />
      </DocSection>
    </article>
  );
};

export default CodeBuddyPage;
