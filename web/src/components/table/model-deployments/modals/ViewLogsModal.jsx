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

import React, { useState, useEffect, useRef } from 'react';
import {
  Button,
  Input,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalHeader,
  Spinner,
  Switch,
  Tooltip,
  useOverlayState,
} from '@heroui/react';
import {
  FaCopy,
  FaSearch,
  FaClock,
  FaTerminal,
  FaServer,
  FaInfoCircle,
  FaLink,
} from 'react-icons/fa';
import { Download, Inbox, RefreshCw } from 'lucide-react';
import {
  API,
  showError,
  showSuccess,
  copy,
  timestamp2string,
} from '../../../../helpers';

const ALL_CONTAINERS = '__all__';

const TAG_TONE = {
  green: 'bg-success/15 text-success',
  blue: 'bg-primary/15 text-primary',
  orange: 'bg-warning/15 text-warning',
  red: 'bg-danger/15 text-danger',
  grey: 'bg-surface-secondary text-muted',
};

function StatusTag({ tone, children }) {
  const cls = TAG_TONE[tone] || TAG_TONE.grey;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {children}
    </span>
  );
}

// Compact segmented control replaces Semi `<Radio.Group type='button'>`.
function StreamSegment({ value, onChange, options }) {
  return (
    <div className='inline-flex overflow-hidden rounded-lg border border-border'>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type='button'
            onClick={() => onChange(option.value)}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              active
                ? 'bg-foreground text-background'
                : 'bg-background text-muted hover:bg-surface-secondary'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function EmptyBlock({ description }) {
  return (
    <div className='flex flex-col items-center gap-3 py-12 text-center'>
      <div className='flex h-16 w-16 items-center justify-center rounded-full bg-surface-secondary text-muted'>
        <Inbox size={28} />
      </div>
      <span className='text-sm text-muted'>{description}</span>
    </div>
  );
}

const ViewLogsModal = ({ visible, onCancel, deployment, t }) => {
  const [logLines, setLogLines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [following, setFollowing] = useState(false);
  const [containers, setContainers] = useState([]);
  const [containersLoading, setContainersLoading] = useState(false);
  const [selectedContainerId, setSelectedContainerId] =
    useState(ALL_CONTAINERS);
  const [containerDetails, setContainerDetails] = useState(null);
  const [containerDetailsLoading, setContainerDetailsLoading] = useState(false);
  const [streamFilter, setStreamFilter] = useState('stdout');
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const logContainerRef = useRef(null);
  const autoRefreshRef = useRef(null);

  const modalState = useOverlayState({
    isOpen: visible,
    onOpenChange: (isOpen) => {
      if (!isOpen) onCancel?.();
    },
  });

  const scrollToBottom = () => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  };

  const fetchLogs = async (containerIdOverride = undefined) => {
    if (!deployment?.id) return;

    const containerId =
      typeof containerIdOverride === 'string'
        ? containerIdOverride
        : selectedContainerId;

    if (!containerId || containerId === ALL_CONTAINERS) {
      setLogLines([]);
      setLastUpdatedAt(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('container_id', containerId);

      if (streamFilter && streamFilter !== 'all') {
        params.append('stream', streamFilter);
      }
      if (following) params.append('follow', 'true');

      const response = await API.get(
        `/api/deployments/${deployment.id}/logs?${params}`,
      );

      if (response.data.success) {
        const rawContent =
          typeof response.data.data === 'string' ? response.data.data : '';
        const normalized = rawContent.replace(/\r\n?/g, '\n');
        const lines = normalized ? normalized.split('\n') : [];

        setLogLines(lines);
        setLastUpdatedAt(new Date());

        setTimeout(scrollToBottom, 100);
      }
    } catch (error) {
      showError(
        t('获取日志失败') +
          ': ' +
          (error.response?.data?.message || error.message),
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchContainers = async () => {
    if (!deployment?.id) return;

    setContainersLoading(true);
    try {
      const response = await API.get(
        `/api/deployments/${deployment.id}/containers`,
      );

      if (response.data.success) {
        const list = response.data.data?.containers || [];
        setContainers(list);

        setSelectedContainerId((current) => {
          if (
            current !== ALL_CONTAINERS &&
            list.some((item) => item.container_id === current)
          ) {
            return current;
          }

          return list.length > 0 ? list[0].container_id : ALL_CONTAINERS;
        });

        if (list.length === 0) {
          setContainerDetails(null);
        }
      }
    } catch (error) {
      showError(
        t('获取容器列表失败') +
          ': ' +
          (error.response?.data?.message || error.message),
      );
    } finally {
      setContainersLoading(false);
    }
  };

  const fetchContainerDetails = async (containerId) => {
    if (!deployment?.id || !containerId || containerId === ALL_CONTAINERS) {
      setContainerDetails(null);
      return;
    }

    setContainerDetailsLoading(true);
    try {
      const response = await API.get(
        `/api/deployments/${deployment.id}/containers/${containerId}`,
      );

      if (response.data.success) {
        setContainerDetails(response.data.data || null);
      }
    } catch (error) {
      showError(
        t('获取容器详情失败') +
          ': ' +
          (error.response?.data?.message || error.message),
      );
    } finally {
      setContainerDetailsLoading(false);
    }
  };

  const handleContainerChange = (value) => {
    const newValue = value || ALL_CONTAINERS;
    setSelectedContainerId(newValue);
    setLogLines([]);
    setLastUpdatedAt(null);
  };

  const refreshContainerDetails = () => {
    if (selectedContainerId && selectedContainerId !== ALL_CONTAINERS) {
      fetchContainerDetails(selectedContainerId);
    }
  };

  const renderContainerStatusTag = (status) => {
    if (!status) {
      return <StatusTag tone='grey'>{t('未知状态')}</StatusTag>;
    }

    const normalized =
      typeof status === 'string' ? status.trim().toLowerCase() : '';
    const statusMap = {
      running: { color: 'green', label: '运行中' },
      pending: { color: 'orange', label: '准备中' },
      deployed: { color: 'blue', label: '已部署' },
      failed: { color: 'red', label: '失败' },
      destroyed: { color: 'red', label: '已销毁' },
      stopping: { color: 'orange', label: '停止中' },
      terminated: { color: 'grey', label: '已终止' },
    };

    const config = statusMap[normalized] || { color: 'grey', label: status };

    return <StatusTag tone={config.color}>{t(config.label)}</StatusTag>;
  };

  const currentContainer =
    selectedContainerId !== ALL_CONTAINERS
      ? containers.find((ctr) => ctr.container_id === selectedContainerId)
      : null;

  const refreshLogs = () => {
    if (selectedContainerId && selectedContainerId !== ALL_CONTAINERS) {
      fetchContainerDetails(selectedContainerId);
    }
    fetchLogs();
  };

  // Filter logs based on search term
  const filteredLogs = logLines
    .map((line) => line ?? '')
    .filter(
      (line) =>
        !searchTerm || line.toLowerCase().includes(searchTerm.toLowerCase()),
    );

  const downloadLogs = () => {
    const sourceLogs = filteredLogs.length > 0 ? filteredLogs : logLines;
    if (sourceLogs.length === 0) {
      showError(t('暂无日志可下载'));
      return;
    }
    const logText = sourceLogs.join('\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeContainerId =
      selectedContainerId && selectedContainerId !== ALL_CONTAINERS
        ? selectedContainerId.replace(/[^a-zA-Z0-9_-]/g, '-')
        : '';
    const fileName = safeContainerId
      ? `deployment-${deployment.id}-container-${safeContainerId}-logs.txt`
      : `deployment-${deployment.id}-logs.txt`;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showSuccess(t('日志已下载'));
  };

  const copyAllLogs = async () => {
    const sourceLogs = filteredLogs.length > 0 ? filteredLogs : logLines;
    if (sourceLogs.length === 0) {
      showError(t('暂无日志可复制'));
      return;
    }
    const logText = sourceLogs.join('\n');

    const copied = await copy(logText);
    if (copied) {
      showSuccess(t('日志已复制到剪贴板'));
    } else {
      showError(t('复制失败，请手动选择文本复制'));
    }
  };

  // Auto refresh functionality
  useEffect(() => {
    if (autoRefresh && visible) {
      autoRefreshRef.current = setInterval(() => {
        fetchLogs();
      }, 5000);
    } else {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
    }

    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
      }
    };
  }, [autoRefresh, visible, selectedContainerId, streamFilter, following]);

  useEffect(() => {
    if (visible && deployment?.id) {
      fetchContainers();
    } else if (!visible) {
      setContainers([]);
      setSelectedContainerId(ALL_CONTAINERS);
      setContainerDetails(null);
      setStreamFilter('stdout');
      setLogLines([]);
      setLastUpdatedAt(null);
    }
  }, [visible, deployment?.id]);

  useEffect(() => {
    if (visible) {
      setStreamFilter('stdout');
    }
  }, [selectedContainerId, visible]);

  useEffect(() => {
    if (visible && deployment?.id) {
      fetchContainerDetails(selectedContainerId);
    }
  }, [visible, deployment?.id, selectedContainerId]);

  useEffect(() => {
    if (visible && deployment?.id) {
      fetchLogs();
    }

    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
      }
    };
  }, [visible, deployment?.id, streamFilter, selectedContainerId, following]);

  const renderLogEntry = (line, index) => (
    <div
      key={`${index}-${line.slice(0, 20)}`}
      className='whitespace-pre-wrap break-words border-b border-border px-3 py-1 font-mono text-sm hover:bg-surface-secondary'
    >
      {line}
    </div>
  );

  return (
    <Modal state={modalState}>
      <ModalBackdrop variant='blur'>
        <ModalContainer size='3xl' scroll='inside' placement='center'>
          <ModalDialog className='bg-background/95 backdrop-blur'>
            <ModalHeader className='border-b border-border'>
              <div className='flex items-center gap-2'>
                <FaTerminal className='text-primary' />
                <span>{t('容器日志')}</span>
                <span className='text-xs text-muted'>
                  - {deployment?.container_name || deployment?.id}
                </span>
              </div>
            </ModalHeader>
            <ModalBody className='px-4 py-4 md:px-6'>
              <div className='flex max-h-[70vh] flex-col gap-3'>
                {/* Toolbar */}
                <div className='rounded-2xl border border-border bg-background px-3 py-3'>
                  <div className='flex flex-wrap items-center justify-between gap-3'>
                    <div className='flex flex-wrap items-center gap-3'>
                      <select
                        value={selectedContainerId}
                        onChange={(event) =>
                          handleContainerChange(event.target.value)
                        }
                        aria-label={t('选择容器')}
                        disabled={containersLoading}
                        className='h-8 max-w-[260px] rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary'
                      >
                        <option value={ALL_CONTAINERS}>{t('全部容器')}</option>
                        {containers.map((ctr) => (
                          <option
                            key={ctr.container_id}
                            value={ctr.container_id}
                          >
                            {ctr.container_id}
                            {ctr.brand_name ? ` · ${ctr.brand_name}` : ''}
                          </option>
                        ))}
                      </select>

                      <div className='relative'>
                        <FaSearch className='pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted' />
                        <Input
                          aria-label={t('搜索日志内容')}
                          placeholder={t('搜索日志内容')}
                          value={searchTerm}
                          onValueChange={setSearchTerm}
                          size='sm'
                          className='w-44 [&_input]:pl-7'
                        />
                      </div>

                      <div className='flex items-center gap-2'>
                        <span className='text-xs text-muted'>
                          {t('日志流')}
                        </span>
                        <StreamSegment
                          value={streamFilter}
                          onChange={setStreamFilter}
                          options={[
                            { value: 'stdout', label: 'STDOUT' },
                            { value: 'stderr', label: 'STDERR' },
                          ]}
                        />
                      </div>

                      <label className='flex items-center gap-2'>
                        <Switch
                          isSelected={autoRefresh}
                          onValueChange={setAutoRefresh}
                          size='sm'
                          aria-label={t('自动刷新')}
                        >
                          <Switch.Control>
                            <Switch.Thumb />
                          </Switch.Control>
                        </Switch>
                        <span className='text-xs'>{t('自动刷新')}</span>
                      </label>

                      <label className='flex items-center gap-2'>
                        <Switch
                          isSelected={following}
                          onValueChange={setFollowing}
                          size='sm'
                          aria-label={t('跟随日志')}
                        >
                          <Switch.Control>
                            <Switch.Thumb />
                          </Switch.Control>
                        </Switch>
                        <span className='text-xs'>{t('跟随日志')}</span>
                      </label>
                    </div>

                    <div className='flex items-center gap-1'>
                      <Tooltip content={t('刷新日志')}>
                        <Button
                          isIconOnly
                          size='sm'
                          variant='light'
                          onPress={refreshLogs}
                          isPending={loading}
                          aria-label={t('刷新日志')}
                        >
                          <RefreshCw size={14} />
                        </Button>
                      </Tooltip>

                      <Tooltip content={t('复制日志')}>
                        <Button
                          isIconOnly
                          size='sm'
                          variant='light'
                          onPress={copyAllLogs}
                          isDisabled={logLines.length === 0}
                          aria-label={t('复制日志')}
                        >
                          <FaCopy />
                        </Button>
                      </Tooltip>

                      <Tooltip content={t('下载日志')}>
                        <Button
                          isIconOnly
                          size='sm'
                          variant='light'
                          onPress={downloadLogs}
                          isDisabled={logLines.length === 0}
                          aria-label={t('下载日志')}
                        >
                          <Download size={14} />
                        </Button>
                      </Tooltip>
                    </div>
                  </div>

                  {/* Status row */}
                  <div className='mt-3 border-t border-border pt-3 flex items-center justify-between text-xs text-muted'>
                    <div className='flex items-center gap-4'>
                      <span>
                        {t('共 {{count}} 条日志', { count: logLines.length })}
                      </span>
                      {searchTerm && (
                        <span>
                          {t('(筛选后显示 {{count}} 条)', {
                            count: filteredLogs.length,
                          })}
                        </span>
                      )}
                      {autoRefresh && (
                        <StatusTag tone='green'>
                          <FaClock />
                          {t('自动刷新中')}
                        </StatusTag>
                      )}
                    </div>

                    <span>
                      {t('状态')}: {deployment?.status || 'unknown'}
                    </span>
                  </div>

                  {/* Container detail strip */}
                  {selectedContainerId !== ALL_CONTAINERS && (
                    <>
                      <div className='my-3 h-px bg-border' />
                      <div className='flex flex-col gap-3'>
                        <div className='flex flex-wrap items-center justify-between gap-2'>
                          <div className='flex items-center gap-2'>
                            <StatusTag tone='blue'>{t('容器')}</StatusTag>
                            <span className='font-mono text-xs'>
                              {selectedContainerId}
                            </span>
                            {renderContainerStatusTag(
                              containerDetails?.status ||
                                currentContainer?.status,
                            )}
                          </div>

                          <div className='flex items-center gap-1'>
                            {containerDetails?.public_url && (
                              <Tooltip content={containerDetails.public_url}>
                                <Button
                                  isIconOnly
                                  size='sm'
                                  variant='light'
                                  onPress={() =>
                                    window.open(
                                      containerDetails.public_url,
                                      '_blank',
                                    )
                                  }
                                  aria-label={t('打开容器')}
                                >
                                  <FaLink />
                                </Button>
                              </Tooltip>
                            )}
                            <Tooltip content={t('刷新容器信息')}>
                              <Button
                                isIconOnly
                                size='sm'
                                variant='light'
                                onPress={refreshContainerDetails}
                                isPending={containerDetailsLoading}
                                aria-label={t('刷新容器信息')}
                              >
                                <RefreshCw size={14} />
                              </Button>
                            </Tooltip>
                          </div>
                        </div>

                        {containerDetailsLoading ? (
                          <div className='flex flex-col items-center justify-center gap-2 py-6'>
                            <Spinner color='primary' />
                            <span className='text-xs text-muted'>
                              {t('加载容器详情中...')}
                            </span>
                          </div>
                        ) : containerDetails ? (
                          <div className='grid gap-4 text-sm md:grid-cols-2'>
                            <div className='flex items-center gap-2'>
                              <FaInfoCircle className='text-primary' />
                              <span className='text-muted'>{t('硬件')}</span>
                              <span>
                                {containerDetails?.brand_name ||
                                  currentContainer?.brand_name ||
                                  t('未知品牌')}
                                {containerDetails?.hardware ||
                                currentContainer?.hardware
                                  ? ` · ${containerDetails?.hardware || currentContainer?.hardware}`
                                  : ''}
                              </span>
                            </div>
                            <div className='flex items-center gap-2'>
                              <FaServer className='text-accent' />
                              <span className='text-muted'>
                                {t('GPU/容器')}
                              </span>
                              <span>
                                {containerDetails?.gpus_per_container ??
                                  currentContainer?.gpus_per_container ??
                                  0}
                              </span>
                            </div>
                            <div className='flex items-center gap-2'>
                              <FaClock className='text-warning' />
                              <span className='text-muted'>
                                {t('创建时间')}
                              </span>
                              <span className='tabular-nums'>
                                {containerDetails?.created_at
                                  ? timestamp2string(containerDetails.created_at)
                                  : currentContainer?.created_at
                                    ? timestamp2string(currentContainer.created_at)
                                    : t('未知')}
                              </span>
                            </div>
                            <div className='flex items-center gap-2'>
                              <FaInfoCircle className='text-success' />
                              <span className='text-muted'>
                                {t('运行时长')}
                              </span>
                              <span className='tabular-nums'>
                                {containerDetails?.uptime_percent ??
                                  currentContainer?.uptime_percent ??
                                  0}
                                %
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className='text-xs text-muted'>
                            {t('暂无容器详情')}
                          </span>
                        )}

                        {containerDetails?.events &&
                          containerDetails.events.length > 0 && (
                            <div className='rounded-lg bg-surface-secondary p-3'>
                              <div className='text-xs text-muted'>
                                {t('最近事件')}
                              </div>
                              <div className='mt-2 max-h-32 space-y-2 overflow-y-auto'>
                                {containerDetails.events
                                  .slice(0, 5)
                                  .map((event, index) => (
                                    <div
                                      key={`${event.time}-${index}`}
                                      className='flex gap-3 font-mono text-xs'
                                    >
                                      <span className='text-muted'>
                                        {event.time
                                          ? timestamp2string(event.time)
                                          : '--'}
                                      </span>
                                      <span className='flex-1 break-all text-foreground'>
                                        {event.message}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                      </div>
                    </>
                  )}
                </div>

                {/* Log Content */}
                <div className='flex flex-1 flex-col overflow-hidden rounded-lg border border-border bg-surface-secondary'>
                  <div
                    ref={logContainerRef}
                    className='flex-1 overflow-y-auto bg-background'
                    style={{ maxHeight: '400px' }}
                  >
                    {loading && logLines.length === 0 ? (
                      <div className='flex flex-col items-center justify-center gap-2 p-8'>
                        <Spinner color='primary' />
                        <span className='text-sm text-muted'>
                          {t('加载日志中...')}
                        </span>
                      </div>
                    ) : filteredLogs.length === 0 ? (
                      <EmptyBlock
                        description={
                          searchTerm ? t('没有匹配的日志条目') : t('暂无日志')
                        }
                      />
                    ) : (
                      <div>
                        {filteredLogs.map((log, index) =>
                          renderLogEntry(log, index),
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer status */}
                  {logLines.length > 0 && (
                    <div className='flex items-center justify-between border-t border-border bg-surface-secondary px-3 py-2 text-xs text-muted'>
                      <span>
                        {following
                          ? t('正在跟随最新日志')
                          : t('日志已加载')}
                      </span>
                      <span className='tabular-nums'>
                        {t('最后更新')}:{' '}
                        {lastUpdatedAt
                          ? lastUpdatedAt.toLocaleTimeString()
                          : '--'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </ModalBody>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
};

export default ViewLogsModal;
