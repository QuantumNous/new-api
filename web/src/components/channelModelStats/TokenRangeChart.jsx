import React, { useState, useEffect, useMemo } from 'react';
import { VChart } from '@visactor/react-vchart';
import { Empty, Select, Spin, RadioGroup, Radio, Card, Row, Col, Typography } from '@douyinfe/semi-ui';
import { API, showError } from '../../helpers';

const { Text, Title } = Typography;

const TokenRangeChart = ({ 
  startTimestamp, 
  endTimestamp, 
  channelIds, 
  modelNames,
  t 
}) => {
  const [loading, setLoading] = useState(false);
  const [tokenType, setTokenType] = useState('prompt');
  const [viewType, setViewType] = useState('response_time'); // response_time | percentile | call_count
  const [data, setData] = useState([]);

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('token_type', tokenType);
        if (startTimestamp) params.set('start_timestamp', startTimestamp);
        if (endTimestamp) params.set('end_timestamp', endTimestamp);
        if (channelIds?.length > 0) params.set('channel_ids', channelIds.join(','));
        if (modelNames?.length > 0) params.set('model_names', modelNames.join(','));

        const res = await API.get(`/api/channel/stats/token-range?${params.toString()}`);
        if (res.data.success) {
          setData(res.data.data || []);
        } else {
          showError(res.data.message || t('加载数据失败'));
        }
      } catch (error) {
        showError(t('加载数据失败'));
        console.error('Failed to load token range stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [tokenType, startTimestamp, endTimestamp, channelIds, modelNames, t]);

  // 安全获取数值
  const safeNumber = (val) => (typeof val === 'number' && !isNaN(val)) ? val : 0;

  // 响应时间图表
  const responseTimeSpec = useMemo(() => {
    if (!data || data.length === 0) return null;

    const chartData = data.map(item => ({
      range: item.token_range,
      avg: safeNumber(item.avg_response_time),
      min: safeNumber(item.min_response_time),
      max: safeNumber(item.max_response_time),
    }));

    return {
      type: 'bar',
      data: [{ id: 'data', values: chartData }],
      xField: 'range',
      yField: 'avg',
      bar: {
        style: {
          cornerRadius: [4, 4, 0, 0],
          fill: {
            gradient: 'linear',
            x0: 0,
            y0: 0,
            x1: 0,
            y1: 1,
            stops: [
              { offset: 0, color: '#667eea' },
              { offset: 1, color: '#764ba2' }
            ]
          }
        },
      },
      label: {
        visible: true,
        position: 'inside-top',
        style: {
          fill: '#fff',
          fontSize: 10,
        },
        formatMethod: (value) => {
          const num = typeof value === 'number' ? value : 0;
          return `${num.toFixed(1)}s`;
        },
      },
      axes: [
        {
          orient: 'left',
          title: {
            visible: true,
            text: t('平均响应时间(秒)'),
          },
          grid: {
            visible: true,
            style: {
              lineDash: [4, 4],
              stroke: 'rgba(0,0,0,0.1)',
            },
          },
        },
        {
          orient: 'bottom',
          title: {
            visible: true,
            text: tokenType === 'prompt' ? t('输入Token范围') : t('输出Token范围'),
          },
          label: {
            visible: true,
            autoRotate: true,
            autoRotateAngle: [-45, -30, 0],
            style: {
              fontSize: 11,
            },
          },
          bandPadding: 0.2,
        },
      ],
      tooltip: {
        mark: {
          content: [
            { key: t('Token范围'), value: (datum) => String(datum.range || '') },
            { key: t('平均'), value: (datum) => `${safeNumber(datum.avg).toFixed(2)}s` },
            { key: t('最小'), value: (datum) => `${safeNumber(datum.min).toFixed(2)}s` },
            { key: t('最大'), value: (datum) => `${safeNumber(datum.max).toFixed(2)}s` },
          ],
        },
      },
      title: {
        visible: true,
        text: t('Token范围响应时间分析'),
        subtext: tokenType === 'prompt' ? t('按输入Token范围统计') : t('按输出Token范围统计'),
      },
      padding: { left: 60, right: 30, top: 60, bottom: 80 },
    };
  }, [data, tokenType, t]);

  // 百分位图表
  const percentileSpec = useMemo(() => {
    if (!data || data.length === 0) return null;

    const chartData = [];
    data.forEach(item => {
      chartData.push({ range: item.token_range, type: 'P50', value: safeNumber(item.p50_response_time) });
      chartData.push({ range: item.token_range, type: 'P90', value: safeNumber(item.p90_response_time) });
      chartData.push({ range: item.token_range, type: 'P95', value: safeNumber(item.p95_response_time) });
      chartData.push({ range: item.token_range, type: 'P99', value: safeNumber(item.p99_response_time) });
    });

    return {
      type: 'bar',
      data: [{ id: 'data', values: chartData }],
      xField: 'range',
      yField: 'value',
      seriesField: 'type',
      bar: {
        style: {
          cornerRadius: [4, 4, 0, 0],
        },
      },
      legends: {
        visible: true,
        orient: 'top',
      },
      axes: [
        {
          orient: 'left',
          title: {
            visible: true,
            text: t('响应时间(秒)'),
          },
          grid: {
            visible: true,
            style: {
              lineDash: [4, 4],
              stroke: 'rgba(0,0,0,0.1)',
            },
          },
        },
        {
          orient: 'bottom',
          title: {
            visible: true,
            text: tokenType === 'prompt' ? t('输入Token范围') : t('输出Token范围'),
          },
          label: {
            visible: true,
            autoRotate: true,
            autoRotateAngle: [-45, -30, 0],
            style: {
              fontSize: 11,
            },
          },
          bandPadding: 0.2,
        },
      ],
      tooltip: {
        mark: {
          content: [
            { key: t('Token范围'), value: (datum) => String(datum.range || '') },
            { key: t('类型'), value: (datum) => String(datum.type || '') },
            { key: t('响应时间'), value: (datum) => `${safeNumber(datum.value).toFixed(2)}s` },
          ],
        },
      },
      color: ['#4CAF50', '#2196F3', '#FF9800', '#F44336'],
      title: {
        visible: true,
        text: t('Token范围响应时间百分位'),
        subtext: t('P50/P90/P95/P99分布'),
      },
      padding: { left: 60, right: 30, top: 60, bottom: 80 },
    };
  }, [data, tokenType, t]);

  // 调用次数图表
  const callCountSpec = useMemo(() => {
    if (!data || data.length === 0) return null;

    const chartData = data.map(item => ({
      range: item.token_range,
      call_count: safeNumber(item.call_count),
      avgTokens: safeNumber(item.avg_tokens),
    }));

    return {
      type: 'bar',
      data: [{ id: 'data', values: chartData }],
      xField: 'range',
      yField: 'call_count',
      bar: {
        style: {
          cornerRadius: [4, 4, 0, 0],
          fill: {
            gradient: 'linear',
            x0: 0,
            y0: 0,
            x1: 0,
            y1: 1,
            stops: [
              { offset: 0, color: '#11998e' },
              { offset: 1, color: '#38ef7d' }
            ]
          }
        },
      },
      label: {
        visible: true,
        position: 'inside-top',
        style: {
          fill: '#fff',
          fontSize: 10,
        },
        formatMethod: (value) => {
          const count = typeof value === 'number' ? value : 0;
          if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
          return String(count);
        },
      },
      axes: [
        {
          orient: 'left',
          title: {
            visible: true,
            text: t('调用次数'),
          },
          grid: {
            visible: true,
            style: {
              lineDash: [4, 4],
              stroke: 'rgba(0,0,0,0.1)',
            },
          },
        },
        {
          orient: 'bottom',
          title: {
            visible: true,
            text: tokenType === 'prompt' ? t('输入Token范围') : t('输出Token范围'),
          },
          label: {
            visible: true,
            autoRotate: true,
            autoRotateAngle: [-45, -30, 0],
            style: {
              fontSize: 11,
            },
          },
          bandPadding: 0.2,
        },
      ],
      tooltip: {
        mark: {
          content: [
            { key: t('Token范围'), value: (datum) => String(datum.range || '') },
            { key: t('调用次数'), value: (datum) => String(safeNumber(datum.call_count).toLocaleString()) },
            { key: t('平均Token'), value: (datum) => String(safeNumber(datum.avgTokens).toFixed(0)) },
          ],
        },
      },
      title: {
        visible: true,
        text: t('Token范围调用分布'),
        subtext: tokenType === 'prompt' ? t('按输入Token范围统计调用次数') : t('按输出Token范围统计调用次数'),
      },
      padding: { left: 60, right: 30, top: 60, bottom: 80 },
    };
  }, [data, tokenType, t]);

  const currentSpec = useMemo(() => {
    switch (viewType) {
      case 'response_time':
        return responseTimeSpec;
      case 'percentile':
        return percentileSpec;
      case 'call_count':
        return callCountSpec;
      default:
        return responseTimeSpec;
    }
  }, [viewType, responseTimeSpec, percentileSpec, callCountSpec]);

  const viewOptions = [
    { value: 'response_time', label: t('平均响应时间') },
    { value: 'percentile', label: t('响应时间百分位') },
    { value: 'call_count', label: t('调用次数分布') },
  ];

  // 计算汇总统计
  const summaryStats = useMemo(() => {
    if (!data || data.length === 0) return null;
    const totalCalls = data.reduce((sum, item) => sum + safeNumber(item.call_count), 0);
    const avgTime = data.reduce((sum, item) => sum + safeNumber(item.avg_response_time) * safeNumber(item.call_count), 0) / (totalCalls || 1);
    const maxP99 = Math.max(...data.map(item => safeNumber(item.p99_response_time)));
    return { totalCalls, avgTime, maxP99 };
  }, [data]);

  return (
    <div>
      {/* 控制面板 */}
      <Card 
        style={{ 
          marginBottom: '16px',
          background: 'var(--semi-color-bg-1)'
        }}
        bodyStyle={{ padding: '12px 16px' }}
      >
        <Row gutter={16} align="middle">
          <Col span={12}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Text strong style={{ whiteSpace: 'nowrap' }}>{t('Token类型')}:</Text>
              <RadioGroup
                type="button"
                value={tokenType}
                onChange={(e) => setTokenType(e.target.value)}
              >
                <Radio value="prompt">{t('输入Token')}</Radio>
                <Radio value="completion">{t('输出Token')}</Radio>
              </RadioGroup>
            </div>
          </Col>
          <Col span={12}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'flex-end' }}>
              <Text strong style={{ whiteSpace: 'nowrap' }}>{t('图表类型')}:</Text>
              <Select
                value={viewType}
                onChange={setViewType}
                optionList={viewOptions}
                style={{ width: '180px' }}
              />
            </div>
          </Col>
        </Row>
      </Card>

      {/* 汇总统计 */}
      {summaryStats && (
        <Row gutter={16} style={{ marginBottom: '16px' }}>
          <Col span={8}>
            <Card bodyStyle={{ padding: '12px', textAlign: 'center' }}>
              <Text type="tertiary" size="small">{t('总调用次数')}</Text>
              <Title heading={4} style={{ margin: '4px 0', color: 'var(--semi-color-primary)' }}>
                {summaryStats.totalCalls.toLocaleString()}
              </Title>
            </Card>
          </Col>
          <Col span={8}>
            <Card bodyStyle={{ padding: '12px', textAlign: 'center' }}>
              <Text type="tertiary" size="small">{t('加权平均响应时间')}</Text>
              <Title heading={4} style={{ margin: '4px 0', color: 'var(--semi-color-success)' }}>
                {summaryStats.avgTime.toFixed(2)}s
              </Title>
            </Card>
          </Col>
          <Col span={8}>
            <Card bodyStyle={{ padding: '12px', textAlign: 'center' }}>
              <Text type="tertiary" size="small">{t('最大P99响应时间')}</Text>
              <Title heading={4} style={{ margin: '4px 0', color: 'var(--semi-color-warning)' }}>
                {summaryStats.maxP99.toFixed(2)}s
              </Title>
            </Card>
          </Col>
        </Row>
      )}

      {/* 图表 */}
      <Spin spinning={loading}>
        {currentSpec ? (
          <div style={{ width: '100%', height: '400px' }}>
            <VChart spec={currentSpec} option={{ mode: 'desktop-browser' }} />
          </div>
        ) : (
          <Empty description={t('暂无数据')} />
        )}
      </Spin>

      {/* 数据表格摘要 */}
      {data && data.length > 0 && (
        <div style={{ 
          marginTop: '16px', 
          padding: '12px', 
          background: 'var(--semi-color-bg-1)',
          borderRadius: '8px',
          overflowX: 'auto'
        }}>
          <Text strong style={{ marginBottom: '8px', display: 'block' }}>
            {t('各Token范围详情')}
          </Text>
          <div style={{ 
            display: 'flex',
            gap: '6px',
            fontSize: '11px',
            minWidth: 'max-content'
          }}>
            {data.map((item, index) => (
              <div 
                key={index}
                style={{
                  padding: '8px 10px',
                  background: 'var(--semi-color-bg-2)',
                  borderRadius: '4px',
                  textAlign: 'center',
                  minWidth: '90px',
                  flex: '1 1 0',
                  border: '1px solid var(--semi-color-border)'
                }}
              >
                <div style={{ 
                  fontWeight: 'bold', 
                  marginBottom: '4px',
                  fontSize: '12px',
                  color: 'var(--semi-color-primary)'
                }}>
                  {item.token_range}
                </div>
                <div style={{ color: 'var(--semi-color-text-2)', marginBottom: '2px' }}>
                  {t('调用')}: {safeNumber(item.call_count).toLocaleString()}
                </div>
                <div style={{ color: 'var(--semi-color-text-2)', marginBottom: '2px' }}>
                  {t('平均')}: {safeNumber(item.avg_response_time).toFixed(2)}s
                </div>
                <div style={{ color: 'var(--semi-color-warning)', fontWeight: '500' }}>
                  P99: {safeNumber(item.p99_response_time).toFixed(2)}s
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TokenRangeChart;

