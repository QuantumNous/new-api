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
import { Button, Tag, Typography } from '@douyinfe/semi-ui';
import { formatTokens } from './utils';

const GenerationDebugEntry = ({ generationDebug, onOpen, t }) => {
  const cachedTokens = generationDebug?.cache?.cached_tokens ?? 0;
  const cacheHitRate = generationDebug?.cache?.cache_hit_rate ?? 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
      }}
    >
      <Button size='small' theme='borderless' type='primary' onClick={onOpen}>
        {t('Open Generation Debug')}
      </Button>
      <Tag size='small'>
        {t('Cached')}: {formatTokens(cachedTokens)}
      </Tag>
      <Typography.Text type='tertiary' size='small'>
        {(cacheHitRate || 0).toLocaleString(undefined, {
          style: 'percent',
          maximumFractionDigits: 1,
        })}
      </Typography.Text>
    </div>
  );
};

export default GenerationDebugEntry;
