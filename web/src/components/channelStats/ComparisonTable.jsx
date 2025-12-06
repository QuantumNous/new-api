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
import { Card, Table, Tag } from '@douyinfe/semi-ui';
import { ListOrdered } from 'lucide-react';
import { renderNumber, renderQuota } from '../../helpers';

const ComparisonTable = ({ performanceData, t }) => {
  const columns = [
    {
      title: t('渠道名称'),
      dataIndex: 'channel_name',
      key: 'channel_name',
      fixed: 'left',
      width: 150,
    },
    {
      title: t('总调用'),
      dataIndex: 'total_calls',
      key: 'total_calls',
      render: (text) => renderNumber(text),
      sorter: (a, b) => a.total_calls - b.total_calls,
    },
    {
      title: t('成功率'),
      dataIndex: 'success_rate',
      key: 'success_rate',
      render: (text) => {
        let color = 'green';
        if (text < 80) color = 'red';
        else if (text < 95) color = 'orange';
        return (
          <Tag color={color}>{text.toFixed(2)}%</Tag>
        );
      },
      sorter: (a, b) => a.success_rate - b.success_rate,
    },
    {
      title: t('平均响应时间'),
      dataIndex: 'avg_response_time',
      key: 'avg_response_time',
      render: (text) => {
        let color = 'green';
        if (text > 5) color = 'red';
        else if (text > 2) color = 'orange';
        return (
          <Tag color={color}>{text.toFixed(2)}s</Tag>
        );
      },
      sorter: (a, b) => a.avg_response_time - b.avg_response_time,
    },
    {
      title: t('最小响应时间'),
      dataIndex: 'min_response_time',
      key: 'min_response_time',
      render: (text) => `${text}s`,
    },
    {
      title: t('最大响应时间'),
      dataIndex: 'max_response_time',
      key: 'max_response_time',
      render: (text) => `${text}s`,
    },
    {
      title: t('成功次数'),
      dataIndex: 'success_calls',
      key: 'success_calls',
      render: (text) => renderNumber(text),
    },
    {
      title: t('失败次数'),
      dataIndex: 'failed_calls',
      key: 'failed_calls',
      render: (text) => renderNumber(text),
    },
    {
      title: t('总消耗'),
      dataIndex: 'total_quota',
      key: 'total_quota',
      render: (text) => renderQuota(text),
      sorter: (a, b) => a.total_quota - b.total_quota,
    },
    {
      title: t('总Token'),
      dataIndex: 'total_tokens',
      key: 'total_tokens',
      render: (text) => renderNumber(text),
    },
  ];

  return (
    <Card
      bordered={false}
      title={
        <div className='flex items-center gap-2'>
          <ListOrdered size={16} />
          {t('渠道对比表')}
        </div>
      }
    >
      <Table
        columns={columns}
        dataSource={performanceData}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          pageSizeOpts: [10, 20, 50],
        }}
        rowKey='channel_id'
        scroll={{ x: 1200 }}
      />
    </Card>
  );
};

export default ComparisonTable;




