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

import React, { useState, useEffect, useRef } from 'react';
import { Tag, Space, Skeleton } from '@douyinfe/semi-ui';
import { renderQuota } from '../../../helpers';
import CompactModeToggle from '../../common/ui/CompactModeToggle';

const LogsActions = ({
  stat,
  loadingStat,
  showStat,
  compactMode,
  setCompactMode,
  t,
}) => {
  const [showSkeleton, setShowSkeleton] = useState(loadingStat);
  const needSkeleton = !showStat || showSkeleton;
  const loadingStartRef = useRef(Date.now());

  useEffect(() => {
    if (loadingStat) {
      loadingStartRef.current = Date.now();
      setShowSkeleton(true);
    } else {
      const elapsed = Date.now() - loadingStartRef.current;
      const remaining = Math.max(0, 500 - elapsed);
      if (remaining === 0) {
        setShowSkeleton(false);
      } else {
        const timer = setTimeout(() => setShowSkeleton(false), remaining);
        return () => clearTimeout(timer);
      }
    }
  }, [loadingStat]);

  // Skeleton placeholder layout (three tag-size blocks)
  const placeholder = (
    <Space>
      <Skeleton.Title style={{ width: 108, height: 21, borderRadius: 6 }} />
      <Skeleton.Title style={{ width: 65, height: 21, borderRadius: 6 }} />
      <Skeleton.Title style={{ width: 64, height: 21, borderRadius: 6 }} />
    </Space>
  );

  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 w-full">
      <Skeleton loading={needSkeleton} active placeholder={placeholder}>
        <Space>
          <Tag
            color='blue'
            style={{
              fontWeight: 500,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              padding: 13,
            }}
            className='!rounded-lg'
          >
            {t('消耗额度')}: {renderQuota(stat.quota)}
          </Tag>
          <Tag
            color='pink'
            style={{
              fontWeight: 500,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              padding: 13,
            }}
            className='!rounded-lg'
          >
            RPM: {stat.rpm}
          </Tag>
          <Tag
            color='white'
            style={{
              border: 'none',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              fontWeight: 500,
              padding: 13,
            }}
            className='!rounded-lg'
          >
            TPM: {stat.tpm}
          </Tag>
        </Space>
      </Skeleton>

      <CompactModeToggle
        compactMode={compactMode}
        setCompactMode={setCompactMode}
        t={t}
      />
    </div>
  );
};

export default LogsActions; 