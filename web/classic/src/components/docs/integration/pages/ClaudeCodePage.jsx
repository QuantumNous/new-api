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

const CLAUDE_SETTINGS = `{
  "env": {
    "ANTHROPIC_BASE_URL": "${FACEAPI_BASE_URL}",
    "ANTHROPIC_AUTH_TOKEN": "sk-xxxx",
    "CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS": "1",
    "CLAUDE_CODE_ATTRIBUTION_HEADER": "0"
  }
}`;

const ClaudeCodePage = () => {
  const { t } = useTranslation();

  return (
    <article>
      <DocPageHeader
        title={t('Claude Code')}
        description={t(
          'Use FaceCloud as the Anthropic API endpoint for Claude Code CLI in your terminal.',
        )}
      />

      <DocCallout title={t('Note')}>
        {t(
          'Claude Code reads configuration from ~/.claude/settings.json. Restart the CLI after saving changes.',
        )}
      </DocCallout>

      <DocSection title={t('Install Claude Code')}>
        <DocCodeBlock code='npm install -g @anthropic-ai/claude-code' />
      </DocSection>

      <DocSection title={t('Configure FaceCloud')}>
        <DocStepList
          steps={[
            <>
              <p>
                {t('Create or edit')} <DocInlineCode>~/.claude/settings.json</DocInlineCode>.
              </p>
            </>,
            <>
              <p>{t('Add the following environment variables:')}</p>
              <DocCodeBlock code={CLAUDE_SETTINGS} filename='~/.claude/settings.json' />
            </>,
            <>
              <p>
                {t('Replace')} <DocInlineCode>sk-xxxx</DocInlineCode> {t('with your FaceCloud API key.')}
              </p>
            </>,
            <p key='verify'>{t('Run claude in a new terminal session to verify the connection.')}</p>,
          ]}
        />
      </DocSection>

      <DocSection title={t('Environment variables')}>
        <DocBulletList
          items={[
            <>
              <DocInlineCode>ANTHROPIC_BASE_URL</DocInlineCode> — {t('FaceCloud gateway URL')}
            </>,
            <>
              <DocInlineCode>ANTHROPIC_AUTH_TOKEN</DocInlineCode> — {t('Your FaceCloud API key')}
            </>,
            <>
              <DocInlineCode>CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS</DocInlineCode> —{' '}
              {t('Disables experimental beta headers for third-party gateways')}
            </>,
            <>
              <DocInlineCode>CLAUDE_CODE_ATTRIBUTION_HEADER</DocInlineCode> —{' '}
              {t('Disables attribution header when using a proxy')}
            </>,
          ]}
        />
      </DocSection>
    </article>
  );
};

export default ClaudeCodePage;
