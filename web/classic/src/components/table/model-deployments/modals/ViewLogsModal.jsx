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
  Modal,
  Button,
  Typography,
  Select,
  Input,
  Space,
  Spin,
  Card,
  Tag,
  Empty,
  Switch,
  Divider,
  Tooltip,
  Radio,
} from '@douyinfe/semi-ui';
import {
  FaCopy,
  FaSearch,
  FaClock,
  FaTerminal,
  FaServer,
  FaInfoCircle,
  FaLink,
} from 'react-icons/fa';
import { IconRefresh, IconDownload } from '@douyinfe/semi-icons';
import {
  API,
  showError,
  showSuccess,
  copy,
  timestamp2string,
} from '../../../../helpers';

const { Text } = Typography;

const ALL_CONTAINERS = '__all__';

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

  // Auto scroll to bottom when new logs arrive
  const scrollToBottom = () => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  };

  const resolveStreamValue = (value) => {
    if (typeof value === 'string') {
      return value;
    }
    if (value && typeof value.value === 'string') {
      return value.value;
    }
    if (value && value.target && typeof value.target.value === 'string') {
      return value.target.value;
    }
    return '';
  };

  const handleStreamChange = (value) => {
    const next = resolveStreamValue(value) || 'stdout';
    setStreamFilter(next);
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

      const streamValue = resolveStreamValue(streamFilter) || 'stdout';
      if (streamValue && streamValue !== 'all') {
        params.append('stream', streamValue);
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
      return (
        <Tag color='grey' size='small'>
          {t('未知状态')}
        </Tag>
      );
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

    return (
      <Tag color={config.color} size='small'>
        {t(config.label)}
      </Tag>
    );
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

  // Initial load and cleanup
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

  // Filter logs based on search term
  const filteredLogs = logLines
    .map((line) => line ?? '')
    .filter(
      (line) =>
        !searchTerm || line.toLowerCase().includes(searchTerm.toLowerCase()),
    );

  const renderLogEntry = (line, index) => (
    <div
      key={`${index}-${line.slice(0, 20)}`}
      className='py-1 px-3 hover:bg-gray-50 font-mono text-sm border-b border-gray-100 whitespace-pre-wrap break-words'
    >
      {line}
    </div>
  );

  return (
    <Modal
      title={
        <div className='flex items-center gap-2'>
          <FaTerminal className='text-blue-500' />
          <span>{t('容器日志')}</span>
          <Text type='secondary' size='small'>
            - {deployment?.container_name || deployment?.id}
          </Text>
        </div>
      }
      visible={visible}
      onCancel={onCancel}
      footer={null}
      width={1000}
      height={700}
      className='logs-modal'
      style={{ top: 20 }}
    >
      <div className='flex flex-col h-full max-h-[600px]'>
        {/* Controls */}
        <Card className='mb-4 border-0 shadow-sm'>
          <div className='flex items-center justify-between flex-wrap gap-3'>
            <Space wrap>
              <Select
                prefix={<FaServer />}
                placeholder={t('选择容器')}
                value={selectedContainerId}
                onChange={handleContainerChange}
                style={{ width: 240 }}
                size='small'
                loading={containersLoading}
                dropdownStyle={{ maxHeight: 320, overflowY: 'auto' }}
              >
                <Select.Option value={ALL_CONTAINERS}>
                  {t('全部容器')}
                </Select.Option>
                {containers.map((ctr) => (
                  <Select.Option
                    key={ctr.container_id}
                    value={ctr.container_id}
                  >
                    <div className='flex flex-col'>
                      <span className='font-mono text-xs'>
                        {ctr.container_id}
                      </span>
                      <span className='text-xs text-gray-500'>
                        {ctr.brand_name || 'IO.NET'}
                        {ctr.hardware ? ` · ${ctr.hardware}` : ''}
                      </span>
                    </div>
                  </Select.Option>
                ))}
              </Select>

              <Input
                prefix={<FaSearch />}
                placeholder={t('搜索日志内容')}
                value={searchTerm}
                onChange={setSearchTerm}
                style={{ width: 200 }}
                size='small'
              />

              <Space align='center' className='ml-2'>
                <Text size='small' type='secondary'>
                  {t('日志流')}
                </Text>
                <Radio.Group
                  type='button'
                  size='small'
                  value={streamFilter}
                  onChange={handleStreamChange}
                >
                  <Radio value='stdout'>STDOUT</Radio>
                  <Radio value='stderr'>STDERR</Radio>
                </Radio.Group>
              </Space>

              <div className='flex items-center gap-2'>
                <Switch
                  checked={autoRefresh}
                  onChange={setAutoRefresh}
                  size='small'
                />
                <Text size='small'>{t('自动刷新')}</Text>
              </div>

              <div className='flex items-center gap-2'>
                <Switch
                  checked={following}
                  onChange={setFollowing}
                  size='small'
                />
                <Text size='small'>{t('跟随日志')}</Text>
              </div>
            </Space>

            <Space>
              <Tooltip content={t('刷新日志')}>
                <Button
                  icon={<IconRefresh />}
                  onClick={refreshLogs}
                  loading={loading}
                  size='small'
                  theme='borderless'
                />
              </Tooltip>

              <Tooltip content={t('复制日志')}>
                <Button
                  icon={<FaCopy />}
                  onClick={copyAllLogs}
                  size='small'
                  theme='borderless'
                  disabled={logLines.length === 0}
                />
              </Tooltip>

              <Tooltip content={t('下载日志')}>
                <Button
                  icon={<IconDownload />}
                  onClick={downloadLogs}
                  size='small'
                  theme='borderless'
                  disabled={logLines.length === 0}
                />
              </Tooltip>
            </Space>
          </div>

          {/* Status Info */}
          <Divider margin='12px' />
          <div className='flex items-center justify-between'>
            <Space size='large'>
              <Text size='small' type='secondary'>
                {t('共 {{count}} 条日志', { count: logLines.length })}
              </Text>
              {searchTerm && (
                <Text size='small' type='secondary'>
                  {t('(筛选后显示 {{count}} 条)', {
                    count: filteredLogs.length,
                  })}
                </Text>
              )}
              {autoRefresh && (
                <Tag color='green' size='small'>
                  <FaClock className='mr-1' />
                  {t('自动刷新中')}
                </Tag>
              )}
            </Space>

            <Text size='small' type='secondary'>
              {t('状态')}: {deployment?.status || 'unknown'}
            </Text>
          </div>

          {selectedContainerId !== ALL_CONTAINERS && (
            <>
              <Divider margin='12px' />
              <div className='flex flex-col gap-3'>
                <div className='flex items-center justify-between flex-wrap gap-2'>
                  <Space>
                    <Tag color='blue' size='small'>
                      {t('容器')}
                    </Tag>
                    <Text className='font-mono text-xs'>
                      {selectedContainerId}
                    </Text>
                    {renderContainerStatusTag(
                      containerDetails?.status || currentContainer?.status,
                    )}
                  </Space>

                  <Space>
                    {containerDetails?.public_url && (
                      <Tooltip content={containerDetails.public_url}>
                        <Button
                          icon={<FaLink />}
                          size='small'
                          theme='borderless'
                          onClick={() =>
                            window.open(containerDetails.public_url, '_blank')
                          }
                        />
                      </Tooltip>
                    )}
                    <Tooltip content={t('刷新容器信息')}>
                      <Button
                        icon={<IconRefresh />}
                        onClick={refreshContainerDetails}
                        size='small'
                        theme='borderless'
                        loading={containerDetailsLoading}
                      />
                    </Tooltip>
                  </Space>
                </div>

                {containerDetailsLoading ? (
                  <div className='flex items-center justify-center py-6'>
                    <Spin tip={t('加载容器详情中...')} />
                  </div>
                ) : containerDetails ? (
                  <div className='grid gap-4 md:grid-cols-2 text-sm'>
                    <div className='flex items-center gap-2'>
                      <FaInfoCircle className='text-blue-500' />
                      <Text type='secondary'>{t('硬件')}</Text>
                      <Text>
                        {containerDetails?.brand_name ||
                          currentContainer?.brand_name ||
                          t('未知品牌')}
                        {containerDetails?.hardware ||
                        currentContainer?.hardware
                          ? ` · ${containerDetails?.hardware || currentContainer?.hardware}`
                          : ''}
                      </Text>
                    </div>
                    <div className='flex items-center gap-2'>
                      <FaServer className='text-purple-500' />
                      <Text type='secondary'>{t('GPU/容器')}</Text>
                      <Text>
                        {containerDetails?.gpus_per_container ??
                          currentContainer?.gpus_per_container ??
                          0}
                      </Text>
                    </div>
                    <div className='flex items-center gap-2'>
                      <FaClock className='text-orange-500' />
                      <Text type='secondary'>{t('创建时间')}</Text>
                      <Text>
                        {containerDetails?.created_at
                          ? timestamp2string(containerDetails.created_at)
                          : currentContainer?.created_at
                            ? timestamp2string(currentContainer.created_at)
                            : t('未知')}
                      </Text>
                    </div>
                    <div className='flex items-center gap-2'>
                      <FaInfoCircle className='text-green-500' />
                      <Text type='secondary'>{t('运行时长')}</Text>
                      <Text>
                        {containerDetails?.uptime_percent ??
                          currentContainer?.uptime_percent ??
                          0}
                        %
                      </Text>
                    </div>
                  </div>
                ) : (
                  <Text size='small' type='secondary'>
                    {t('暂无容器详情')}
                  </Text>
                )}

                {containerDetails?.events &&
                  containerDetails.events.length > 0 && (
                    <div className='bg-gray-50 rounded-lg p-3'>
                      <Text size='small' type='secondary'>
                        {t('最近事件')}
                      </Text>
                      <div className='mt-2 space-y-2 max-h-32 overflow-y-auto'>
                        {containerDetails.events
                          .slice(0, 5)
                          .map((event, index) => (
                            <div
                              key={`${event.time}-${index}`}
                              className='flex gap-3 text-xs font-mono'
                            >
                              <span className='text-gray-500'>
                                {event.time
                                  ? timestamp2string(event.time)
                                  : '--'}
                              </span>
                              <span className='text-gray-700 break-all flex-1'>
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
        </Card>

        {/* Log Content */}
        <div className='flex-1 flex flex-col border rounded-lg bg-gray-50 overflow-hidden'>
          <div
            ref={logContainerRef}
            className='flex-1 overflow-y-auto bg-white'
            style={{ maxHeight: '400px' }}
          >
            {loading && logLines.length === 0 ? (
              <div className='flex items-center justify-center p-8'>
                <Spin tip={t('加载日志中...')} />
              </div>
            ) : filteredLogs.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  searchTerm ? t('没有匹配的日志条目') : t('暂无日志')
                }
                style={{ padding: '60px 20px' }}
              />
            ) : (
              <div>
                {filteredLogs.map((log, index) => renderLogEntry(log, index))}
              </div>
            )}
          </div>

          {/* Footer status */}
          {logLines.length > 0 && (
            <div className='flex items-center justify-between px-3 py-2 bg-gray-50 border-t text-xs text-gray-500'>
              <span>{following ? t('正在跟随最新日志') : t('日志已加载')}</span>
              <span>
                {t('最后更新')}:{' '}
                {lastUpdatedAt ? lastUpdatedAt.toLocaleTimeString() : '--'}
              </span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ViewLogsModal;
