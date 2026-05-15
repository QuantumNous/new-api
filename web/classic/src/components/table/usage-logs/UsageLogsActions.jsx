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
import { Skeleton, Typography } from '@douyinfe/semi-ui';
import { renderQuota } from '../../../helpers';
import CompactModeToggle from '../../common/ui/CompactModeToggle';
import { useMinimumLoadingTime } from '../../../hooks/common/useMinimumLoadingTime';
import { Activity, Coins, Gauge, ScrollText } from 'lucide-react';

const { Text } = Typography;

const LogsActions = ({
  stat,
  loadingStat,
  showStat,
  compactMode,
  setCompactMode,
  t,
}) => {
  const showSkeleton = useMinimumLoadingTime(loadingStat);
  const needSkeleton = !showStat || showSkeleton;

  const placeholder = (
    <div className='log-table-overview-skeleton'>
      <Skeleton.Title style={{ width: 108, height: 21, borderRadius: 6 }} />
      <Skeleton.Title style={{ width: 65, height: 21, borderRadius: 6 }} />
      <Skeleton.Title style={{ width: 64, height: 21, borderRadius: 6 }} />
    </div>
  );

  return (
    <div className='log-table-overview'>
      <div className='log-table-overview-copy'>
        <div className='log-table-overview-eyebrow'>
          <ScrollText size={15} strokeWidth={2.1} />
          <span>{t('日志总览')}</span>
        </div>
        <Text className='log-table-overview-title'>
          {t('查看模型调用、请求耗时与计费细节')}
        </Text>
        <p className='log-table-overview-subtitle'>
          {t(
            '支持按时间范围、令牌、模型、渠道和请求 ID 交叉筛选，快速定位异常调用',
          )}
        </p>
      </div>

      <div className='log-table-overview-side'>
        <Skeleton loading={needSkeleton} active placeholder={placeholder}>
          <div className='log-table-metric-group'>
            <div className='log-table-metric-chip'>
              <span>
                <Coins size={14} />
                {t('消耗额度')}
              </span>
              <strong>{renderQuota(stat.quota || 0)}</strong>
            </div>
            <div className='log-table-metric-chip log-table-metric-chip-muted'>
              <span>
                <Activity size={14} />
                RPM
              </span>
              <strong>{stat.rpm || 0}</strong>
            </div>
            <div className='log-table-metric-chip log-table-metric-chip-muted'>
              <span>
                <Gauge size={14} />
                TPM
              </span>
              <strong>{stat.tpm || 0}</strong>
            </div>
          </div>
        </Skeleton>

        <CompactModeToggle
          compactMode={compactMode}
          setCompactMode={setCompactMode}
          t={t}
          className='log-compact-toggle'
        />
      </div>
    </div>
  );
};

export default LogsActions;
