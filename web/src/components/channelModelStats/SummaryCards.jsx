import React from 'react';
import { Card, Row, Col, Typography, Progress } from '@douyinfe/semi-ui';
import { 
  IconPulse, 
  IconCheckCircleStroked, 
  IconClock, 
  IconCode,
  IconClose
} from '@douyinfe/semi-icons';

const { Text, Title } = Typography;

const SummaryCards = ({ data = {}, t }) => {
  const formatNumber = (num) => {
    if (num === null || num === undefined) return '-';
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toLocaleString();
  };

  const formatQuota = (quota) => {
    if (quota === null || quota === undefined) return '-';
    const dollars = quota / 500000;
    return `$${dollars.toFixed(4)}`;
  };

  const safeData = data || {};
  const successRate = safeData.success_rate || 0;
  const avgResponseTime = safeData.avg_response_time || 0;
  const failedCalls = safeData.failed_calls || 0;

  const cards = [
    {
      title: t('总调用次数'),
      value: formatNumber(safeData.total_calls),
      icon: <IconPulse size="large" />,
      color: '#2196F3',
      subValue: (
        <span>
          <span style={{ color: '#4CAF50' }}>{t('成功')}: {formatNumber(safeData.success_calls)}</span>
          {' / '}
          <span style={{ color: '#F44336' }}>{t('失败')}: {formatNumber(failedCalls)}</span>
        </span>
      ),
    },
    {
      title: t('成功率'),
      value: `${successRate.toFixed(2)}%`,
      icon: <IconCheckCircleStroked size="large" />,
      color: successRate >= 95 ? '#4CAF50' : successRate >= 80 ? '#FF9800' : '#F44336',
      progress: successRate,
    },
    {
      title: t('平均响应时间'),
      value: `${avgResponseTime.toFixed(2)}s`,
      icon: <IconClock size="large" />,
      color: avgResponseTime <= 3 ? '#4CAF50' : avgResponseTime <= 10 ? '#FF9800' : '#F44336',
      subValue: `${t('最小')}: ${(safeData.min_response_time || 0).toFixed(2)}s / ${t('最大')}: ${(safeData.max_response_time || 0).toFixed(2)}s`,
    },
    {
      title: t('Token使用量'),
      value: formatNumber((safeData.total_prompt_tokens || 0) + (safeData.total_completion_tokens || 0)),
      icon: <IconCode size="large" />,
      color: '#9C27B0',
      subValue: `${t('输入')}: ${formatNumber(safeData.total_prompt_tokens)} / ${t('输出')}: ${formatNumber(safeData.total_completion_tokens)}`,
    },
    {
      title: t('消耗额度'),
      value: formatQuota(safeData.total_quota),
      icon: <IconPulse size="large" />,
      color: '#FF5722',
    },
    {
      title: t('渠道/模型数'),
      value: `${safeData.unique_channels || 0} / ${safeData.unique_models || 0}`,
      icon: <IconCode size="large" />,
      color: '#607D8B',
      subValue: `${t('渠道')} / ${t('模型')}`,
    },
  ];

  return (
    <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
      {cards.map((card, index) => (
        <Col xs={24} sm={12} md={8} lg={4} key={index}>
          <Card
            shadows="hover"
            style={{ 
              height: '100%',
              borderLeft: `4px solid ${card.color}`,
            }}
            bodyStyle={{ padding: '16px' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <Text type="tertiary" size="small">{card.title}</Text>
                <Title heading={4} style={{ margin: '8px 0', color: card.color }}>
                  {card.value}
                </Title>
                {card.subValue && (
                  <Text type="tertiary" size="small">{card.subValue}</Text>
                )}
                {card.progress !== undefined && (
                  <Progress 
                    percent={card.progress} 
                    showInfo={false}
                    size="small"
                    style={{ marginTop: '8px' }}
                    stroke={card.color}
                  />
                )}
              </div>
              <div style={{ color: card.color, opacity: 0.3 }}>
                {card.icon}
              </div>
            </div>
          </Card>
        </Col>
      ))}
    </Row>
  );
};

export default SummaryCards;

