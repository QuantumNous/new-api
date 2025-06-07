import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Layout,
  Modal,
  Row,
  Space,
  Table,
  Tag,
  Typography,
  Tooltip,
  Spin,
  Progress,
  Toast
} from '@douyinfe/semi-ui';
import {
  IconRefresh,
  IconCheckCircle,
  IconAlertTriangle,
  IconCloudDownload,
  IconInfoCircle,
  IconSetting
} from '@douyinfe/semi-icons';
import { API } from '../../helpers';

const { Title, Text } = Typography;
const { Content } = Layout;

const TokenizerManagement = () => {
  const [tokenizers, setTokenizers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [selectedTokenizers, setSelectedTokenizers] = useState([]);
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateResults, setUpdateResults] = useState([]);

  // 获取分词器列表
  const fetchTokenizers = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/tokenizer/');
      if (res.data.success) {
        setTokenizers(res.data.data || []);
      } else {
        Toast.error('获取分词器列表失败: ' + res.data.message);
      }
    } catch (error) {
      Toast.error('获取分词器列表失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 验证分词器
  const verifyTokenizers = async (channelId) => {
    setLoading(true);
    try {
      const res = await API.get(`/api/tokenizer/verify?channel_id=${channelId}`);
      if (res.data.success) {
        Toast.success('验证完成');
        fetchTokenizers();
      } else {
        Toast.error('验证失败: ' + res.data.message);
      }
    } catch (error) {
      Toast.error('验证失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 更新分词器
  const updateTokenizers = async (channelId, models, force = false) => {
    setUpdateLoading(true);
    setUpdateProgress(0);
    setUpdateResults([]);

    try {
      const res = await API.post('/api/tokenizer/update', {
        channel_id: channelId,
        models: models,
        force: force
      });

      if (res.data.success) {
        setUpdateResults(res.data.results || []);
        setUpdateProgress(100);
        Toast.success(res.data.message);
        setTimeout(() => {
          fetchTokenizers();
        }, 1000);
      } else {
        Toast.error('更新失败: ' + res.data.message);
      }
    } catch (error) {
      Toast.error('更新失败: ' + error.message);
    } finally {
      setUpdateLoading(false);
    }
  };

  // 批量更新选中的分词器
  const handleBatchUpdate = () => {
    if (selectedTokenizers.length === 0) {
      Toast.warning('请选择要更新的分词器');
      return;
    }

    Modal.confirm({
      title: '确认更新',
      content: `确定要更新选中的 ${selectedTokenizers.length} 个分词器吗？`,
      onOk: () => {
        // 按渠道分组
        const channelGroups = {};
        selectedTokenizers.forEach(tokenizer => {
          if (!channelGroups[tokenizer.channel_id]) {
            channelGroups[tokenizer.channel_id] = [];
          }
          channelGroups[tokenizer.channel_id].push(tokenizer.model_name);
        });

        // 逐个渠道更新
        Object.keys(channelGroups).forEach(channelId => {
          updateTokenizers(parseInt(channelId), channelGroups[channelId], false);
        });

        setUpdateModalVisible(true);
      }
    });
  };

  // 强制更新所有分词器
  const handleForceUpdateAll = () => {
    Modal.confirm({
      title: '强制更新所有分词器',
      content: '这将重新下载所有分词器文件，可能需要较长时间。确定继续吗？',
      onOk: () => {
        const allModels = tokenizers.map(t => t.model_name);
        const channelId = tokenizers.length > 0 ? tokenizers[0].channel_id : null;
        
        if (channelId) {
          updateTokenizers(channelId, allModels, true);
          setUpdateModalVisible(true);
        }
      }
    });
  };

  useEffect(() => {
    fetchTokenizers();
  }, []);

  const columns = [
    {
      title: '模型名称',
      dataIndex: 'model_name',
      key: 'model_name',
      width: 300,
      render: (text) => (
        <Text code style={{ fontSize: '12px' }}>
          {text}
        </Text>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => {
        const statusConfig = {
          available: { color: 'green', icon: <IconCheckCircle />, text: '可用' },
          updating: { color: 'blue', icon: <IconCloudDownload />, text: '更新中' },
          error: { color: 'red', icon: <IconAlertTriangle />, text: '错误' }
        };
        const config = statusConfig[status] || statusConfig.error;
        return (
          <Tag color={config.color}>
            {config.icon} {config.text}
          </Tag>
        );
      }
    },
    {
      title: '渠道',
      dataIndex: 'channel_name',
      key: 'channel_name',
      width: 150,
      render: (text, record) => (
        <div>
          <div>{text}</div>
          <Text type="tertiary" style={{ fontSize: '12px' }}>
            ID: {record.channel_id}
          </Text>
        </div>
      )
    },
    {
      title: '最后更新',
      dataIndex: 'last_updated',
      key: 'last_updated',
      width: 180,
      render: (time) => {
        const date = new Date(time);
        return (
          <div>
            <div>{date.toLocaleDateString()}</div>
            <Text type="tertiary" style={{ fontSize: '12px' }}>
              {date.toLocaleTimeString()}
            </Text>
          </div>
        );
      }
    },
    {
      title: '缓存大小',
      dataIndex: 'size',
      key: 'size',
      width: 100,
      render: (size) => (
        <Text type="tertiary">{size}</Text>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Tooltip content="验证分词器">
            <Button
              size="small"
              icon={<IconCheckCircle />}
              onClick={() => verifyTokenizers(record.channel_id)}
            >
              验证
            </Button>
          </Tooltip>
          <Tooltip content="更新分词器">
            <Button
              size="small"
              icon={<IconCloudDownload />}
              onClick={() => updateTokenizers(record.channel_id, [record.model_name])}
            >
              更新
            </Button>
          </Tooltip>
        </Space>
      )
    }
  ];

  const rowSelection = {
    selectedRowKeys: selectedTokenizers.map(t => `${t.channel_id}-${t.model_name}`),
    onChange: (selectedRowKeys, selectedRows) => {
      setSelectedTokenizers(selectedRows);
    }
  };

  return (
    <Layout>
      <Content style={{ padding: '24px' }}>
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Title heading={4} style={{ margin: 0 }}>
                  <IconSetting /> 分词器管理
                </Title>
                <Space>
                  <Button
                    icon={<IconRefresh />}
                    onClick={fetchTokenizers}
                    loading={loading}
                  >
                    刷新
                  </Button>
                  <Button
                    theme="solid"
                    type="primary"
                    icon={<IconCloudDownload />}
                    onClick={handleBatchUpdate}
                    disabled={selectedTokenizers.length === 0}
                  >
                    批量更新 ({selectedTokenizers.length})
                  </Button>
                  <Button
                    theme="solid"
                    type="danger"
                    icon={<IconCloudDownload />}
                    onClick={handleForceUpdateAll}
                  >
                    强制更新全部
                  </Button>
                </Space>
              </div>

              <div style={{ marginBottom: 16 }}>
                <Text type="tertiary">
                  <IconInfoCircle /> 
                  分词器管理用于更新和维护 Hugging Face TEI 模型的分词器缓存。
                  定期更新可以确保使用最新的分词器版本。
                </Text>
              </div>

              <Table
                columns={columns}
                dataSource={tokenizers}
                rowKey={(record) => `${record.channel_id}-${record.model_name}`}
                rowSelection={rowSelection}
                loading={loading}
                pagination={{
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total) => `共 ${total} 个分词器`
                }}
                scroll={{ x: 1200 }}
              />
            </Card>
          </Col>
        </Row>

        {/* 更新进度模态框 */}
        <Modal
          title="分词器更新进度"
          visible={updateModalVisible}
          onCancel={() => setUpdateModalVisible(false)}
          footer={[
            <Button key="close" onClick={() => setUpdateModalVisible(false)}>
              关闭
            </Button>
          ]}
          width={600}
        >
          <div style={{ marginBottom: 16 }}>
            <Progress percent={updateProgress} type={updateLoading ? 'line' : 'line'} />
          </div>
          
          {updateResults.length > 0 && (
            <div>
              <Title heading={5}>更新结果:</Title>
              {updateResults.map((result, index) => (
                <div key={index} style={{ marginBottom: 8 }}>
                  <Tag color={result.success ? 'green' : 'red'}>
                    {result.success ? '成功' : '失败'}
                  </Tag>
                  <Text code>{result.model_name}</Text>
                  {result.message && (
                    <Text type="tertiary" style={{ marginLeft: 8 }}>
                      {result.message}
                    </Text>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {updateLoading && (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <Spin size="large" />
              <div style={{ marginTop: 16 }}>
                <Text>正在更新分词器，请稍候...</Text>
              </div>
            </div>
          )}
        </Modal>
      </Content>
    </Layout>
  );
};

export default TokenizerManagement;
