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
  Empty,
  Row,
  Col,
  Progress,
  Checkbox,
} from '@douyinfe/semi-ui';
import {
  IconDownload,
  IconDelete,
  IconRefresh,
  IconSearch,
  IconPlus,
} from '@douyinfe/semi-icons';
import {
  API,
  authHeader,
  getUserIdFromLocalStorage,
  showError,
  showSuccess,
} from '../../../../helpers';

const { Text, Title } = Typography;

const CHANNEL_TYPE_OLLAMA = 4;

const parseMaybeJSON = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  }
  return null;
};

const resolveOllamaBaseUrl = (info) => {
  if (!info) {
    return '';
  }

  const direct = typeof info.base_url === 'string' ? info.base_url.trim() : '';
  if (direct) {
    return direct;
  }

  const alt =
    typeof info.ollama_base_url === 'string' ? info.ollama_base_url.trim() : '';
  if (alt) {
    return alt;
  }

  const parsed = parseMaybeJSON(info.other_info);
  if (parsed && typeof parsed === 'object') {
    const candidate =
      (typeof parsed.base_url === 'string' && parsed.base_url.trim()) ||
      (typeof parsed.public_url === 'string' && parsed.public_url.trim()) ||
      (typeof parsed.api_url === 'string' && parsed.api_url.trim());
    if (candidate) {
      return candidate;
    }
  }

  return '';
};

const normalizeModels = (items) => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => {
      if (!item) {
        return null;
      }

      if (typeof item === 'string') {
        return {
          id: item,
          owned_by: 'ollama',
        };
      }

      if (typeof item === 'object') {
        const candidateId =
          item.id || item.ID || item.name || item.model || item.Model;
        if (!candidateId) {
          return null;
        }

        const metadata = item.metadata || item.Metadata;
        const normalized = {
          ...item,
          id: candidateId,
          owned_by: item.owned_by || item.ownedBy || 'ollama',
        };

        if (typeof item.size === 'number' && !normalized.size) {
          normalized.size = item.size;
        }
        if (metadata && typeof metadata === 'object') {
          if (typeof metadata.size === 'number' && !normalized.size) {
            normalized.size = metadata.size;
          }
          if (!normalized.digest && typeof metadata.digest === 'string') {
            normalized.digest = metadata.digest;
          }
          if (
            !normalized.modified_at &&
            typeof metadata.modified_at === 'string'
          ) {
            normalized.modified_at = metadata.modified_at;
          }
          if (metadata.details && !normalized.details) {
            normalized.details = metadata.details;
          }
        }

        return normalized;
      }

      return null;
    })
    .filter(Boolean);
};

