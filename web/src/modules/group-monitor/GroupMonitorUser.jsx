import React, { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Tag, Typography } from '@douyinfe/semi-ui';
import { VChart } from '@visactor/react-vchart';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { API } from '../../helpers';

const CHART_CONFIG = { mode: 'desktop-browser' };

const GroupMonitorUser = () => {
  const { t } = useTranslation();
  const [statusData, setStatusData] = useState([]);
  const [timeSeriesData, setTimeSeriesData] = useState([]);

  const loadStatus = useCallback(async () => {
    const res = await API.get('/api/group/monitor/status');
    if (res.data.success) {
      setStatusData(res.data.data || []);
    }
  }, []);

  const loadTimeSeries = useCallback(async () => {
    const now = Math.floor(Date.now() / 1000);
    const res = await API.get('/api/group/monitor/time_series', {
      params: { start_timestamp: now - 3600 },
    });
    if (res.data.success) {
      setTimeSeriesData(res.data.data || []);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadTimeSeries();
    // 每 60 秒自动刷新
    const interval = setInterval(() => {
      loadStatus();
      loadTimeSeries();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const chartSpec = {
    type: 'line',
    data: [
      {
        id: 'latencyData',
        values: timeSeriesData.map((item) => ({
          time: dayjs.unix(item.created_at).format('HH:mm'),
          latency: item.latency_ms,
          group: item.group_name,
          success: item.success,
        })),
      },
    ],
    xField: 'time',
    yField: 'latency',
    seriesField: 'group',
    legends: { visible: true },
    title: {
      visible: true,
      text: t('延迟趋势'),
      subtext: t('最近1小时'),
    },
    line: {
      style: {
        curveType: 'monotone',
        lineWidth: 2,
      },
    },
    point: {
      visible: true,
      style: {
        size: 6,
        fill: (datum) => (datum.success ? undefined : '#ff4d4f'),
        stroke: (datum) => (datum.success ? undefined : '#ff4d4f'),
      },
    },
    axes: [
      { orient: 'bottom', label: { autoRotate: true } },
      { orient: 'left', title: { visible: true, text: 'ms' } },
    ],
  };

  return (
    <div className='p-4'>
      <Typography.Title heading={3} className='mb-4'>{t('分组状态')}</Typography.Title>

      {/* 状态卡片 */}
      <Row gutter={16} className='mb-4'>
        {statusData.map((item) => {
          const availColor = item.availability >= 95 ? '#52c41a' : item.availability >= 80 ? '#faad14' : '#ff4d4f';
          return (
            <Col key={item.group_name} xs={24} sm={12} md={8} lg={6} className='mb-4'>
              <Card
                bodyStyle={{ padding: '16px' }}
                style={{
                  borderLeft: `4px solid ${item.latest_success ? '#52c41a' : '#ff4d4f'}`,
                }}
              >
                <div className='font-semibold text-base mb-2'>{item.group_name}</div>
                <div className='flex justify-between mb-1'>
                  <span className='text-gray-500'>{t('状态')}</span>
                  {item.latest_success ? (
                    <Tag color='green' size='small'>{t('正常')}</Tag>
                  ) : (
                    <Tag color='red' size='small'>{t('异常')}</Tag>
                  )}
                </div>
                <div className='flex justify-between mb-1'>
                  <span className='text-gray-500'>{t('延迟')}</span>
                  <span>{item.latest_latency}ms</span>
                </div>
                <div className='flex justify-between mb-1'>
                  <span className='text-gray-500'>{t('可用率')}</span>
                  <span style={{ color: availColor }}>
                    {item.availability > 0 ? `${item.availability.toFixed(1)}%` : '-'}
                  </span>
                </div>
                <div className='flex justify-between mb-1'>
                  <span className='text-gray-500'>{t('平均延迟')}</span>
                  <span>{item.avg_latency > 0 ? `${Math.round(item.avg_latency)}ms` : '-'}</span>
                </div>
                <div className='text-xs text-gray-400 mt-2'>
                  {item.latest_time > 0 ? dayjs.unix(item.latest_time).format('YYYY-MM-DD HH:mm:ss') : '-'}
                </div>
              </Card>
            </Col>
          );
        })}
        {statusData.length === 0 && (
          <Col span={24}>
            <div className='text-center text-gray-400 py-8'>{t('暂无监控数据')}</div>
          </Col>
        )}
      </Row>

      {/* 延迟趋势图 */}
      {timeSeriesData.length > 0 && (
        <Card title={t('延迟趋势')}>
          <div className='h-96 p-2'>
            <VChart spec={chartSpec} option={CHART_CONFIG} />
          </div>
        </Card>
      )}
    </div>
  );
};

export default GroupMonitorUser;
