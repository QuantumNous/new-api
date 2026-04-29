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
import { KeyRound, Layers3, MousePointerClick } from 'lucide-react';
import CompactModeToggle from '../../common/ui/CompactModeToggle';

const { Text } = Typography;

const TokensDescription = ({
  compactMode,
  setCompactMode,
  tokenCount,
  selectedCount,
  t,
}) => {
  return (
    <div className='token-table-overview'>
      <div className='token-table-overview-copy'>
        <div className='token-table-overview-eyebrow'>
          <KeyRound size={15} strokeWidth={2.1} />
          <span>{t('令牌列表')}</span>
        </div>
        <Text className='token-table-overview-title'>{t('管理您的 API 访问令牌')}</Text>
        <p className='token-table-overview-subtitle'>
          {t('集中查看状态、额度、过期时间和访问限制，并快速执行复制或禁用操作')}
        </p>
      </div>

      <div className='token-table-overview-side'>
        <div className='token-table-metric-chip'>
          <span>
            <Layers3 size={14} />
            {t('令牌总数')}
          </span>
          <strong>{tokenCount || 0}</strong>
        </div>
        <div className='token-table-metric-chip token-table-metric-chip-muted'>
          <span>
            <MousePointerClick size={14} />
            {t('当前选中')}
          </span>
          <strong>{selectedCount || 0}</strong>
        </div>
        <CompactModeToggle
          compactMode={compactMode}
          setCompactMode={setCompactMode}
          t={t}
          className='token-compact-toggle'
        />
      </div>
    </div>
  );
};

export default TokensDescription;
