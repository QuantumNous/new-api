import React, { useMemo, useState } from 'react';
import { VChart } from '@visactor/react-vchart';
import { Empty, Row, Col, Card, Typography, RadioGroup, Radio, Progress } from '@douyinfe/semi-ui';

const { Text, Title } = Typography;

const CallCountChart = ({ data, t }) => {
  const [viewMode, setViewMode] = useState('stacked'); // stacked | grouped | pie

  // 安全获取数值
  const safeNumber = (val) => (typeof val === 'number' && !isNaN(val)) ? val : 0;

  // 计算汇总统计
  const summaryStats = useMemo(() => {
    if (!data || data.length === 0) return null;
    const totalCalls = data.reduce((sum, item) => sum + safeNumber(item.total_calls), 0);
    const successCalls = data.reduce((sum, item) => sum + safeNumber(item.success_calls), 0);
    const failedCalls = data.reduce((sum, item) => sum + safeNumber(item.failed_calls), 0);
    const avgSuccessRate = totalCalls > 0 ? (successCalls / totalCalls * 100) : 0;
    return { totalCalls, successCalls, failedCalls, avgSuccessRate };
  }, [data]);

  // 堆叠柱状图
  const stackedSpec = useMemo(() => {
    if (!data || data.length === 0) return null;

    const chartData = [];
    data.forEach(item => {
      chartData.push({ 
        name: String(item.name || ''), 
        type: t('成功'), 
        value: safeNumber(item.success_calls),
        rate: safeNumber(item.success_rate)
      });
      chartData.push({ 
        name: String(item.name || ''), 
        type: t('失败'), 
        value: safeNumber(item.failed_calls),
        rate: 100 - safeNumber(item.success_rate)
      });
    });

    return {
      type: 'bar',
      data: [{ id: 'data', values: chartData }],
      xField: 'name',
      yField: 'value',
      seriesField: 'type',
      stack: true,
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
            text: t('调用次数'),
          },
          label: {
            formatMethod: (val) => {
              const num = typeof val === 'number' ? val : 0;
              if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
              if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
              return String(num);
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
            { key: (datum) => String(datum?.type || ''), value: (datum) => String(safeNumber(datum?.value).toLocaleString()) },
          ],
        },
      },
      color: ['#4CAF50', '#F44336'],
      title: {
        visible: true,
        text: t('调用次数分布（堆叠）'),
        subtext: t('成功/失败调用对比'),
      },
      padding: { left: 60, right: 30, top: 60, bottom: 80 },
    };
  }, [data, t]);

  // 分组柱状图
  const groupedSpec = useMemo(() => {
    if (!data || data.length === 0) return null;

    const chartData = [];
    data.forEach(item => {
      chartData.push({ 
        name: String(item.name || ''), 
        type: t('总调用'), 
        value: safeNumber(item.total_calls)
      });
      chartData.push({ 
        name: String(item.name || ''), 
        type: t('成功'), 
        value: safeNumber(item.success_calls)
      });
      chartData.push({ 
        name: String(item.name || ''), 
        type: t('失败'), 
        value: safeNumber(item.failed_calls)
      });
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
            text: t('调用次数'),
          },
          label: {
            formatMethod: (val) => {
              const num = typeof val === 'number' ? val : 0;
              if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
              if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
              return String(num);
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
            { key: (datum) => String(datum?.type || ''), value: (datum) => String(safeNumber(datum?.value).toLocaleString()) },
          ],
        },
      },
      color: ['#2196F3', '#4CAF50', '#F44336'],
      title: {
        visible: true,
        text: t('调用次数分布（分组）'),
        subtext: t('总量/成功/失败对比'),
      },
      padding: { left: 60, right: 30, top: 60, bottom: 80 },
    };
  }, [data, t]);

  // 饼图 - 成功率分布
  const pieSpec = useMemo(() => {
    if (!data || data.length === 0) return null;

    const totalSuccess = data.reduce((sum, item) => sum + safeNumber(item.success_calls), 0);
    const totalFailed = data.reduce((sum, item) => sum + safeNumber(item.failed_calls), 0);

    const chartData = [
      { type: t('成功'), value: totalSuccess },
      { type: t('失败'), value: totalFailed },
    ];

    return {
      type: 'pie',
      data: [{ id: 'data', values: chartData }],
      valueField: 'value',
      categoryField: 'type',
      outerRadius: 0.8,
      innerRadius: 0.5,
      pie: {
        style: {
          cornerRadius: 4,
        },
      },
      label: {
        visible: true,
        position: 'outside',
        formatMethod: (text, datum) => `${String(datum?.type || '')}: ${safeNumber(datum?.value).toLocaleString()}`,
      },
      legends: {
        visible: true,
        orient: 'bottom',
      },
      tooltip: {
        mark: {
          content: [
            { key: (datum) => String(datum?.type || ''), value: (datum) => {
              const total = totalSuccess + totalFailed;
              const percent = total > 0 ? (safeNumber(datum?.value) / total * 100).toFixed(2) : '0';
              return `${safeNumber(datum?.value).toLocaleString()} (${percent}%)`;
            }},
          ],
        },
      },
      color: ['#4CAF50', '#F44336'],
      title: {
        visible: true,
        text: t('整体成功/失败比例'),
        subtext: `${t('总调用')}: ${(totalSuccess + totalFailed).toLocaleString()}`,
      },
    };
  }, [data, t]);

  const currentSpec = useMemo(() => {
    switch (viewMode) {
      case 'grouped': return groupedSpec;
      case 'pie': return pieSpec;
      default: return stackedSpec;
    }
  }, [viewMode, stackedSpec, groupedSpec, pieSpec]);

  if (!data || data.length === 0) {
    return <Empty description={t('暂无数据')} />;
  }

  return (
    <div>
      {/* 汇总统计卡片 */}
      {summaryStats && (
        <Row gutter={16} style={{ marginBottom: '16px' }}>
          <Col span={6}>
            <Card bodyStyle={{ padding: '12px', textAlign: 'center' }}>
              <Text type="tertiary" size="small">{t('总调用次数')}</Text>
              <Title heading={4} style={{ margin: '4px 0', color: 'var(--semi-color-primary)' }}>
                {summaryStats.totalCalls.toLocaleString()}
              </Title>
            </Card>
          </Col>
          <Col span={6}>
            <Card bodyStyle={{ padding: '12px', textAlign: 'center' }}>
              <Text type="tertiary" size="small">{t('成功调用')}</Text>
              <Title heading={4} style={{ margin: '4px 0', color: 'var(--semi-color-success)' }}>
                {summaryStats.successCalls.toLocaleString()}
              </Title>
            </Card>
          </Col>
          <Col span={6}>
            <Card bodyStyle={{ padding: '12px', textAlign: 'center' }}>
              <Text type="tertiary" size="small">{t('失败调用')}</Text>
              <Title heading={4} style={{ margin: '4px 0', color: 'var(--semi-color-danger)' }}>
                {summaryStats.failedCalls.toLocaleString()}
              </Title>
            </Card>
          </Col>
          <Col span={6}>
            <Card bodyStyle={{ padding: '12px', textAlign: 'center' }}>
              <Text type="tertiary" size="small">{t('平均成功率')}</Text>
              <div style={{ marginTop: '4px' }}>
                <Progress 
                  percent={summaryStats.avgSuccessRate} 
                  showInfo 
                  size="small"
                  stroke={summaryStats.avgSuccessRate >= 95 ? '#4CAF50' : summaryStats.avgSuccessRate >= 80 ? '#FF9800' : '#F44336'}
                />
              </div>
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
          <Radio value="stacked">{t('堆叠图')}</Radio>
          <Radio value="grouped">{t('分组图')}</Radio>
          <Radio value="pie">{t('饼图')}</Radio>
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

      {/* 详细数据表格 */}
      {data && data.length > 0 && viewMode !== 'pie' && (
        <div style={{ 
          marginTop: '16px', 
          padding: '12px', 
          background: 'var(--semi-color-bg-1)',
          borderRadius: '8px',
          overflowX: 'auto'
        }}>
          <Text strong style={{ marginBottom: '8px', display: 'block' }}>{t('各渠道模型调用详情')}</Text>
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
                  minWidth: '120px',
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
                <div style={{ color: 'var(--semi-color-text-2)', marginBottom: '2px' }}>
                  {t('总计')}: {safeNumber(item.total_calls).toLocaleString()}
                </div>
                <div style={{ color: 'var(--semi-color-success)', marginBottom: '2px' }}>
                  {t('成功')}: {safeNumber(item.success_calls).toLocaleString()}
                </div>
                <div style={{ color: 'var(--semi-color-danger)', marginBottom: '4px' }}>
                  {t('失败')}: {safeNumber(item.failed_calls).toLocaleString()}
                </div>
                <Progress 
                  percent={safeNumber(item.success_rate)} 
                  showInfo={false}
                  size="small"
                  style={{ width: '100%' }}
                  stroke={safeNumber(item.success_rate) >= 95 ? '#4CAF50' : safeNumber(item.success_rate) >= 80 ? '#FF9800' : '#F44336'}
                />
                <div style={{ fontSize: '10px', color: 'var(--semi-color-text-2)', marginTop: '2px' }}>
                  {safeNumber(item.success_rate).toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CallCountChart;

