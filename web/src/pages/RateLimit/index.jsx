import React, { useState, useEffect } from 'react';
import { Layout, Card, Select, Table, Typography, Progress, Tag, Banner } from '@douyinfe/semi-ui';
import { API, showError } from '../../helpers';
import { useTranslation } from 'react-i18next';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

const RateLimit = () => {
  const { t } = useTranslation();
  const [channels, setChannels] = useState([]);
  const [selectedChannelId, setSelectedChannelId] = useState(null);
  const [monitorData, setMonitorData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [monitorLoading, setMonitorLoading] = useState(false);

  const loadChannels = async () => {
    setLoading(true);
    try {
      // 获取前100个渠道
      const res = await API.get('/api/channel?p=0&size=100');
      const { success, message, data } = res.data;
      if (success) {
        setChannels(data.items);
        if (data.items.length > 0) {
             // 可选：默认选中第一个
             // setSelectedChannelId(data.items[0].id);
        }
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadMonitorData = async (id) => {
    if (!id) return;
    setMonitorLoading(true);
    try {
      const res = await API.get(`/api/channel/${id}/monitor`);
      const { success, message, data } = res.data;
      if (success) {
        setMonitorData(data);
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error.message);
    } finally {
      setMonitorLoading(false);
    }
  };

  useEffect(() => {
    loadChannels();
  }, []);

  useEffect(() => {
    if (selectedChannelId) {
      loadMonitorData(selectedChannelId);
    } else {
        setMonitorData([]);
    }
  }, [selectedChannelId]);

  const renderLimitColumn = (current, limit) => {
    const percent = limit > 0 ? (current / limit) * 100 : 0;
    const isUnlimited = limit <= 0;
    
    return (
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text strong>{current}</Text>
            <Text type="secondary">/ {isUnlimited ? t('无限制') : limit}</Text>
        </div>
        {!isUnlimited && (
            <Progress 
                percent={Math.min(percent, 100)} 
                showInfo={false} 
                size="small" 
                stroke={percent > 90 ? 'var(--semi-color-danger)' : (percent > 70 ? 'var(--semi-color-warning)' : 'var(--semi-color-primary)')} 
            />
        )}
      </div>
    );
  };

  const columns = [
    {
      title: t('模型'),
      dataIndex: 'model_name',
      key: 'model_name',
      render: (text) => <Tag color='blue' size='large' style={{ fontSize: '14px' }}>{text}</Tag>,
      width: 200,
    },
    {
      title: t('RPM (每分钟请求数)'),
      dataIndex: 'current_rpm',
      key: 'rpm',
      render: (text, record) => renderLimitColumn(text, record.limit_rpm),
    },
    {
      title: t('TPM (每分钟Token数)'),
      dataIndex: 'current_tpm',
      key: 'tpm',
      render: (text, record) => renderLimitColumn(text, record.limit_tpm),
    },
    {
      title: t('RPD (每天请求数)'),
      dataIndex: 'current_rpd',
      key: 'rpd',
      render: (text, record) => renderLimitColumn(text, record.limit_rpd),
    },
  ];

  return (
    <>
      <Layout>
        <Header>
          <Title heading={3}>{t('速率限制监控')}</Title>
        </Header>
        <Content>
            <Banner 
                fullMode={false}
                type="info"
                icon={null}
                closeIcon={null}
                title={t('关于速率限制')}
                description={t('此处展示各渠道模型的实时速率限制状态。数据直接来自 Redis 缓存，可能存在轻微延迟。')}
                style={{ marginBottom: 20 }}
            />
            <Card>
                <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <Text strong style={{ fontSize: 16 }}>{t('选择监控渠道')}:</Text>
                    <Select
                        style={{ width: 320 }}
                        filter
                        placeholder={t('搜索并选择渠道...')}
                        optionList={channels.map(c => ({ value: c.id, label: `${c.id} - ${c.name} (${c.type === 1 ? 'OpenAI' : 'Other'})` }))}
                        onChange={value => setSelectedChannelId(value)}
                        loading={loading}
                    />
                    {selectedChannelId && (
                        <Tag 
                            color='blue' 
                            type='solid' 
                            style={{ cursor: 'pointer' }}
                            onClick={() => loadMonitorData(selectedChannelId)}
                        >
                            {t('刷新数据')}
                        </Tag>
                    )}
                </div>
                
                <Table
                    columns={columns}
                    dataSource={monitorData}
                    loading={monitorLoading}
                    pagination={{ pageSize: 20, showSizeChanger: true }}
                    emptyText={selectedChannelId ? t('该渠道暂无模型限制数据或未配置模型') : t('请先选择一个渠道以查看数据')}
                />
            </Card>
        </Content>
      </Layout>
    </>
  );
};

export default RateLimit;

