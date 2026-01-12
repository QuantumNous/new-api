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
import { Modal, Spin, Radio, RadioGroup, Typography } from '@douyinfe/semi-ui';
import { VChart } from '@visactor/react-vchart';
import { API } from '../../../../helpers';

const { Text } = Typography;

const SingleChannelStatisticsModal = ({ visible, onCancel, channelId, channelName }) => {
  const [loading, setLoading] = useState(false);
  const [statistics, setStatistics] = useState([]);
  const [days, setDays] = useState(7);
  const [chartSpec, setChartSpec] = useState(null);

  useEffect(() => {
    if (visible && channelId) {
      loadStatistics();
    }
  }, [visible, channelId, days]);

  const loadStatistics = async () => {
    setLoading(true);
    try {
      const res = await API.get(`/api/channel/statistics/${channelId}?days=${days}`);
      const { success, data } = res.data;
      if (success && data) {
        setStatistics(data);
        generateChartSpec(data);
      }
    } catch (error) {
      console.error('Failed to load statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateChartSpec = (data) => {
    if (!data || data.length === 0) {
      setChartSpec(null);
      return;
    }

    // Transform data for VChart
    const chartData = [];
    data.forEach((item) => {
      chartData.push({
        date: item.date,
        type: '成功',
        count: item.success_count,
      });
      chartData.push({
        date: item.date,
        type: '失败',
        count: item.error_count,
      });
    });

    // Calculate total stats
    const totalRequests = data.reduce((sum, item) => sum + item.total_count, 0);
    const totalSuccess = data.reduce((sum, item) => sum + item.success_count, 0);
    const totalErrors = data.reduce((sum, item) => sum + item.error_count, 0);
    const avgSuccessRate = totalRequests > 0 ? ((totalSuccess / totalRequests) * 100).toFixed(2) : 0;

    const spec = {
      type: 'bar',
      data: [
        {
          id: 'barData',
          values: chartData,
        },
      ],
      xField: 'date',
      yField: 'count',
      seriesField: 'type',
      stack: true,
      legends: {
        visible: true,
        orient: 'bottom',
      },
      title: {
        visible: true,
        text: `${channelName || '渠道'} - 最近${days}天统计`,
        subtext: `总请求: ${totalRequests} | 成功: ${totalSuccess} | 失败: ${totalErrors} | 成功率: ${avgSuccessRate}%`,
      },
      bar: {
        style: {
          cornerRadius: 4,
        },
        state: {
          hover: {
            stroke: '#000',
            lineWidth: 1,
          },
        },
      },
      tooltip: {
        mark: {
          content: [
            {
              key: (datum) => datum['type'],
              value: (datum) => datum['count'],
            },
          ],
        },
      },
      color: {
        type: 'ordinal',
        range: ['#52c41a', '#ff4d4f'],
      },
      axes: [
        {
          orient: 'left',
          title: {
            visible: true,
            text: '请求数',
          },
        },
        {
          orient: 'bottom',
          title: {
            visible: true,
            text: '日期',
          },
          label: {
            autoRotate: true,
            autoRotateAngle: [0, 45],
          },
        },
      ],
    };

    setChartSpec(spec);
  };

  const CHART_CONFIG = {
    autoFit: true,
  };

  return (
    <Modal
      title={`${channelName || '渠道'} 统计`}
      visible={visible}
      onCancel={onCancel}
      footer={null}
      width={900}
      centered
    >
      <div className='mb-4'>
        <Text strong>时间范围：</Text>
        <RadioGroup
          type='button'
          value={days}
          onChange={(e) => setDays(e.target.value)}
          style={{ marginLeft: 8 }}
        >
          <Radio value={7}>最近7天</Radio>
          <Radio value={14}>最近14天</Radio>
          <Radio value={30}>最近30天</Radio>
        </RadioGroup>
      </div>

      <Spin spinning={loading}>
        <div style={{ height: '500px' }}>
          {chartSpec ? (
            <VChart spec={chartSpec} option={CHART_CONFIG} />
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#999'
            }}>
              暂无数据
            </div>
          )}
        </div>
      </Spin>
    </Modal>
  );
};

export default SingleChannelStatisticsModal;
