import React, { useMemo, useState, useEffect } from 'react';
import { VChart } from '@visactor/react-vchart';
import { Empty, Select, Spin, RadioGroup, Radio, Card, Row, Col, Typography } from '@douyinfe/semi-ui';
import { API, showError } from '../../helpers';

const { Text } = Typography;

const TrendChart = ({ 
  startTimestamp, 
  endTimestamp, 
  channelIds, 
  modelNames,
  t 
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({});
  const [metric, setMetric] = useState('total_calls');
  const [granularity, setGranularity] = useState('day');

  const metricOptions = [
    { value: 'total_calls', label: t('调用次数') },
    { value: 'success_rate', label: t('成功率') },
    { value: 'avg_response_time', label: t('平均响应时间') },
    { value: 'prompt_tokens', label: t('输入Token') },
    { value: 'completion_tokens', label: t('输出Token') },
    { value: 'total_quota', label: t('消耗额度') },
  ];

  const granularityOptions = [
    { value: 'hour', label: t('按小时') },
    { value: 'day', label: t('按天') },
    { value: 'week', label: t('按周') },
  ];

  // 加载趋势数据
  useEffect(() => {
    const loadTrendData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('granularity', granularity);
        if (startTimestamp) params.set('start_timestamp', startTimestamp);
        if (endTimestamp) params.set('end_timestamp', endTimestamp);
        if (channelIds?.length > 0) params.set('channel_ids', channelIds.join(','));
        if (modelNames?.length > 0) params.set('model_names', modelNames.join(','));

        const res = await API.get(`/api/channel/stats/model-trend?${params.toString()}`);
        if (res.data.success) {
          const trendData = res.data.data || {};
          console.log('Trend data loaded:', {
            timePoints: Object.keys(trendData),
            totalTimePoints: Object.keys(trendData).length,
            granularity,
            startTimestamp,
            endTimestamp
          });
          setData(trendData);
        } else {
          showError(res.data.message || t('加载趋势数据失败'));
        }
      } catch (error) {
        showError(t('加载趋势数据失败'));
        console.error('Failed to load trend data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTrendData();
  }, [granularity, startTimestamp, endTimestamp, channelIds, modelNames, t]);

  // 安全获取数值
  const safeNumber = (val) => (typeof val === 'number' && !isNaN(val)) ? val : 0;

  // 对时间点进行排序
  const sortedTimePoints = useMemo(() => {
    if (!data || Object.keys(data).length === 0) return [];
    return Object.keys(data).sort((a, b) => {
      // 尝试按日期排序
      const dateA = new Date(a);
      const dateB = new Date(b);
      if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
        return dateA.getTime() - dateB.getTime();
      }
      return a.localeCompare(b);
    });
  }, [data]);

  const spec = useMemo(() => {
    if (!data || Object.keys(data).length === 0 || sortedTimePoints.length === 0) return null;

    // 转换趋势数据
    const chartData = [];
    const seriesNames = new Set();

    sortedTimePoints.forEach(timePoint => {
      const items = data[timePoint];
      if (!Array.isArray(items)) return;
      items.forEach(item => {
        const seriesName = `${item.channel_name || 'Unknown'}-${item.model_name || 'Unknown'}`;
        seriesNames.add(seriesName);
        
        let value = safeNumber(item[metric]);
        if (metric === 'total_quota') {
          value = value / 500000; // 转换为美元
        }

        chartData.push({
          time: String(timePoint || ''),
          series: String(seriesName),
          value: value,
        });
      });
    });

    if (chartData.length === 0) return null;

    // 调试：打印数据范围
    const values = chartData.map(d => d.value);
    console.log('Chart data debug:', {
      dataLength: chartData.length,
      minValue: Math.min(...values),
      maxValue: Math.max(...values),
      sampleData: chartData.slice(0, 3),
      metric,
      isSinglePoint: sortedTimePoints.length <= 1
    });

    // 格式化Y轴标签
    const formatYAxisLabel = (val) => {
      const num = typeof val === 'number' ? val : 0;
      if (metric === 'success_rate') return `${num.toFixed(0)}%`;
      if (metric === 'avg_response_time') return `${num.toFixed(1)}s`;
      if (metric === 'total_quota') return `$${num.toFixed(2)}`;
      if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
      if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
      return String(num);
    };

    // 简单的折线图配置
    return {
      type: 'line',
      data: [{ id: 'data', values: chartData }],
      xField: 'time',
      yField: 'value',
      seriesField: 'series',
      point: {
        visible: true,
      },
      line: {
        style: {
          lineWidth: 2,
        },
      },
      legends: {
        visible: true,
        orient: 'top',
        maxRow: 2,
      },
      title: {
        visible: true,
        text: t('趋势分析'),
        subtext: `${metricOptions.find(m => m.value === metric)?.label || ''} - ${granularityOptions.find(g => g.value === granularity)?.label || ''}`,
      },
    };
  }, [data, metric, granularity, sortedTimePoints, t]);

  return (
    <div>
      {/* 控制面板 */}
      <Card 
        style={{ marginBottom: '16px', background: 'var(--semi-color-bg-1)' }}
        bodyStyle={{ padding: '12px 16px' }}
      >
        <Row gutter={16} align="middle">
          <Col span={12}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Text strong style={{ whiteSpace: 'nowrap' }}>{t('时间粒度')}:</Text>
              <RadioGroup
                type="button"
                value={granularity}
                onChange={(e) => setGranularity(e.target.value)}
              >
                {granularityOptions.map(opt => (
                  <Radio key={opt.value} value={opt.value}>{opt.label}</Radio>
                ))}
              </RadioGroup>
            </div>
          </Col>
          <Col span={12}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'flex-end' }}>
              <Text strong style={{ whiteSpace: 'nowrap' }}>{t('指标')}:</Text>
              <Select
                value={metric}
                onChange={setMetric}
                optionList={metricOptions}
                style={{ width: '160px' }}
              />
            </div>
          </Col>
        </Row>
      </Card>

      {/* 统计信息 */}
      {sortedTimePoints.length > 0 && (
        <div style={{ marginBottom: '16px', padding: '8px 12px', background: 'var(--semi-color-bg-1)', borderRadius: '6px' }}>
          <Text type="tertiary" size="small">
            {t('数据范围')}: {sortedTimePoints[0]} ~ {sortedTimePoints[sortedTimePoints.length - 1]} 
            {' | '}
            {t('共')} {sortedTimePoints.length} {t('个时间点')}
            {sortedTimePoints.length === 1 && (
              <span style={{ color: 'var(--semi-color-warning)', marginLeft: '8px' }}>
                ({t('仅有一个时间点，建议选择更长的时间范围或更细的时间粒度')})
              </span>
            )}
          </Text>
        </div>
      )}

      {/* 图表 */}
      <Spin spinning={loading}>
        {spec ? (
          <div style={{ width: '100%', height: '400px' }}>
            <VChart spec={spec} option={{ mode: 'desktop-browser' }} />
          </div>
        ) : (
          <Empty description={loading ? t('加载中...') : t('暂无数据')} />
        )}
      </Spin>
    </div>
  );
};

export default TrendChart;

