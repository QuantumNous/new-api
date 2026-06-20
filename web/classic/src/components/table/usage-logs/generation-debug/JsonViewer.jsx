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

import React, { useState } from 'react';
import { Button, Tag, Typography } from '@douyinfe/semi-ui';
import { copy } from '../../../../helpers';
import { stringifyDebugValue } from './utils';

const JsonViewer = ({
  label,
  value,
  rawMeta,
  t,
  height = 'min(55vh, 560px)',
}) => {
  const [copied, setCopied] = useState(false);
  const content = stringifyDebugValue(value);

  const handleCopy = async () => {
    const ok = await copy(content);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  };

  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 8,
        }}
      >
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}
        >
          {label && (
            <Typography.Text strong ellipsis={{ showTooltip: true }}>
              {label}
            </Typography.Text>
          )}
          <Tag size='small'>JSON</Tag>
          {rawMeta?.truncated && (
            <Tag color='red' size='small'>
              {t('Truncated')}
            </Tag>
          )}
          {rawMeta && (
            <Typography.Text type='tertiary' size='small'>
              {Number(rawMeta.captured_bytes || 0).toLocaleString()}{' '}
              {t('bytes')}
            </Typography.Text>
          )}
        </div>
        <Button size='small' theme='borderless' onClick={handleCopy}>
          {copied ? t('Copied') : t('Copy')}
        </Button>
      </div>
      <pre
        style={{
          height,
          minWidth: 0,
          overflow: 'auto',
          margin: 0,
          padding: 12,
          border: '1px solid var(--semi-color-border)',
          borderRadius: 8,
          background: 'var(--semi-color-fill-0)',
          fontSize: 12,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {content}
      </pre>
    </div>
  );
};

export default JsonViewer;
