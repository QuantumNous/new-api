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
import { Table, Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import DocCallout from '../DocCallout';
import DocCodeBlock, { DocInlineCode } from '../DocCodeBlock';
import { DocPageHeader, DocSection, DocStepList } from '../DocSection';
import { FACEAPI_BASE_URL } from '../constants';

const OPENAI_ENDPOINT = `${FACEAPI_BASE_URL}/v1/chat/completions`;
const ANTHROPIC_ENDPOINT = `${FACEAPI_BASE_URL}/v1/messages`;

const TracePage = () => {
  const { t } = useTranslation();

  const endpointColumns = [
    {
      title: t('Provider'),
      dataIndex: 'provider',
      width: 120,
    },
    {
      title: t('Full endpoint URL'),
      dataIndex: 'url',
      render: (url) => (
        <Typography.Text code style={{ fontSize: '12px', wordBreak: 'break-all' }}>
          {url}
        </Typography.Text>
      ),
    },
  ];

  const endpointData = [
    { key: 'openai', provider: 'OpenAI', url: OPENAI_ENDPOINT },
    { key: 'anthropic', provider: 'Anthropic', url: ANTHROPIC_ENDPOINT },
  ];

  return (
    <article>
      <DocPageHeader
        title={t('Trace (Trae IDE)')}
        description={t(
          'Configure Trae IDE / Trae Agent (Trace) with full FaceCloud endpoint paths for custom models.',
        )}
      />

      <DocCallout variant='warning' title={t('Important')}>
        {t(
          'Trae requires complete endpoint URLs including the path segment. Do not use only the base domain — include /v1/chat/completions or /v1/messages as shown below.',
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
              <DocCodeBlock code={OPENAI_ENDPOINT} />
            </>,
            <>
              <p>
                {t('Set the API key to your FaceCloud key (')} <DocInlineCode>sk-xxxx</DocInlineCode>
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
              <DocCodeBlock code={ANTHROPIC_ENDPOINT} />
            </>,
            <p key='auth'>
              {t('Use Bearer authentication with your FaceCloud API key in the Authorization header.')}
            </p>,
          ]}
        />
      </DocSection>

      <DocSection title={t('Endpoint reference')}>
        <Table columns={endpointColumns} dataSource={endpointData} pagination={false} size='small' />
      </DocSection>

      <DocCallout title={t('Tip')}>
        {t(
          'If requests fail with 404, double-check that the full path is entered in Trae and that your FaceCloud deployment exposes the corresponding relay routes.',
        )}
      </DocCallout>
    </article>
  );
};

export default TracePage;
