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
  Table,
  Tag,
  Typography,
  Space,
  Tooltip,
  Popconfirm,
  Empty,
  Spin,
  Banner,
  Select,
  Pagination
} from '@douyinfe/semi-ui';
import { 
  IconRefresh,
  IconDelete,
  IconClose,
  IconSave,
  IconSetting
} from '@douyinfe/semi-icons';
import { API, showError, showSuccess, timestamp2string } from '../../../../helpers/index.js';

const { Text, Title } = Typography;

const MultiKeyManageModal = ({
  visible,
  onCancel,
  channel,
  onRefresh
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [keyStatusList, setKeyStatusList] = useState([]);
  const [operationLoading, setOperationLoading] = useState({});
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  
  // Statistics states
  const [enabledCount, setEnabledCount] = useState(0);
  const [manualDisabledCount, setManualDisabledCount] = useState(0);
  const [autoDisabledCount, setAutoDisabledCount] = useState(0);

  // Filter states
  const [statusFilter, setStatusFilter] = useState(null); // null=all, 1=enabled, 2=manual_disabled, 3=auto_disabled

  // Load key status data
  const loadKeyStatus = async (page = currentPage, size = pageSize, status = statusFilter) => {
    if (!channel?.id) return;
    
    setLoading(true);
    try {
      const requestData = {
        channel_id: channel.id,
        action: 'get_key_status',
        page: page,
        page_size: size
      };
      
      // Add status filter if specified
      if (status !== null) {
        requestData.status = status;
      }
      
      const res = await API.post('/api/channel/multi_key/manage', requestData);
      
      if (res.data.success) {
        const data = res.data.data;
        setKeyStatusList(data.keys || []);
        setTotal(data.total || 0);
        setCurrentPage(data.page || 1);
        setPageSize(data.page_size || 50);
        setTotalPages(data.total_pages || 0);
        
        // Update statistics (these are always the overall statistics)
        setEnabledCount(data.enabled_count || 0);
        setManualDisabledCount(data.manual_disabled_count || 0);
        setAutoDisabledCount(data.auto_disabled_count || 0);
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      console.error(error);
      showError(t('获取密钥状态失败'));
    } finally {
      setLoading(false);
    }
  };

  // Disable a specific key
  const handleDisableKey = async (keyIndex) => {
    const operationId = `disable_${keyIndex}`;
    setOperationLoading(prev => ({ ...prev, [operationId]: true }));
    
    try {
      const res = await API.post('/api/channel/multi_key/manage', {
        channel_id: channel.id,
        action: 'disable_key',
        key_index: keyIndex
      });
      
      if (res.data.success) {
        showSuccess(t('密钥已禁用'));
        await loadKeyStatus(currentPage, pageSize); // Reload current page
        onRefresh && onRefresh(); // Refresh parent component
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('禁用密钥失败'));
    } finally {
      setOperationLoading(prev => ({ ...prev, [operationId]: false }));
    }
  };

  // Enable a specific key
  const handleEnableKey = async (keyIndex) => {
    const operationId = `enable_${keyIndex}`;
    setOperationLoading(prev => ({ ...prev, [operationId]: true }));
    
    try {
      const res = await API.post('/api/channel/multi_key/manage', {
        channel_id: channel.id,
        action: 'enable_key',
        key_index: keyIndex
      });
      
      if (res.data.success) {
        showSuccess(t('密钥已启用'));
        await loadKeyStatus(currentPage, pageSize); // Reload current page
        onRefresh && onRefresh(); // Refresh parent component
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('启用密钥失败'));
    } finally {
      setOperationLoading(prev => ({ ...prev, [operationId]: false }));
    }
  };

  // Enable all disabled keys
  const handleEnableAll = async () => {
    setOperationLoading(prev => ({ ...prev, enable_all: true }));
    
    try {
      const res = await API.post('/api/channel/multi_key/manage', {
        channel_id: channel.id,
        action: 'enable_all_keys'
      });
      
      if (res.data.success) {
        showSuccess(res.data.message || t('已启用所有密钥'));
        // Reset to first page after bulk operation
        setCurrentPage(1);
        await loadKeyStatus(1, pageSize);
        onRefresh && onRefresh(); // Refresh parent component
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('启用所有密钥失败'));
    } finally {
      setOperationLoading(prev => ({ ...prev, enable_all: false }));
    }
  };

  // Disable all enabled keys
  const handleDisableAll = async () => {
    setOperationLoading(prev => ({ ...prev, disable_all: true }));
    
    try {
      const res = await API.post('/api/channel/multi_key/manage', {
        channel_id: channel.id,
        action: 'disable_all_keys'
      });
      
      if (res.data.success) {
        showSuccess(res.data.message || t('已禁用所有密钥'));
        // Reset to first page after bulk operation
        setCurrentPage(1);
        await loadKeyStatus(1, pageSize);
        onRefresh && onRefresh(); // Refresh parent component
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('禁用所有密钥失败'));
    } finally {
      setOperationLoading(prev => ({ ...prev, disable_all: false }));
    }
  };

  // Delete all disabled keys
  const handleDeleteDisabledKeys = async () => {
    setOperationLoading(prev => ({ ...prev, delete_disabled: true }));
    
    try {
      const res = await API.post('/api/channel/multi_key/manage', {
        channel_id: channel.id,
        action: 'delete_disabled_keys'
      });
      
      if (res.data.success) {
        showSuccess(res.data.message);
        // Reset to first page after deletion as data structure might change
        setCurrentPage(1);
        await loadKeyStatus(1, pageSize);
        onRefresh && onRefresh(); // Refresh parent component
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('删除禁用密钥失败'));
    } finally {
      setOperationLoading(prev => ({ ...prev, delete_disabled: false }));
    }
  };

  // Handle page change
  const handlePageChange = (page) => {
    setCurrentPage(page);
    loadKeyStatus(page, pageSize);
  };

  // Handle page size change  
  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page
    loadKeyStatus(1, size);
  };

  // Handle status filter change
  const handleStatusFilterChange = (status) => {
    setStatusFilter(status);
    setCurrentPage(1); // Reset to first page when filter changes
    loadKeyStatus(1, pageSize, status);
  };

  // Effect to load data when modal opens
  useEffect(() => {
    if (visible && channel?.id) {
      setCurrentPage(1); // Reset to first page when opening
      loadKeyStatus(1, pageSize);
    }
  }, [visible, channel?.id]);

  // Reset pagination when modal closes
  useEffect(() => {
    if (!visible) {
      setCurrentPage(1);
      setKeyStatusList([]);
      setTotal(0);
      setTotalPages(0);
      setEnabledCount(0);
      setManualDisabledCount(0);
      setAutoDisabledCount(0);
      setStatusFilter(null); // Reset filter
    }
  }, [visible]);

  // Get status tag component
  const renderStatusTag = (status) => {
    switch (status) {
      case 1:
        return <Tag color='green' shape='circle'>{t('已启用')}</Tag>;
      case 2:
        return <Tag color='red' shape='circle'>{t('已禁用')}</Tag>;
      case 3:
        return <Tag color='orange' shape='circle'>{t('自动禁用')}</Tag>;
      default:
        return <Tag color='grey' shape='circle'>{t('未知状态')}</Tag>;
    }
  };

  // Table columns definition
  const columns = [
    {
      title: t('索引'),
      dataIndex: 'index',
      render: (text) => `#${text}`,
    },
    // {
    //   title: t('密钥预览'),
    //   dataIndex: 'key_preview',
    //   render: (text) => (
    //     <Text code style={{ fontSize: '12px' }}>
    //       {text}
    //     </Text>
    //   ),
    // },
    {
      title: t('状态'),
      dataIndex: 'status',
      width: 100,
      render: (status) => renderStatusTag(status),
    },
    {
      title: t('禁用原因'),
      dataIndex: 'reason',
      width: 220,
      render: (reason, record) => {
        if (record.status === 1 || !reason) {
          return <Text type='quaternary'>-</Text>;
        }
        return (
          <Tooltip content={reason}>
            <Text style={{ maxWidth: '200px', display: 'block' }} ellipsis>
              {reason}
            </Text>
          </Tooltip>
        );
      },
    },
    {
      title: t('禁用时间'),
      dataIndex: 'disabled_time',
      width: 150,
      render: (time, record) => {
        if (record.status === 1 || !time) {
          return <Text type='quaternary'>-</Text>;
        }
        return (
          <Tooltip content={timestamp2string(time)}>
            <Text style={{ fontSize: '12px' }}>
              {timestamp2string(time)}
            </Text>
          </Tooltip>
        );
      },
    },
    {
      title: t('操作'),
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          {record.status === 1 ? (
            <Button
              type='danger'
              size='small'
              loading={operationLoading[`disable_${record.index}`]}
              onClick={() => handleDisableKey(record.index)}
            >
              {t('禁用')}
            </Button>
          ) : (
            <Button
              type='primary'
              size='small'
              loading={operationLoading[`enable_${record.index}`]}
              onClick={() => handleEnableKey(record.index)}
            >
              {t('启用')}
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <IconSetting />
          <span>{t('多密钥管理')} - {channel?.name}</span>
        </Space>
      }
      visible={visible}
      onCancel={onCancel}
      width={900}
      footer={
        <Space>
          <Button onClick={onCancel}>{t('关闭')}</Button>
          <Button
            icon={<IconRefresh />}
            onClick={() => loadKeyStatus(currentPage, pageSize)}
            loading={loading}
          >
            {t('刷新')}
          </Button>
          <Popconfirm
            title={t('确定要启用所有密钥吗？')}
            onConfirm={handleEnableAll}
            position={'topRight'}
          >
            <Button
              type='primary'
              loading={operationLoading.enable_all}
            >
              {t('启用全部')}
            </Button>
          </Popconfirm>
          {enabledCount > 0 && (
            <Popconfirm
              title={t('确定要禁用所有的密钥吗？')}
              onConfirm={handleDisableAll}
              okType={'danger'}
              position={'topRight'}
            >
              <Button
                type='danger'
                loading={operationLoading.disable_all}
              >
                {t('禁用全部')}
              </Button>
            </Popconfirm>
          )}
          <Popconfirm
            title={t('确定要删除所有已自动禁用的密钥吗？')}
            content={t('此操作不可撤销，将永久删除已自动禁用的密钥')}
            onConfirm={handleDeleteDisabledKeys}
            okType={'danger'}
            position={'topRight'}
          >
            <Button
              type='danger'
              icon={<IconDelete />}
              loading={operationLoading.delete_disabled}
            >
              {t('删除自动禁用密钥')}
            </Button>
          </Popconfirm>
        </Space>
      }
    >
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Statistics Banner */}
        <Banner
          type='info'
          style={{ marginBottom: '16px', flexShrink: 0 }}
          description={
            <div>
              <Text>
                {t('总共 {{total}} 个密钥，{{enabled}} 个已启用，{{manual}} 个手动禁用，{{auto}} 个自动禁用', {
                  total: total,
                  enabled: enabledCount,
                  manual: manualDisabledCount,
                  auto: autoDisabledCount
                })}
              </Text>
              {channel?.channel_info?.multi_key_mode && (
                <div style={{ marginTop: '4px' }}>
                  <Text type='quaternary' style={{ fontSize: '12px' }}>
                    {t('多密钥模式')}: {channel.channel_info.multi_key_mode === 'random' ? t('随机') : t('轮询')}
                  </Text>
                </div>
              )}
            </div>
          }
        />

        {/* Filter Controls */}
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <Text style={{ fontSize: '14px', fontWeight: '500' }}>{t('状态筛选')}:</Text>
          <Select
            value={statusFilter}
            onChange={handleStatusFilterChange}
            style={{ width: '120px' }}
            size='small'
            placeholder={t('全部状态')}
          >
            <Select.Option value={null}>{t('全部状态')}</Select.Option>
            <Select.Option value={1}>{t('已启用')}</Select.Option>
            <Select.Option value={2}>{t('手动禁用')}</Select.Option>
            <Select.Option value={3}>{t('自动禁用')}</Select.Option>
          </Select>
          {statusFilter !== null && (
            <Text type='quaternary' style={{ fontSize: '12px' }}>
              {t('当前显示 {{count}} 条筛选结果', { count: total })}
            </Text>
          )}
        </div>

        {/* Key Status Table */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Spin spinning={loading}>
            {keyStatusList.length > 0 ? (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, overflow: 'auto', marginBottom: '16px' }}>
                  <Table
                    columns={columns}
                    dataSource={keyStatusList}
                    pagination={false}
                    size='small'
                    bordered
                    rowKey='index'
                    scroll={{ y: 'calc(100vh - 400px)' }}
                  />
                </div>
                
                {/* Pagination */}
                {total > 0 && (
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    flexShrink: 0,
                    padding: '12px 0',
                    borderTop: '1px solid var(--semi-color-border)',
                    backgroundColor: 'var(--semi-color-bg-1)'
                  }}>
                    <Text type='quaternary' style={{ fontSize: '12px' }}>
                      {t('显示第 {{start}}-{{end}} 条，共 {{total}} 条', {
                        start: (currentPage - 1) * pageSize + 1,
                        end: Math.min(currentPage * pageSize, total),
                        total: total
                      })}
                    </Text>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Text type='quaternary' style={{ fontSize: '12px' }}>
                        {t('每页显示')}:
                      </Text>
                      <Select
                        value={pageSize}
                        onChange={handlePageSizeChange}
                        size='small'
                        style={{ width: '80px' }}
                      >
                        <Select.Option value={50}>50</Select.Option>
                        <Select.Option value={100}>100</Select.Option>
                        <Select.Option value={500}>500</Select.Option>
                        <Select.Option value={1000}>1000</Select.Option>
                      </Select>
                      
                      <Pagination
                        current={currentPage}
                        total={total}
                        pageSize={pageSize}
                        showSizeChanger={false}
                        showQuickJumper
                        size='small'
                        onChange={handlePageChange}
                        showTotal={(total, range) => 
                          t('第 {{current}} / {{total}} 页', {
                            current: currentPage,
                            total: totalPages
                          })
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              !loading && (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  title={t('暂无密钥数据')}
                  description={t('请检查渠道配置或刷新重试')}
                />
              )
            )}
          </Spin>
        </div>
      </div>
    </Modal>
  );
};

export default MultiKeyManageModal; 