const OllamaModelModal = ({
  visible,
  onCancel,
  channelId,
  channelInfo,
  onModelsUpdate,
  onApplyModels,
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
  const [selectedModelIds, setSelectedModelIds] = useState([]);

  const handleApplyAllModels = () => {
    if (!onApplyModels || selectedModelIds.length === 0) {
      return;
    }
    onApplyModels({ mode: 'append', modelIds: selectedModelIds });
  };

  const handleToggleModel = (modelId, checked) => {
    if (!modelId) {
      return;
    }
    setSelectedModelIds((prev) => {
      if (checked) {
        if (prev.includes(modelId)) {
          return prev;
        }
        return [...prev, modelId];
      }
      return prev.filter((id) => id !== modelId);
    });
  };

  const handleSelectAll = () => {
    setSelectedModelIds(models.map((item) => item?.id).filter(Boolean));
  };

  const handleClearSelection = () => {
    setSelectedModelIds([]);
  };

  // 获取模型列表
  const fetchModels = async () => {
    const channelType = Number(channelInfo?.type ?? CHANNEL_TYPE_OLLAMA);
    const shouldTryLiveFetch = channelType === CHANNEL_TYPE_OLLAMA;
    const resolvedBaseUrl = resolveOllamaBaseUrl(channelInfo);

    setLoading(true);
    let liveFetchSucceeded = false;
    let fallbackSucceeded = false;
    let lastError = '';
    let nextModels = [];

    try {
      if (shouldTryLiveFetch && resolvedBaseUrl) {
        try {
          const payload = {
            base_url: resolvedBaseUrl,
            type: CHANNEL_TYPE_OLLAMA,
            key: channelInfo?.key || '',
          };

          const res = await API.post('/api/channel/fetch_models', payload, {
            skipErrorHandler: true,
          });

          if (res?.data?.success) {
            nextModels = normalizeModels(res.data.data);
            liveFetchSucceeded = true;
          } else if (res?.data?.message) {
            lastError = res.data.message;
          }
        } catch (error) {
          const message = error?.response?.data?.message || error.message;
          if (message) {
            lastError = message;
          }
        }
      } else if (shouldTryLiveFetch && !resolvedBaseUrl && !channelId) {
        lastError = t('请先填写 Ollama API 地址');
      }

      if ((!liveFetchSucceeded || nextModels.length === 0) && channelId) {
        try {
          const res = await API.get(`/api/channel/fetch_models/${channelId}`, {
            skipErrorHandler: true,
          });

          if (res?.data?.success) {
            nextModels = normalizeModels(res.data.data);
            fallbackSucceeded = true;
            lastError = '';
          } else if (res?.data?.message) {
            lastError = res.data.message;
          }
        } catch (error) {
          const message = error?.response?.data?.message || error.message;
          if (message) {
            lastError = message;
          }
        }
      }

      if (!liveFetchSucceeded && !fallbackSucceeded && lastError) {
        showError(`${t('获取模型列表失败')}: ${lastError}`);
      }

      const normalized = nextModels;
      setModels(normalized);
      setFilteredModels(normalized);
      setSelectedModelIds((prev) => {
        if (!normalized || normalized.length === 0) {
          return [];
        }
        if (!prev || prev.length === 0) {
          return normalized.map((item) => item.id).filter(Boolean);
        }
        const available = prev.filter((id) =>
          normalized.some((item) => item.id === id),
        );
        return available.length > 0
          ? available
          : normalized.map((item) => item.id).filter(Boolean);
      });
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

    let hasRefreshed = false;
    const refreshModels = async () => {
      if (hasRefreshed) return;
      hasRefreshed = true;
      await fetchModels();
      if (onModelsUpdate) {
        onModelsUpdate({ silent: true });
      }
    };

    try {
      // 关闭之前的连接
      if (eventSource) {
        eventSource.close();
        setEventSource(null);
      }

      const controller = new AbortController();
      const closable = {
        close: () => controller.abort(),
      };
      setEventSource(closable);

      // 使用 fetch 请求 SSE 流
      const authHeaders = authHeader();
      const userId = getUserIdFromLocalStorage();
      const fetchHeaders = {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'New-API-User': String(userId),
        ...authHeaders,
      };

      const response = await fetch('/api/channel/ollama/pull/stream', {
        method: 'POST',
        headers: fetchHeaders,
        body: JSON.stringify({
          channel_id: channelId,
          model_name: pullModelName.trim(),
        }),
        signal: controller.signal,
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
              if (!line.startsWith('data: ')) {
                continue;
              }

              try {
                const eventData = line.substring(6);
                if (eventData === '[DONE]') {
                  setPullLoading(false);
                  setPullProgress(null);
                  setEventSource(null);
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
                  setEventSource(null);
                  return;
                } else if (data.message) {
                  // 处理成功消息
                  showSuccess(data.message);
                  setPullModelName('');
                  setPullProgress(null);
                  setPullLoading(false);
                  setEventSource(null);
                  await fetchModels();
                  if (onModelsUpdate) {
                    onModelsUpdate({ silent: true });
                  }
                  await refreshModels();
                  return;
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', e);
              }
            }
          }
          // 正常结束流
          setPullLoading(false);
          setPullProgress(null);
          setEventSource(null);
          await refreshModels();
        } catch (error) {
          if (error?.name === 'AbortError') {
            setPullProgress(null);
            setPullLoading(false);
            setEventSource(null);
            return;
          }
          console.error('Stream processing error:', error);
          showError(t('数据传输中断'));
          setPullProgress(null);
          setPullLoading(false);
          setEventSource(null);
          await refreshModels();
        }
      };

      await processStream();
    } catch (error) {
      if (error?.name !== 'AbortError') {
        showError(t('模型拉取失败: {{error}}', { error: error.message }));
      }
      setPullLoading(false);
      setPullProgress(null);
      setEventSource(null);
      await refreshModels();
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
          onModelsUpdate({ silent: true }); // 通知父组件更新
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
      const filtered = models.filter((model) =>
        model.id.toLowerCase().includes(searchValue.toLowerCase()),
      );
      setFilteredModels(filtered);
    }
  }, [models, searchValue]);

  useEffect(() => {
    if (!visible) {
      setSelectedModelIds([]);
      setPullModelName('');
      setPullProgress(null);
      setPullLoading(false);
    }
  }, [visible]);

  // 组件加载时获取模型列表
  useEffect(() => {
    if (!visible) {
      return;
    }

    if (channelId || Number(channelInfo?.type) === CHANNEL_TYPE_OLLAMA) {
      fetchModels();
    }
  }, [
    visible,
    channelId,
    channelInfo?.type,
    channelInfo?.base_url,
    channelInfo?.other_info,
    channelInfo?.ollama_base_url,
  ]);

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
    return gb >= 1
      ? `${gb.toFixed(1)} GB`
      : `${(size / (1024 * 1024)).toFixed(0)} MB`;
  };

  return (
    <Modal
      title={t('Ollama 模型管理')}
      visible={visible}
      onCancel={onCancel}
      width={720}
      style={{ maxWidth: '95vw' }}
      footer={
        <Button theme='solid' type='primary' onClick={onCancel}>
          {t('关闭')}
        </Button>
      }
    >
      <Space vertical spacing='medium' style={{ width: '100%' }}>
        <div>
          <Text type='tertiary' size='small'>
            {channelInfo?.name ? `${channelInfo.name} - ` : ''}
            {t('管理 Ollama 模型的拉取和删除')}
          </Text>
        </div>

        {/* 拉取新模型 */}
        <Card>
          <Title heading={6} className='m-0 mb-3'>
            {t('拉取新模型')}
          </Title>

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
          {pullProgress &&
            (() => {
              const completedBytes = Number(pullProgress.completed) || 0;
              const totalBytes = Number(pullProgress.total) || 0;
              const hasTotal = Number.isFinite(totalBytes) && totalBytes > 0;
              const safePercent = hasTotal
                ? Math.min(
                    100,
                    Math.max(
                      0,
                      Math.round((completedBytes / totalBytes) * 100),
                    ),
                  )
                : null;
              const percentText =
                hasTotal && safePercent !== null
                  ? `${safePercent.toFixed(0)}%`
                  : pullProgress.status || t('处理中');

              return (
                <div style={{ marginTop: 12 }}>
                  <div className='flex items-center justify-between mb-2'>
                    <Text strong>{t('拉取进度')}</Text>
                    <Text type='tertiary' size='small'>
                      {percentText}
                    </Text>
                  </div>

                  {hasTotal && safePercent !== null ? (
                    <div>
                      <Progress
                        percent={safePercent}
                        showInfo={false}
                        stroke='#1890ff'
                        size='small'
                      />
                      <div className='flex justify-between mt-1'>
                        <Text type='tertiary' size='small'>
                          {(completedBytes / (1024 * 1024 * 1024)).toFixed(2)}{' '}
                          GB
                        </Text>
                        <Text type='tertiary' size='small'>
                          {(totalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB
                        </Text>
                      </div>
                    </div>
                  ) : (
                    <div className='flex items-center gap-2 text-xs text-[var(--semi-color-text-2)]'>
                      <Spin size='small' />
                      <span>{t('准备中...')}</span>
                    </div>
                  )}
                </div>
              );
            })()}

          <Text type='tertiary' size='small' className='mt-2 block'>
            {t(
              '支持拉取 Ollama 官方模型库中的所有模型，拉取过程可能需要几分钟时间',
            )}
          </Text>
        </Card>

        {/* 已有模型列表 */}
        <Card>
          <div className='flex items-center justify-between mb-3'>
            <div className='flex items-center gap-2'>
              <Title heading={6} className='m-0'>
                {t('已有模型')}
              </Title>
              {models.length > 0 ? (
                <Tag color='blue'>{models.length}</Tag>
              ) : null}
            </div>
            <Space wrap>
              <Input
                prefix={<IconSearch />}
                placeholder={t('搜索模型...')}
                value={searchValue}
                onChange={(value) => setSearchValue(value)}
                style={{ width: 200 }}
                showClear
              />
              <Button
                size='small'
                theme='light'
                onClick={handleSelectAll}
                disabled={models.length === 0}
              >
                {t('全选')}
              </Button>
              <Button
                size='small'
                theme='light'
                onClick={handleClearSelection}
                disabled={selectedModelIds.length === 0}
              >
                {t('清空')}
              </Button>
              <Button
                theme='solid'
                type='primary'
                icon={<IconPlus />}
                onClick={handleApplyAllModels}
                disabled={selectedModelIds.length === 0}
                size='small'
              >
                {t('加入渠道')}
              </Button>
              <Button
                theme='light'
                type='primary'
                onClick={fetchModels}
                loading={loading}
                icon={<IconRefresh />}
                size='small'
              >
                {t('刷新')}
              </Button>
            </Space>
          </div>

          <Spin spinning={loading}>
            {filteredModels.length === 0 ? (
              <Empty
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
                split
                renderItem={(model) => (
                  <List.Item key={model.id}>
                    <div className='flex items-center justify-between w-full'>
                      <div className='flex items-center flex-1 min-w-0 gap-3'>
                        <Checkbox
                          checked={selectedModelIds.includes(model.id)}
                          onChange={(checked) =>
                            handleToggleModel(model.id, checked)
                          }
                        />
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
                          content={t(
                            '删除后无法恢复，确定要删除模型 "{{name}}" 吗？',
                            { name: model.id },
                          )}
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
      </Space>
    </Modal>
  );
};

export default OllamaModelModal;
