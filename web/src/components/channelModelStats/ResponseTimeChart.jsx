import React, { useMemo, useState } from 'react';
import { VChart } from '@visactor/react-vchart';
import { Empty, Row, Col, Card, Typography, RadioGroup, Radio, Tag } from '@douyinfe/semi-ui';

const { Text, Title } = Typography;

const ResponseTimeChart = ({ data, t }) => {
  const [viewMode, setViewMode] = useState('bar'); // bar | line | radar

  // 安全获取数值
  const safeNumber = (val) => (typeof val === 'number' && !isNaN(val)) ? val : 0;

  // 计算汇总统计
  const summaryStats = useMemo(() => {
    if (!data || data.length === 0) return null;
    const avgP50 = data.reduce((sum, item) => sum + safeNumber(item.p50), 0) / data.length;
    const avgP90 = data.reduce((sum, item) => sum + safeNumber(item.p90), 0) / data.length;
    const avgP95 = data.reduce((sum, item) => sum + safeNumber(item.p95), 0) / data.length;
    const avgP99 = data.reduce((sum, item) => sum + safeNumber(item.p99), 0) / data.length;
    const avgTime = data.reduce((sum, item) => sum + safeNumber(item.avg), 0) / data.length;
    const maxP99 = Math.max(...data.map(item => safeNumber(item.p99)));
    const minP50 = Math.min(...data.filter(item => safeNumber(item.p50) > 0).map(item => safeNumber(item.p50))) || 0;
    return { avgP50, avgP90, avgP95, avgP99, avgTime, maxP99, minP50 };
  }, [data]);

  // 获取响应时间颜色
  const getTimeColor = (time) => {
    if (time <= 1) return 'green';
    if (time <= 3) return 'lime';
    if (time <= 5) return 'yellow';
    if (time <= 10) return 'orange';
    return 'red';
  };

  // 柱状图
  const barSpec = useMemo(() => {
    if (!data || data.length === 0) return null;

    const chartData = [];
    data.forEach(item => {
      chartData.push({ name: String(item.name || ''), type: 'P50', value: safeNumber(item.p50) });
      chartData.push({ name: String(item.name || ''), type: 'P90', value: safeNumber(item.p90) });
      chartData.push({ name: String(item.name || ''), type: 'P95', value: safeNumber(item.p95) });
      chartData.push({ name: String(item.name || ''), type: 'P99', value: safeNumber(item.p99) });
      chartData.push({ name: String(item.name || ''), type: t('平均'), value: safeNumber(item.avg) });
    });

    return {
      type: 'bar',
      data: [{ id: 'data', values: chartData }],
      xField: 'name',
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
          label: {
            autoRotate: true,
            autoRotateAngle: [0, 45, 90],
          },
        },
      ],
      tooltip: {
        mark: {
          content: [
            { key: t('渠道-模型'), value: (datum) => String(datum?.name || '') },
            { key: (datum) => String(datum?.type || ''), value: (datum) => `${safeNumber(datum?.value).toFixed(2)}s` },
          ],
        },
      },
      color: ['#4CAF50', '#2196F3', '#FF9800', '#F44336', '#9C27B0'],
      title: {
        visible: true,
        text: t('响应时间百分位对比'),
        subtext: t('P50/P90/P95/P99响应时间分布'),
      },
      padding: { left: 60, right: 30, top: 60, bottom: 80 },
    };
  }, [data, t]);

  // 折线图
  const lineSpec = useMemo(() => {
    if (!data || data.length === 0) return null;

    const chartData = [];
    data.forEach(item => {
      chartData.push({ name: String(item.name || ''), type: 'P50', value: safeNumber(item.p50) });
      chartData.push({ name: String(item.name || ''), type: 'P90', value: safeNumber(item.p90) });
      chartData.push({ name: String(item.name || ''), type: 'P95', value: safeNumber(item.p95) });
      chartData.push({ name: String(item.name || ''), type: 'P99', value: safeNumber(item.p99) });
      chartData.push({ name: String(item.name || ''), type: t('平均'), value: safeNumber(item.avg) });
    });

    return {
      type: 'line',
      data: [{ id: 'data', values: chartData }],
      xField: 'name',
      yField: 'value',
      seriesField: 'type',
      point: {
        visible: true,
        style: {
          size: 8,
        },
      },
      line: {
        style: {
          lineWidth: 2,
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
          label: {
            autoRotate: true,
            autoRotateAngle: [0, 45, 90],
          },
        },
      ],
      tooltip: {
        mark: {
          content: [
            { key: t('渠道-模型'), value: (datum) => String(datum?.name || '') },
            { key: (datum) => String(datum?.type || ''), value: (datum) => `${safeNumber(datum?.value).toFixed(2)}s` },
          ],
        },
      },
      color: ['#4CAF50', '#2196F3', '#FF9800', '#F44336', '#9C27B0'],
      title: {
        visible: true,
        text: t('响应时间趋势对比'),
        subtext: t('各渠道模型响应时间变化'),
      },
      padding: { left: 60, right: 30, top: 60, bottom: 80 },
    };
  }, [data, t]);

  // 雷达图 - 用于比较单个渠道模型的各百分位
  const radarSpec = useMemo(() => {
    if (!data || data.length === 0) return null;

    // 取前5个数据进行雷达图对比
    const topData = data.slice(0, 5);
    const chartData = [];
    topData.forEach(item => {
      chartData.push({ name: String(item.name || ''), type: 'P50', value: safeNumber(item.p50) });
      chartData.push({ name: String(item.name || ''), type: 'P90', value: safeNumber(item.p90) });
      chartData.push({ name: String(item.name || ''), type: 'P95', value: safeNumber(item.p95) });
      chartData.push({ name: String(item.name || ''), type: 'P99', value: safeNumber(item.p99) });
      chartData.push({ name: String(item.name || ''), type: t('平均'), value: safeNumber(item.avg) });
    });

    return {
      type: 'radar',
      data: [{ id: 'data', values: chartData }],
      categoryField: 'type',
      valueField: 'value',
      seriesField: 'name',
      point: {
        visible: true,
      },
      area: {
        visible: true,
        style: {
          fillOpacity: 0.2,
        },
      },
      legends: {
        visible: true,
        orient: 'right',
      },
      tooltip: {
        mark: {
          content: [
            { key: (datum) => String(datum?.name || ''), value: (datum) => `${safeNumber(datum?.value).toFixed(2)}s` },
          ],
        },
      },
      title: {
        visible: true,
        text: t('响应时间雷达图'),
        subtext: t('前5个渠道模型对比'),
      },
    };
  }, [data, t]);

  const currentSpec = useMemo(() => {
    switch (viewMode) {
      case 'line': return lineSpec;
      case 'radar': return radarSpec;
      default: return barSpec;
    }
  }, [viewMode, barSpec, lineSpec, radarSpec]);

  if (!data || data.length === 0) {
    return <Empty description={t('暂无数据')} />;
  }

  return (
    <div>
      {/* 汇总统计卡片 */}
      {summaryStats && (
        <Row gutter={16} style={{ marginBottom: '16px' }}>
          <Col span={4}>
            <Card bodyStyle={{ padding: '10px', textAlign: 'center' }}>
              <Text type="tertiary" size="small">{t('平均响应')}</Text>
              <Title heading={5} style={{ margin: '4px 0' }}>
                <Tag color={getTimeColor(summaryStats.avgTime)} size="large">
                  {summaryStats.avgTime.toFixed(2)}s
                </Tag>
              </Title>
            </Card>
          </Col>
          <Col span={4}>
            <Card bodyStyle={{ padding: '10px', textAlign: 'center' }}>
              <Text type="tertiary" size="small">P50</Text>
              <Title heading={5} style={{ margin: '4px 0' }}>
                <Tag color={getTimeColor(summaryStats.avgP50)} size="large">
                  {summaryStats.avgP50.toFixed(2)}s
                </Tag>
              </Title>
            </Card>
          </Col>
          <Col span={4}>
            <Card bodyStyle={{ padding: '10px', textAlign: 'center' }}>
              <Text type="tertiary" size="small">P90</Text>
              <Title heading={5} style={{ margin: '4px 0' }}>
                <Tag color={getTimeColor(summaryStats.avgP90)} size="large">
                  {summaryStats.avgP90.toFixed(2)}s
                </Tag>
              </Title>
            </Card>
          </Col>
          <Col span={4}>
            <Card bodyStyle={{ padding: '10px', textAlign: 'center' }}>
              <Text type="tertiary" size="small">P95</Text>
              <Title heading={5} style={{ margin: '4px 0' }}>
                <Tag color={getTimeColor(summaryStats.avgP95)} size="large">
                  {summaryStats.avgP95.toFixed(2)}s
                </Tag>
              </Title>
            </Card>
          </Col>
          <Col span={4}>
            <Card bodyStyle={{ padding: '10px', textAlign: 'center' }}>
              <Text type="tertiary" size="small">P99</Text>
              <Title heading={5} style={{ margin: '4px 0' }}>
                <Tag color={getTimeColor(summaryStats.avgP99)} size="large">
                  {summaryStats.avgP99.toFixed(2)}s
                </Tag>
              </Title>
            </Card>
          </Col>
          <Col span={4}>
            <Card bodyStyle={{ padding: '10px', textAlign: 'center' }}>
              <Text type="tertiary" size="small">{t('最大P99')}</Text>
              <Title heading={5} style={{ margin: '4px 0' }}>
                <Tag color="red" size="large">
                  {summaryStats.maxP99.toFixed(2)}s
                </Tag>
              </Title>
            </Card>
          </Col>
        </Row>
      )}

      {/* 视图切换 */}
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-end' }}>
        <RadioGroup
          type="button"
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value)}
        >
          <Radio value="bar">{t('柱状图')}</Radio>
          <Radio value="line">{t('折线图')}</Radio>
          <Radio value="radar">{t('雷达图')}</Radio>
        </RadioGroup>
      </div>

      {/* 图表 */}
      {currentSpec ? (
        <div style={{ width: '100%', height: '400px' }}>
          <VChart spec={currentSpec} option={{ mode: 'desktop-browser' }} />
        </div>
      ) : (
        <Empty description={t('暂无数据')} />
      )}

      {/* 详细数据 */}
      {data && data.length > 0 && viewMode !== 'radar' && (
        <div style={{ 
          marginTop: '16px', 
          padding: '12px', 
          background: 'var(--semi-color-bg-1)',
          borderRadius: '8px',
          overflowX: 'auto'
        }}>
          <Text strong style={{ marginBottom: '8px', display: 'block' }}>{t('各渠道模型响应时间详情')}</Text>
          <div style={{ 
            display: 'flex',
            gap: '8px',
            fontSize: '11px',
            minWidth: 'max-content'
          }}>
            {data.slice(0, 10).map((item, index) => (
              <div 
                key={index}
                style={{
                  padding: '10px',
                  background: 'var(--semi-color-bg-2)',
                  borderRadius: '6px',
                  textAlign: 'center',
                  minWidth: '110px',
                  flex: '1 1 0',
                  border: '1px solid var(--semi-color-border)'
                }}
              >
                <div style={{ 
                  fontWeight: 'bold', 
                  marginBottom: '6px',
                  fontSize: '11px',
                  color: 'var(--semi-color-text-0)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {item.name}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <Text type="tertiary" size="small">{t('平均')}:</Text>
                  <Tag color={getTimeColor(safeNumber(item.avg))} size="small">{safeNumber(item.avg).toFixed(2)}s</Tag>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <Text type="tertiary" size="small">P50:</Text>
                  <Text size="small">{safeNumber(item.p50).toFixed(2)}s</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <Text type="tertiary" size="small">P90:</Text>
                  <Text size="small">{safeNumber(item.p90).toFixed(2)}s</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <Text type="tertiary" size="small">P95:</Text>
                  <Text size="small">{safeNumber(item.p95).toFixed(2)}s</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="tertiary" size="small">P99:</Text>
                  <Tag color={getTimeColor(safeNumber(item.p99))} size="small">{safeNumber(item.p99).toFixed(2)}s</Tag>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ResponseTimeChart;

