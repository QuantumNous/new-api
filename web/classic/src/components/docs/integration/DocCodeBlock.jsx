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
import { Button, Toast, Typography } from '@douyinfe/semi-ui';
import { IconCopy } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { copy } from '../../../helpers';

const blockStyle = {
  position: 'relative',
  borderRadius: '8px',
  border: '1px solid var(--semi-color-border)',
  backgroundColor: 'var(--semi-color-fill-0)',
  overflow: 'hidden',
};

const filenameStyle = {
  padding: '8px 16px',
  borderBottom: '1px solid var(--semi-color-border)',
  fontFamily: 'Consolas, Monaco, monospace',
  fontSize: '12px',
  color: 'var(--semi-color-text-2)',
  backgroundColor: 'var(--semi-color-fill-1)',
};

const preStyle = {
  margin: 0,
  padding: '16px 48px 16px 16px',
  overflowX: 'auto',
  fontSize: '13px',
  lineHeight: 1.6,
  fontFamily: 'Consolas, Monaco, monospace',
  color: 'var(--semi-color-text-0)',
  whiteSpace: 'pre',
};

const DocCodeBlock = ({ code, filename, className = '' }) => {
  const { t } = useTranslation();

  const handleCopy = async () => {
    const ok = await copy(code);
    if (ok) {
      Toast.success(t('已复制'));
    }
  };

  return (
    <div className={`docs-code-block ${className}`.trim()} style={blockStyle}>
      {filename ? <div style={filenameStyle}>{filename}</div> : null}
      <Button
        icon={<IconCopy />}
        theme='borderless'
        type='tertiary'
        size='small'
        aria-label={t('复制')}
        onClick={handleCopy}
        style={{ position: 'absolute', top: filename ? 40 : 8, right: 8, zIndex: 1 }}
      />
      <pre style={preStyle}>
        <code>{code}</code>
      </pre>
    </div>
  );
};

export const DocInlineCode = ({ children }) => (
  <Typography.Text
    code
    style={{
      fontSize: '13px',
      padding: '2px 6px',
      borderRadius: '4px',
      backgroundColor: 'var(--semi-color-fill-1)',
    }}
  >
    {children}
  </Typography.Text>
);

export default DocCodeBlock;
