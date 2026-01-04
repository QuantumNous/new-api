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
import { Modal, Table, Spin } from '@douyinfe/semi-ui';
import { API } from '../../../../helpers';

const ChannelStatisticsModal = ({ visible, onCancel, t }) => {
  const [loading, setLoading] = useState(false);
  const [statistics, setStatistics] = useState([]);

  useEffect(() => {
    if (visible) {
      loadStatistics();
    }
  }, [visible]);

  const loadStatistics = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/channel/statistics');
      const { success, data } = res.data;
      if (success) {
        setStatistics(data || []);
      }
    } catch (error) {
      console.error('Failed to load statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: t('渠道ID'),
      dataIndex: 'channel_id',
      key: 'channel_id',
      width: 100,
      sorter: (a, b) => a.channel_id - b.channel_id,
    },
    {
      title: t('渠道名称'),
      dataIndex: 'channel_name',
      key: 'channel_name',
      sorter: (a, b) => a.channel_name.localeCompare(b.channel_name),
    },
    {
      title: t('总请求数'),
      dataIndex: 'total_requests',
      key: 'total_requests',
      width: 120,
      sorter: (a, b) => a.total_requests - b.total_requests,
      render: (text) => text.toLocaleString(),
    },
    {
      title: t('成功请求'),
      dataIndex: 'success_count',
      key: 'success_count',
      width: 120,
      sorter: (a, b) => a.success_count - b.success_count,
      render: (text) => (
        <span style={{ color: '#52c41a' }}>{text.toLocaleString()}</span>
      ),
    },
    {
      title: t('失败请求'),
      dataIndex: 'error_count',
      key: 'error_count',
      width: 120,
      sorter: (a, b) => a.error_count - b.error_count,
      render: (text) => (
        <span style={{ color: text > 0 ? '#ff4d4f' : undefined }}>
          {text.toLocaleString()}
        </span>
      ),
    },
    {
      title: t('成功率'),
      dataIndex: 'success_rate',
      key: 'success_rate',
      width: 120,
      sorter: (a, b) => a.success_rate - b.success_rate,
      render: (rate) => {
        const color =
          rate >= 95 ? '#52c41a' : rate >= 80 ? '#faad14' : '#ff4d4f';
        return <span style={{ color }}>{rate.toFixed(2)}%</span>;
      },
    },
  ];

  return (
    <Modal
      title={t('渠道统计')}
      visible={visible}
      onCancel={onCancel}
      footer={null}
      width={900}
      centered
    >
      <Spin spinning={loading}>
        <Table
          columns={columns}
          dataSource={statistics}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => t('共 {total} 个渠道', { total }),
          }}
          rowKey='channel_id'
          size='small'
        />
      </Spin>
    </Modal>
  );
};

export default ChannelStatisticsModal;
