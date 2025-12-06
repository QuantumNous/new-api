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
import { Card, Row, Col, Tag, Empty, Badge } from '@douyinfe/semi-ui';
import { Activity } from 'lucide-react';
import { renderNumber } from '../../helpers';
import { CHANNEL_STATUS_MAP } from '../../constants/channelStats.constants';

const RealtimeMonitor = ({ realtimeData, t }) => {
  if (!realtimeData || realtimeData.length === 0) {
    return (
      <Card
        bordered={false}
        title={
          <div className='flex items-center gap-2'>
            <Activity size={16} />
            {t('实时监控')}
          </div>
        }
      >
        <Empty description={t('暂无实时数据')} />
      </Card>
    );
  }

  return (
    <Card
      bordered={false}
      title={
        <div className='flex items-center gap-2'>
          <Activity size={16} />
          {t('实时监控')}
          <Badge count={t('实时')} type='danger' />
        </div>
      }
    >
      <Row gutter={[16, 16]}>
        {realtimeData.map((item) => {
          const statusInfo = CHANNEL_STATUS_MAP[item.status] || { label: '未知', color: 'grey' };

          return (
            <Col xs={24} sm={12} lg={8} xl={6} key={item.channel_id}>
              <Card
                bodyStyle={{ padding: '16px' }}
                style={{ height: '100%', border: '1px solid var(--semi-color-border)' }}
              >
                <div className='mb-2'>
                  <div className='flex items-center justify-between mb-2'>
                    <span className='font-semibold'>{item.channel_name}</span>
                    <Tag color={statusInfo.color} size='small'>
                      {t(statusInfo.label)}
                    </Tag>
                  </div>
                </div>

                <div className='space-y-2 text-sm'>
                  <div className='flex justify-between'>
                    <span className='text-gray-600'>{t('当前RPM')}:</span>
                    <span className='font-medium'>{renderNumber(item.current_rpm)}</span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-gray-600'>{t('当前TPM')}:</span>
                    <span className='font-medium'>{renderNumber(item.current_tpm)}</span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-gray-600'>{t('成功率')}:</span>
                    <span className='font-medium'>
                      {item.recent_success_rate ? `${item.recent_success_rate.toFixed(2)}%` : '-'}
                    </span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-gray-600'>{t('平均响应')}:</span>
                    <span className='font-medium'>
                      {item.recent_avg_time ? `${item.recent_avg_time.toFixed(2)}s` : '-'}
                    </span>
                  </div>
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>
    </Card>
  );
};

export default RealtimeMonitor;

