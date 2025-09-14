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
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Button,
  Typography,
  Card,
  List,
  Space,
  Input,
  Spin,
  Popconfirm,
  Tag,
  Avatar,
  Empty,
  Divider,
  Row,
  Col,
  Progress,
} from '@douyinfe/semi-ui';
import {
  IconClose,
  IconDownload,
  IconDelete,
  IconRefresh,
  IconSearch,
  IconPlus,
  IconServer,
} from '@douyinfe/semi-icons';
import { API, showError, showInfo, showSuccess } from '../../../../helpers';

const { Text, Title } = Typography;

const OllamaModelModal = ({
  visible,
  onCancel,
  channelId,
  channelInfo,
  onModelsUpdate,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState([]);
  const [filteredModels, setFilteredModels] = useState([]);
  const [searchValue, setSearchValue] = useState('');
  const [pullModelName, setPullModelName] = useState('');
  const [pullLoading, setPullLoading] = useState(false);
  const [pullProgress, setPullProgress] = useState(null);
  const [eventSource, setEventSource] = useState(null);

  // 获取模型列表
  const fetchModels = async () => {
    if (!channelId) return;
    
    setLoading(true);
    try {
      const res = await API.get(`/api/channel/fetch_models/${channelId}`);
      if (res.data.success) {
        setModels(res.data.data || []);
      } else {
        showError(res.data.message || t('获取模型列表失败'));
      }
    } catch (error) {
      showError(t('获取模型列表失败: {{error}}', { error: error.message }));
    } finally {
      setLoading(false);
    }
  };

  // 拉取模型 (流式，支持进度)
  const pullModel = async () => {
    if (!pullModelName.trim()) {
      showError(t('请输入模型名称'));
      return;
    }

    setPullLoading(true);
    setPullProgress({ status: 'starting', completed: 0, total: 0 });

    try {
      // 关闭之前的连接
      if (eventSource) {
        eventSource.close();
      }

      // 使用 fetch 请求 SSE 流
      const response = await fetch('/api/channel/ollama/pull/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          channel_id: channelId,
          model_name: pullModelName.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // 读取 SSE 流
      const processStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const eventData = line.substring(6);
                  if (eventData === '[DONE]') {
                    setPullLoading(false);
                    setPullProgress(null);
                    return;
                  }
                  
                  const data = JSON.parse(eventData);
                  
                  if (data.status) {
                    // 处理进度数据
                    setPullProgress(data);
                  } else if (data.error) {
                    // 处理错误
                    showError(data.error);
                    setPullProgress(null);
                    setPullLoading(false);
                    return;
                  } else if (data.message) {
                    // 处理成功消息
                    showSuccess(data.message);
                    setPullModelName('');
                    setPullProgress(null);
                    setPullLoading(false);
                    await fetchModels();
                    if (onModelsUpdate) {
                      onModelsUpdate();
                    }
                    return;
                  }
                } catch (e) {
                  console.error('Failed to parse SSE data:', e);
                }
              }
            }
          }
        } catch (error) {
          console.error('Stream processing error:', error);
          showError(t('数据传输中断'));
          setPullProgress(null);
          setPullLoading(false);
        }
      };

      processStream();

    } catch (error) {
      showError(t('模型拉取失败: {{error}}', { error: error.message }));
      setPullLoading(false);
      setPullProgress(null);
    }
  };

  // 删除模型
  const deleteModel = async (modelName) => {
    try {
      const res = await API.delete('/api/channel/ollama/delete', {
        data: {
          channel_id: channelId,
          model_name: modelName,
        },
      });
      
      if (res.data.success) {
        showSuccess(t('模型删除成功'));
        await fetchModels(); // 重新获取模型列表
        if (onModelsUpdate) {
          onModelsUpdate(); // 通知父组件更新
        }
      } else {
        showError(res.data.message || t('模型删除失败'));
      }
    } catch (error) {
      showError(t('模型删除失败: {{error}}', { error: error.message }));
    }
  };

  // 搜索过滤
  useEffect(() => {
    if (!searchValue) {
      setFilteredModels(models);
    } else {
      const filtered = models.filter(model =>
        model.id.toLowerCase().includes(searchValue.toLowerCase())
      );
      setFilteredModels(filtered);
    }
  }, [models, searchValue]);

  // 组件加载时获取模型列表
  useEffect(() => {
    if (visible && channelId) {
      fetchModels();
    }
  }, [visible, channelId]);

  // 组件卸载时清理 EventSource
  useEffect(() => {
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [eventSource]);

  const formatModelSize = (size) => {
    if (!size) return '-';
    const gb = size / (1024 * 1024 * 1024);
    return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(size / (1024 * 1024)).toFixed(0)} MB`;
  };

  return (
    <Modal
      title={
        <div className='flex items-center'>
          <Avatar
            size='small'
            color='blue'
            className='mr-3 shadow-md'
          >
            <IconServer size={16} />
          </Avatar>
          <div>
            <Title heading={4} className='m-0'>
              {t('Ollama 模型管理')}
            </Title>
            <Text type='tertiary' size='small'>
              {channelInfo?.name && `${channelInfo.name} - `}
              {t('管理 Ollama 模型的拉取和删除')}
            </Text>
          </div>
        </div>
      }
      visible={visible}
      onCancel={onCancel}
      width={800}
      style={{ maxWidth: '95vw' }}
      footer={
        <div className='flex justify-end'>
          <Button
            theme='light'
            type='primary'
            onClick={onCancel}
            icon={<IconClose />}
          >
            {t('关闭')}
          </Button>
        </div>
      }
    >
      <div className='space-y-6'>
        {/* 拉取新模型 */}
        <Card className='!rounded-2xl shadow-sm border-0'>
          <div className='flex items-center mb-4'>
            <Avatar size='small' color='green' className='mr-2'>
              <IconPlus size={16} />
            </Avatar>
            <Title heading={5} className='m-0'>
              {t('拉取新模型')}
            </Title>
          </div>
          
          <Row gutter={12} align='middle'>
            <Col span={16}>
              <Input
                placeholder={t('请输入模型名称，例如: llama3.2, qwen2.5:7b')}
                value={pullModelName}
                onChange={(value) => setPullModelName(value)}
                onEnterPress={pullModel}
                disabled={pullLoading}
                showClear
              />
            </Col>
            <Col span={8}>
              <Button
                theme='solid'
                type='primary'
                onClick={pullModel}
                loading={pullLoading}
                disabled={!pullModelName.trim()}
                icon={<IconDownload />}
                block
              >
                {pullLoading ? t('拉取中...') : t('拉取模型')}
              </Button>
            </Col>
          </Row>
          
          {/* 进度条显示 */}
          {pullProgress && (
            <div className='mt-3 p-3 bg-gray-50 rounded-lg'>
              <div className='flex items-center justify-between mb-2'>
                <Text strong>{t('拉取进度')}</Text>
                <Text type='tertiary' size='small'>
                  {pullProgress.status === 'downloading' && pullProgress.total > 0
                    ? `${((pullProgress.completed / pullProgress.total) * 100).toFixed(1)}%`
                    : pullProgress.status}
                </Text>
              </div>
              
              {pullProgress.total > 0 ? (
                <div>
                  <Progress
                    percent={Math.round((pullProgress.completed / pullProgress.total) * 100)}
                    showInfo={false}
                    stroke='#1890ff'
                    size='small'
                  />
                  <div className='flex justify-between mt-1'>
                    <Text type='tertiary' size='small'>
                      {(pullProgress.completed / (1024 * 1024 * 1024)).toFixed(2)} GB
                    </Text>
                    <Text type='tertiary' size='small'>
                      {(pullProgress.total / (1024 * 1024 * 1024)).toFixed(2)} GB
                    </Text>
                  </div>
                </div>
              ) : (
                <Progress
                  percent={50}
                  showInfo={false}
                  stroke='#1890ff'
                  size='small'
                  type='indeterminate'
                />
              )}
            </div>
          )}
          
          <Text type='tertiary' size='small' className='mt-2 block'>
            {t('支持拉取 Ollama 官方模型库中的所有模型，拉取过程可能需要几分钟时间')}
          </Text>
        </Card>

        {/* 已有模型列表 */}
        <Card className='!rounded-2xl shadow-sm border-0'>
          <div className='flex items-center justify-between mb-4'>
            <div className='flex items-center'>
              <Avatar size='small' color='purple' className='mr-2'>
                <IconServer size={16} />
              </Avatar>
              <Title heading={5} className='m-0'>
                {t('已有模型')}
                {models.length > 0 && (
                  <Tag color='blue' className='ml-2'>
                    {models.length}
                  </Tag>
                )}
              </Title>
            </div>
            <Space>
              <Input
                prefix={<IconSearch />}
                placeholder={t('搜索模型...')}
                value={searchValue}
                onChange={(value) => setSearchValue(value)}
                style={{ width: 200 }}
                showClear
              />
              <Button
                theme='borderless'
                type='primary'
                onClick={fetchModels}
                loading={loading}
                icon={<IconRefresh />}
              >
                {t('刷新')}
              </Button>
            </Space>
          </div>

          <Spin spinning={loading}>
            {filteredModels.length === 0 ? (
              <Empty
                image={<IconServer size={60} />}
                title={searchValue ? t('未找到匹配的模型') : t('暂无模型')}
                description={
                  searchValue 
                    ? t('请尝试其他搜索关键词') 
                    : t('您可以在上方拉取需要的模型')
                }
                style={{ padding: '40px 0' }}
              />
            ) : (
              <List
                dataSource={filteredModels}
                split={false}
                renderItem={(model, index) => (
                  <List.Item
                    key={model.id}
                    className='hover:bg-gray-50 rounded-lg p-3 transition-colors'
                  >
                    <div className='flex items-center justify-between w-full'>
                      <div className='flex items-center flex-1 min-w-0'>
                        <Avatar
                          size='small'
                          color='blue'
                          className='mr-3 flex-shrink-0'
                        >
                          {model.id.charAt(0).toUpperCase()}
                        </Avatar>
                        <div className='flex-1 min-w-0'>
                          <Text strong className='block truncate'>
                            {model.id}
                          </Text>
                          <div className='flex items-center space-x-2 mt-1'>
                            <Tag color='cyan' size='small'>
                              {model.owned_by || 'ollama'}
                            </Tag>
                            {model.size && (
                              <Text type='tertiary' size='small'>
                                {formatModelSize(model.size)}
                              </Text>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className='flex items-center space-x-2 ml-4'>
                        <Popconfirm
                          title={t('确认删除模型')}
                          content={t('删除后无法恢复，确定要删除模型 "{{name}}" 吗？', { name: model.id })}
                          onConfirm={() => deleteModel(model.id)}
                          okText={t('确认')}
                          cancelText={t('取消')}
                        >
                          <Button
                            theme='borderless'
                            type='danger'
                            size='small'
                            icon={<IconDelete />}
                          />
                        </Popconfirm>
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </Spin>
        </Card>
      </div>
    </Modal>
  );
};

export default OllamaModelModal;