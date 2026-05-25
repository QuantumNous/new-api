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
import { useTranslation } from 'react-i18next';
import DocCallout from '../DocCallout';
import DocCodeBlock, { DocInlineCode } from '../DocCodeBlock';
import { DocPageHeader, DocSection, DocStepList, DocBulletList } from '../DocSection';
import { FACEAPI_BASE_URL } from '../constants';

const GEMINI_ENV = `GOOGLE_GEMINI_BASE_URL=${FACEAPI_BASE_URL}/gemini
GEMINI_API_KEY=sk-xxxx
GEMINI_MODEL=gemini-2.5-flash`;

const GeminiCliPage = () => {
  const { t } = useTranslation();

  return (
    <article>
      <DocPageHeader
        title={t('Gemini CLI')}
        description={t(
          'Point the Google Gemini CLI at FaceCloud for Gemini-compatible API requests.',
        )}
      />

      <DocCallout title={t('Note')}>
        {t(
          'Gemini CLI loads environment variables from ~/.env by default. You can also export them in your shell profile.',
        )}
      </DocCallout>

      <DocSection title={t('Configure environment')}>
        <DocStepList
          steps={[
            <>
              <p>
                {t('Create or edit')} <DocInlineCode>~/.env</DocInlineCode> {t('in your home directory.')}
              </p>
            </>,
            <>
              <p>{t('Add the following variables:')}</p>
              <DocCodeBlock code={GEMINI_ENV} filename='~/.env' />
            </>,
            <>
              <p>
                {t('Replace')} <DocInlineCode>sk-xxxx</DocInlineCode>{' '}
                {t('with your FaceCloud API key and set GEMINI_MODEL to a model your account supports.')}
              </p>
            </>,
            <p key='test'>{t('Run the Gemini CLI and send a test prompt to confirm connectivity.')}</p>,
          ]}
        />
      </DocSection>

      <DocSection title={t('Environment variables')}>
        <DocBulletList
          items={[
            <>
              <DocInlineCode>GOOGLE_GEMINI_BASE_URL</DocInlineCode> — {t('FaceCloud Gemini-compatible base URL')}
            </>,
            <>
              <DocInlineCode>GEMINI_API_KEY</DocInlineCode> — {t('Your FaceCloud API key')}
            </>,
            <>
              <DocInlineCode>GEMINI_MODEL</DocInlineCode> — {t('Default model name for requests')}
            </>,
          ]}
        />
      </DocSection>
    </article>
  );
};

export default GeminiCliPage;
