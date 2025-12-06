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
import { Card, Row, Col } from '@douyinfe/semi-ui';
import { Activity, Clock, CheckCircle, Server } from 'lucide-react';
import { renderNumber, renderQuota } from '../../helpers';

const StatCard = ({ title, value, icon: Icon, color, loading }) => {
  return (
    <Card
      bordered={false}
      bodyStyle={{ padding: '20px' }}
      style={{ height: '100%' }}
    >
      <div className='flex items-center justify-between'>
        <div>
          <div className='text-sm text-gray-500 mb-2'>{title}</div>
          <div className='text-2xl font-bold'>{loading ? '-' : value}</div>
        </div>
        <div
          className='flex items-center justify-center w-12 h-12 rounded-full'
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon size={24} color={color} />
        </div>
      </div>
    </Card>
  );
};

const StatsCards = ({ performanceData, loading, t }) => {
  // 计算总调用次数
  const totalCalls = performanceData.reduce(
    (sum, item) => sum + item.total_calls,
    0
  );

  // 计算平均响应时间
  const avgResponseTime =
    performanceData.length > 0
      ? (
          performanceData.reduce(
            (sum, item) => sum + item.avg_response_time * item.total_calls,
            0
          ) / totalCalls || 0
        ).toFixed(2)
      : 0;

  // 计算总成功率
  const totalSuccessCalls = performanceData.reduce(
    (sum, item) => sum + item.success_calls,
    0
  );
  const successRate = totalCalls > 0
    ? ((totalSuccessCalls / totalCalls) * 100).toFixed(2)
    : 0;

  // 活跃渠道数
  const activeChannels = performanceData.length;

  // 总消耗额度
  const totalQuota = performanceData.reduce(
    (sum, item) => sum + item.total_quota,
    0
  );

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} sm={12} lg={6}>
        <StatCard
          title={t('总调用次数')}
          value={renderNumber(totalCalls)}
          icon={Activity}
          color='#1890ff'
          loading={loading}
        />
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <StatCard
          title={t('平均响应时间')}
          value={`${avgResponseTime}s`}
          icon={Clock}
          color='#52c41a'
          loading={loading}
        />
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <StatCard
          title={t('总成功率')}
          value={`${successRate}%`}
          icon={CheckCircle}
          color='#722ed1'
          loading={loading}
        />
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <StatCard
          title={t('活跃渠道数')}
          value={renderNumber(activeChannels)}
          icon={Server}
          color='#faad14'
          loading={loading}
        />
      </Col>
    </Row>
  );
};

export default StatsCards;




