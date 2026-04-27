/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Card,
  Input,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalFooter,
  ModalHeader,
  Spinner,
  useOverlayState,
} from '@heroui/react';
import {
  Download,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  API,
  authHeader,
  getUserIdFromLocalStorage,
  showError,
  showSuccess,
} from '../../../../helpers';
import ConfirmDialog from '../../../common/ui/ConfirmDialog';

const CHANNEL_TYPE_OLLAMA = 4;

const TAG_TONE = {
  blue: 'bg-primary/15 text-primary',
  cyan: 'bg-[color-mix(in_oklab,var(--app-primary)_18%,transparent)] text-[color-mix(in_oklab,var(--app-primary)_72%,var(--app-foreground))]',
};

function StatusChip({ tone = 'blue', children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
        TAG_TONE[tone] || TAG_TONE.blue
      }`}
    >
      {children}
    </span>
  );
}

function ProgressBar({ percent, tone = 'primary' }) {
  const safe = Math.max(0, Math.min(100, Number(percent) || 0));
  const fill =
    tone === 'success'
      ? 'bg-success'
      : tone === 'warning'
        ? 'bg-warning'
        : 'bg-primary';
  return (
    <div className='h-2 w-full overflow-hidden rounded-full bg-surface-secondary'>
      <div
        className={`h-full rounded-full transition-[width] duration-200 ${fill}`}
        style={{ width: `${safe}%` }}
      />
    </div>
  );
}

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
  if (!info) return '';
  const direct = typeof info.base_url === 'string' ? info.base_url.trim() : '';
  if (direct) return direct;
  const alt =
    typeof info.ollama_base_url === 'string' ? info.ollama_base_url.trim() : '';
  if (alt) return alt;

  const parsed = parseMaybeJSON(info.other_info);
  if (parsed && typeof parsed === 'object') {
    const candidate =
      (typeof parsed.base_url === 'string' && parsed.base_url.trim()) ||
      (typeof parsed.public_url === 'string' && parsed.public_url.trim()) ||
      (typeof parsed.api_url === 'string' && parsed.api_url.trim());
    if (candidate) return candidate;
  }
  return '';
};

const normalizeModels = (items) => {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      if (!item) return null;

      if (typeof item === 'string') {
        return { id: item, owned_by: 'ollama' };
      }

      if (typeof item === 'object') {
        const candidateId =
          item.id || item.ID || item.name || item.model || item.Model;
        if (!candidateId) return null;

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
  const [searchValue, setSearchValue] = useState('');
  const [pullModelName, setPullModelName] = useState('');
  const [pullLoading, setPullLoading] = useState(false);
  const [pullProgress, setPullProgress] = useState(null);
  const [eventSource, setEventSource] = useState(null);
  const [selectedModelIds, setSelectedModelIds] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const modalState = useOverlayState({
    isOpen: visible,
    onOpenChange: (isOpen) => {
      if (!isOpen) onCancel?.();
    },
  });

  const filteredModels = useMemo(() => {
    if (!searchValue) return models;
    const needle = searchValue.toLowerCase();
    return models.filter((model) => model.id.toLowerCase().includes(needle));
  }, [models, searchValue]);

  const handleApplyAllModels = () => {
    if (!onApplyModels || selectedModelIds.length === 0) return;
    onApplyModels({ mode: 'append', modelIds: selectedModelIds });
  };

  const handleToggleModel = (modelId, checked) => {
    if (!modelId) return;
    setSelectedModelIds((prev) => {
      if (checked) {
        if (prev.includes(modelId)) return prev;
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
          if (message) lastError = message;
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
          if (message) lastError = message;
        }
      }

      if (!liveFetchSucceeded && !fallbackSucceeded && lastError) {
        showError(`${t('获取模型列表失败')}: ${lastError}`);
      }

      const normalized = nextModels;
      setModels(normalized);
      setSelectedModelIds((prev) => {
        if (!normalized || normalized.length === 0) return [];
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
      if (onModelsUpdate) onModelsUpdate({ silent: true });
    };

    try {
      if (eventSource) {
        eventSource.close();
        setEventSource(null);
      }

      const controller = new AbortController();
      const closable = { close: () => controller.abort() };
      setEventSource(closable);

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

      const processStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;

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
                  setPullProgress(data);
                } else if (data.error) {
                  showError(data.error);
                  setPullProgress(null);
                  setPullLoading(false);
                  setEventSource(null);
                  return;
                } else if (data.message) {
                  showSuccess(data.message);
                  setPullModelName('');
                  setPullProgress(null);
                  setPullLoading(false);
                  setEventSource(null);
                  await fetchModels();
                  if (onModelsUpdate) onModelsUpdate({ silent: true });
                  await refreshModels();
                  return;
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', e);
              }
            }
          }
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

  const deleteModel = async (modelName) => {
    try {
      const res = await API.delete('/api/channel/ollama/delete', {
        data: { channel_id: channelId, model_name: modelName },
      });

      if (res.data.success) {
        showSuccess(t('模型删除成功'));
        await fetchModels();
        if (onModelsUpdate) onModelsUpdate({ silent: true });
      } else {
        showError(res.data.message || t('模型删除失败'));
      }
    } catch (error) {
      showError(t('模型删除失败: {{error}}', { error: error.message }));
    }
  };

  useEffect(() => {
    if (!visible) {
      setSelectedModelIds([]);
      setPullModelName('');
      setPullProgress(null);
      setPullLoading(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    if (channelId || Number(channelInfo?.type) === CHANNEL_TYPE_OLLAMA) {
      fetchModels();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    visible,
    channelId,
    channelInfo?.type,
    channelInfo?.base_url,
    channelInfo?.other_info,
    channelInfo?.ollama_base_url,
  ]);

  useEffect(() => {
    return () => {
      if (eventSource) eventSource.close();
    };
  }, [eventSource]);

  const formatModelSize = (size) => {
    if (!size) return '-';
    const gb = size / (1024 * 1024 * 1024);
    return gb >= 1
      ? `${gb.toFixed(1)} GB`
      : `${(size / (1024 * 1024)).toFixed(0)} MB`;
  };

  const renderProgress = () => {
    if (!pullProgress) return null;
    const completedBytes = Number(pullProgress.completed) || 0;
    const totalBytes = Number(pullProgress.total) || 0;
    const hasTotal = Number.isFinite(totalBytes) && totalBytes > 0;
    const safePercent = hasTotal
      ? Math.min(
          100,
          Math.max(0, Math.round((completedBytes / totalBytes) * 100)),
        )
      : null;
    const percentText =
      hasTotal && safePercent !== null
        ? `${safePercent.toFixed(0)}%`
        : pullProgress.status || t('处理中');

    return (
      <div className='mt-3 space-y-2'>
        <div className='flex items-center justify-between'>
          <span className='text-sm font-semibold text-foreground'>
            {t('拉取进度')}
          </span>
          <span className='text-xs text-muted'>{percentText}</span>
        </div>

        {hasTotal && safePercent !== null ? (
          <>
            <ProgressBar percent={safePercent} />
            <div className='flex justify-between text-xs text-muted'>
              <span>
                {(completedBytes / (1024 * 1024 * 1024)).toFixed(2)} GB
              </span>
              <span>
                {(totalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB
              </span>
            </div>
          </>
        ) : (
          <div className='flex items-center gap-2 text-xs text-muted'>
            <Spinner size='sm' />
            <span>{t('准备中...')}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Modal state={modalState}>
        <ModalBackdrop variant='blur'>
          <ModalContainer
            size='3xl'
            placement='center'
            className='max-w-[95vw]'
          >
            <ModalDialog className='bg-background/95 backdrop-blur'>
              <ModalHeader className='border-b border-border'>
                <span>{t('Ollama 模型管理')}</span>
              </ModalHeader>
              <ModalBody className='space-y-4 px-6 py-5'>
                <div className='text-xs text-muted'>
                  {channelInfo?.name ? `${channelInfo.name} - ` : ''}
                  {t('管理 Ollama 模型的拉取和删除')}
                </div>

                {/* 拉取新模型 */}
                <Card className='!rounded-2xl border-0 shadow-sm'>
                  <Card.Content className='space-y-3 p-5'>
                    <div className='text-base font-semibold text-foreground'>
                      {t('拉取新模型')}
                    </div>

                    <div className='grid grid-cols-1 gap-3 sm:grid-cols-12'>
                      <div className='sm:col-span-8'>
                        <Input
                          isDisabled={pullLoading}
                          placeholder={t(
                            '请输入模型名称，例如: llama3.2, qwen2.5:7b',
                          )}
                          value={pullModelName}
                          onValueChange={setPullModelName}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && !pullLoading) {
                              pullModel();
                            }
                          }}
                        >
                          <Input.Control>
                            <Input.Element />
                          </Input.Control>
                        </Input>
                      </div>
                      <div className='sm:col-span-4'>
                        <Button
                          color='primary'
                          isPending={pullLoading}
                          isDisabled={!pullModelName.trim()}
                          startContent={<Download size={14} />}
                          onPress={pullModel}
                          className='w-full'
                        >
                          {pullLoading ? t('拉取中...') : t('拉取模型')}
                        </Button>
                      </div>
                    </div>

                    {renderProgress()}

                    <div className='text-xs text-muted'>
                      {t(
                        '支持拉取 Ollama 官方模型库中的所有模型，拉取过程可能需要几分钟时间',
                      )}
                    </div>
                  </Card.Content>
                </Card>

                {/* 已有模型列表 */}
                <Card className='!rounded-2xl border-0 shadow-sm'>
                  <Card.Content className='space-y-3 p-5'>
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                      <div className='flex items-center gap-2'>
                        <div className='text-base font-semibold text-foreground'>
                          {t('已有模型')}
                        </div>
                        {models.length > 0 ? (
                          <StatusChip tone='blue'>{models.length}</StatusChip>
                        ) : null}
                      </div>
                      <div className='flex flex-wrap items-center gap-2'>
                        <div className='w-[200px]'>
                          <Input
                            placeholder={t('搜索模型...')}
                            value={searchValue}
                            onValueChange={setSearchValue}
                            startContent={
                              <Search size={14} className='text-muted' />
                            }
                          >
                            <Input.Control>
                              <Input.Element />
                            </Input.Control>
                          </Input>
                        </div>
                        <Button
                          size='sm'
                          variant='flat'
                          isDisabled={models.length === 0}
                          onPress={handleSelectAll}
                        >
                          {t('全选')}
                        </Button>
                        <Button
                          size='sm'
                          variant='flat'
                          isDisabled={selectedModelIds.length === 0}
                          onPress={handleClearSelection}
                        >
                          {t('清空')}
                        </Button>
                        <Button
                          size='sm'
                          color='primary'
                          startContent={<Plus size={14} />}
                          isDisabled={selectedModelIds.length === 0}
                          onPress={handleApplyAllModels}
                        >
                          {t('加入渠道')}
                        </Button>
                        <Button
                          size='sm'
                          variant='flat'
                          color='primary'
                          startContent={<RefreshCw size={14} />}
                          isPending={loading}
                          onPress={fetchModels}
                        >
                          {t('刷新')}
                        </Button>
                      </div>
                    </div>

                    <div className='relative min-h-[120px]'>
                      {loading && (
                        <div className='absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px]'>
                          <Spinner color='primary' />
                        </div>
                      )}
                      {filteredModels.length === 0 ? (
                        <div className='flex flex-col items-center gap-2 px-4 py-10 text-center'>
                          <div className='text-sm font-semibold text-foreground'>
                            {searchValue
                              ? t('未找到匹配的模型')
                              : t('暂无模型')}
                          </div>
                          <div className='text-xs text-muted'>
                            {searchValue
                              ? t('请尝试其他搜索关键词')
                              : t('您可以在上方拉取需要的模型')}
                          </div>
                        </div>
                      ) : (
                        <ul className='divide-y divide-border'>
                          {filteredModels.map((model) => (
                            <li
                              key={model.id}
                              className='flex items-center justify-between gap-3 py-3'
                            >
                              <div className='flex min-w-0 flex-1 items-center gap-3'>
                                <input
                                  type='checkbox'
                                  className='h-4 w-4 accent-primary'
                                  checked={selectedModelIds.includes(model.id)}
                                  onChange={(event) =>
                                    handleToggleModel(
                                      model.id,
                                      event.target.checked,
                                    )
                                  }
                                  aria-label={model.id}
                                />
                                <div className='min-w-0 flex-1'>
                                  <div className='truncate text-sm font-semibold text-foreground'>
                                    {model.id}
                                  </div>
                                  <div className='mt-1 flex items-center gap-2'>
                                    <StatusChip tone='cyan'>
                                      {model.owned_by || 'ollama'}
                                    </StatusChip>
                                    {model.size ? (
                                      <span className='text-xs text-muted'>
                                        {formatModelSize(model.size)}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                              <div className='ml-4 flex items-center gap-2'>
                                <Button
                                  isIconOnly
                                  size='sm'
                                  variant='light'
                                  color='danger'
                                  aria-label={t('删除')}
                                  onPress={() => setDeleteTarget(model.id)}
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </Card.Content>
                </Card>
              </ModalBody>
              <ModalFooter className='border-t border-border'>
                <Button
                  color='primary'
                  startContent={<X size={14} />}
                  onPress={onCancel}
                >
                  {t('关闭')}
                </Button>
              </ModalFooter>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>

      <ConfirmDialog
        visible={!!deleteTarget}
        title={t('确认删除模型')}
        cancelText={t('取消')}
        confirmText={t('确认')}
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          const target = deleteTarget;
          setDeleteTarget(null);
          if (target) await deleteModel(target);
        }}
      >
        {t('删除后无法恢复，确定要删除模型 "{{name}}" 吗？', {
          name: deleteTarget || '',
        })}
      </ConfirmDialog>
    </>
  );
};

export default OllamaModelModal;
