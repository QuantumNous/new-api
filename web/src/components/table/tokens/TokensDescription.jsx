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

import React, { useState, useEffect } from 'react';
import { Typography, Input, ScrollList, ScrollItem, Button } from '@douyinfe/semi-ui';
import { Key } from 'lucide-react';
import { IconCopy } from '@douyinfe/semi-icons';
import CompactModeToggle from '../../common/ui/CompactModeToggle';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import { API_ENDPOINTS } from '../../../constants/common.constant';
import { copy, showSuccess } from '../../../helpers';

const { Text } = Typography;

const TokensDescription = ({ compactMode, setCompactMode, t }) => {
  const isMobile = useIsMobile();
  const endpointItems = API_ENDPOINTS.map((e) => ({ value: e }));
  const [endpointIndex, setEndpointIndex] = useState(0);
  const displayServerLink = 'https://api.meeyo.org';

  const handleCopyBaseURL = async () => {
    const ok = await copy(displayServerLink);
    if (ok) {
      showSuccess(t('已复制到剪切板'));
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setEndpointIndex((prev) => (prev + 1) % endpointItems.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [endpointItems.length]);

  return (
    <div className='flex flex-col gap-4 w-full'>
      <div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-2 w-full'>
        <div className='flex items-center text-blue-500'>
          <Key size={16} className='mr-2' />
          <Text>{t('令牌管理')}</Text>
        </div>

        <CompactModeToggle
          compactMode={compactMode}
          setCompactMode={setCompactMode}
          t={t}
        />
      </div>

      {/* URL 链接区域 */}
      <div className='w-full'>
        <div className='flex-1 p-4 bg-semi-color-fill-0 rounded-xl border border-semi-color-border'>
          <div className='flex flex-col items-center justify-center gap-2 w-full'>
            <p className='text-sm text-semi-color-text-1 mb-2'>
              {t('更好的价格，更好的稳定性，只需要将模型基址替换为：')}
            </p>
            <Input
              readonly
              value={displayServerLink}
              className='flex-1 !rounded-full home-url-input max-w-2xl'
              size={isMobile ? 'default' : 'large'}
              suffix={
                <div className='flex items-center gap-2'>
                  <div className='home-endpoint-wheel'>
                    <ScrollList
                      bodyHeight={32}
                      style={{ border: 'unset', boxShadow: 'unset' }}
                    >
                      <ScrollItem
                        mode='wheel'
                        cycled={true}
                        list={endpointItems}
                        selectedIndex={endpointIndex}
                        onSelect={({ index }) => setEndpointIndex(index)}
                      />
                    </ScrollList>
                  </div>
                  <Button
                    type='primary'
                    onClick={handleCopyBaseURL}
                    icon={<IconCopy />}
                    className='!rounded-full'
                  />
                </div>
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TokensDescription;
