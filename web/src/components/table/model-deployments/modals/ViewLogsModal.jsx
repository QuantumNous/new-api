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
  Banner,
} from '@douyinfe/semi-ui';
import { 
  FaDownload, 
  FaRefresh, 
  FaPlay, 
  FaStop, 
  FaCopy,
  FaSearch,
  FaFilter,
  FaClock,
  FaTerminal
} from 'react-icons/fa';
import { IconRefresh, IconDownload } from '@douyinfe/semi-icons';
import { API, showError, showSuccess, timestamp2string } from '../../../../helpers';

const { Text, Paragraph } = Typography;

const LogLevelColors = {
  INFO: 'blue',
  WARN: 'orange', 
  ERROR: 'red',
  DEBUG: 'grey',
  TRACE: 'purple'
};

const ViewLogsModal = ({ 
  visible, 
  onCancel, 
  deployment, 
  t 
}) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [following, setFollowing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState('');
  
  const logContainerRef = useRef(null);
  const autoRefreshRef = useRef(null);

  // Auto scroll to bottom when new logs arrive
  const scrollToBottom = () => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  };

  const fetchLogs = async (cursor = '', append = false) => {
    if (!deployment?.id) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: '100'
      });
      
      if (cursor) params.append('cursor', cursor);
      if (levelFilter) params.append('level', levelFilter);
      if (following) params.append('follow', 'true');
      
      const response = await API.get(`/api/deployments/${deployment.id}/logs?${params}`);
      
      if (response.data.success) {
        const newLogs = response.data.data.logs || [];
        
        if (append) {
          setLogs(prev => [...prev, ...newLogs]);
        } else {
          setLogs(newLogs);
        }
        
        setHasMore(response.data.data.has_more || false);
        setNextCursor(response.data.data.next_cursor || '');
        
        // Scroll to bottom for new logs
        if (!append || following) {
          setTimeout(scrollToBottom, 100);
        }
      }
    } catch (error) {
      showError(t('获取日志失败') + ': ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const loadMoreLogs = () => {
    if (hasMore && nextCursor && !loading) {
      fetchLogs(nextCursor, true);
    }
  };

  const refreshLogs = () => {
    fetchLogs();
  };

  const downloadLogs = () => {
    const logText = logs.map(log => 
      `[${timestamp2string(log.timestamp)}] [${log.level}] ${log.source ? `[${log.source}] ` : ''}${log.message}`
    ).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deployment-${deployment.id}-logs.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showSuccess(t('日志已下载'));
  };

  const copyAllLogs = () => {
    const logText = logs.map(log => 
      `[${timestamp2string(log.timestamp)}] [${log.level}] ${log.source ? `[${log.source}] ` : ''}${log.message}`
    ).join('\n');
    
    navigator.clipboard.writeText(logText);
    showSuccess(t('日志已复制到剪贴板'));
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
  }, [autoRefresh, visible]);

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
  }, [visible, deployment?.id, levelFilter]);

  // Filter logs based on search term
  const filteredLogs = logs.filter(log =>
    !searchTerm || log.message.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderLogEntry = (log, index) => {
    const level = log.level || 'INFO';
    const color = LogLevelColors[level] || 'grey';
    
    return (
      <div 
        key={`${log.timestamp}-${index}`} 
        className="flex items-start gap-2 py-2 px-3 hover:bg-gray-50 font-mono text-sm border-b border-gray-100"
      >
        <div className="flex-shrink-0 w-16">
          <Text type="secondary" size="small" className="text-xs">
            {new Date(log.timestamp).toLocaleTimeString()}
          </Text>
        </div>
        <div className="flex-shrink-0">
          <Tag color={color} size="small">
            {level}
          </Tag>
        </div>
        {log.source && (
          <div className="flex-shrink-0">
            <Tag size="small" className="bg-gray-100 text-gray-600">
              {log.source}
            </Tag>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <Text className="break-all whitespace-pre-wrap">
            {log.message}
          </Text>
        </div>
      </div>
    );
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <FaTerminal className="text-blue-500" />
          <span>{t('容器日志')}</span>
          <Text type="secondary" size="small">
            - {deployment?.container_name || deployment?.id}
          </Text>
        </div>
      }
      visible={visible}
      onCancel={onCancel}
      footer={null}
      width={1000}
      height={700}
      className="logs-modal"
      style={{ top: 20 }}
    >
      <div className="flex flex-col h-full max-h-[600px]">
        {/* Controls */}
        <Card className="mb-4 border-0 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <Space wrap>
              <Input
                prefix={<FaSearch />}
                placeholder={t('搜索日志内容')}
                value={searchTerm}
                onChange={setSearchTerm}
                style={{ width: 200 }}
                size="small"
              />
              
              <Select
                prefix={<FaFilter />}
                placeholder={t('日志级别')}
                value={levelFilter}
                onChange={setLevelFilter}
                style={{ width: 120 }}
                size="small"
                allowClear
              >
                <Select.Option value="INFO">INFO</Select.Option>
                <Select.Option value="WARN">WARN</Select.Option>
                <Select.Option value="ERROR">ERROR</Select.Option>
                <Select.Option value="DEBUG">DEBUG</Select.Option>
                <Select.Option value="TRACE">TRACE</Select.Option>
              </Select>

              <div className="flex items-center gap-2">
                <Switch
                  checked={autoRefresh}
                  onChange={setAutoRefresh}
                  size="small"
                />
                <Text size="small">{t('自动刷新')}</Text>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={following}
                  onChange={setFollowing}
                  size="small"
                />
                <Text size="small">{t('跟随日志')}</Text>
              </div>
            </Space>

            <Space>
              <Tooltip content={t('刷新日志')}>
                <Button 
                  icon={<IconRefresh />} 
                  onClick={refreshLogs}
                  loading={loading}
                  size="small"
                  theme="borderless"
                />
              </Tooltip>
              
              <Tooltip content={t('复制日志')}>
                <Button 
                  icon={<FaCopy />} 
                  onClick={copyAllLogs}
                  size="small"
                  theme="borderless"
                  disabled={logs.length === 0}
                />
              </Tooltip>
              
              <Tooltip content={t('下载日志')}>
                <Button 
                  icon={<IconDownload />} 
                  onClick={downloadLogs}
                  size="small"
                  theme="borderless"
                  disabled={logs.length === 0}
                />
              </Tooltip>
            </Space>
          </div>
          
          {/* Status Info */}
          <Divider margin="12px" />
          <div className="flex items-center justify-between">
            <Space size="large">
              <Text size="small" type="secondary">
                {t('共 {{count}} 条日志', { count: filteredLogs.length })}
              </Text>
              {searchTerm && (
                <Text size="small" type="secondary">
                  {t('(筛选后显示 {{count}} 条)', { count: filteredLogs.length })}
                </Text>
              )}
              {autoRefresh && (
                <Tag color="green" size="small">
                  <FaClock className="mr-1" />
                  {t('自动刷新中')}
                </Tag>
              )}
            </Space>
            
            <Text size="small" type="secondary">
              {t('状态')}: {deployment?.status || 'unknown'}
            </Text>
          </div>
        </Card>

        {/* Log Content */}
        <div className="flex-1 flex flex-col border rounded-lg bg-gray-50 overflow-hidden">
          <div 
            ref={logContainerRef}
            className="flex-1 overflow-y-auto bg-white"
            style={{ maxHeight: '400px' }}
          >
            {loading && logs.length === 0 ? (
              <div className="flex items-center justify-center p-8">
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
                
                {/* Load More Button */}
                {hasMore && !autoRefresh && (
                  <div className="flex items-center justify-center p-4 border-t">
                    <Button 
                      onClick={loadMoreLogs}
                      loading={loading}
                      theme="borderless"
                      size="small"
                    >
                      {t('加载更多日志')}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Footer status */}
          {logs.length > 0 && (
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-t text-xs text-gray-500">
              <span>
                {following ? t('正在跟随最新日志') : t('日志已加载')}
              </span>
              <span>
                {t('最后更新')}: {new Date().toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ViewLogsModal;