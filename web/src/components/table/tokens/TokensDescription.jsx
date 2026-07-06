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
import { KeyRound } from 'lucide-react';
import CompactModeToggle from '../../common/ui/CompactModeToggle';

const { Text } = Typography;

const TokensDescription = ({ compactMode, setCompactMode, t }) => {
  return (
    <div className='tokens-header flex flex-col md:flex-row justify-between items-start md:items-center gap-3 w-full'>
      <div className='tokens-title-wrap flex items-center min-w-0'>
        <span className='tokens-title-icon'>
          <KeyRound size={18} />
        </span>
        <span className='min-w-0'>
          <Text className='tokens-title'>{t('令牌管理')}</Text>
          <Text className='tokens-subtitle'>{t('设置令牌的基本信息')}</Text>
        </span>
      </div>

      <div className='tokens-compact-toggle'>
        <CompactModeToggle
          compactMode={compactMode}
          setCompactMode={setCompactMode}
          t={t}
        />
      </div>
    </div>
  );
};

export default TokensDescription;
