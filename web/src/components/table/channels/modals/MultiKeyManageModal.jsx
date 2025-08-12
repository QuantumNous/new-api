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
  Select,
  Row,
  Col,
  Badge,
  Progress,
  Card
} from '@douyinfe/semi-ui';
import { IllustrationNoResult, IllustrationNoResultDark } from '@douyinfe/semi-illustrations';
import { API, showError, showSuccess, timestamp2string } from '../../../../helpers/index.js';

const { Text } = Typography;

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
  const [pageSize, setPageSize] = useState(10);
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
        setPageSize(data.page_size || 10);
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

  // Percentages for progress display
  const enabledPercent = total > 0 ? Math.round((enabledCount / total) * 100) : 0;
  const manualDisabledPercent = total > 0 ? Math.round((manualDisabledCount / total) * 100) : 0;
  const autoDisabledPercent = total > 0 ? Math.round((autoDisabledCount / total) * 100) : 0;

  // 取消饼图：不再需要图表数据与配置

  // Get status tag component
  const renderStatusTag = (status) => {
    switch (status) {
      case 1:
        return <Tag color='green' shape='circle' size='small'>{t('已启用')}</Tag>;
      case 2:
        return <Tag color='red' shape='circle' size='small'>{t('已禁用')}</Tag>;
      case 3:
        return <Tag color='orange' shape='circle' size='small'>{t('自动禁用')}</Tag>;
      default:
        return <Tag color='grey' shape='circle' size='small'>{t('未知状态')}</Tag>;
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
      render: (status) => renderStatusTag(status),
    },
    {
      title: t('禁用原因'),
      dataIndex: 'reason',
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
      fixed: 'right',
      width: 100,
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
          <Text>{t('多密钥管理')}</Text>
          {channel?.name && (
            <Tag size='small' shape='circle' color='white'>{channel.name}</Tag>
          )}
          <Tag size='small' shape='circle' color='white'>
            {t('总密钥数')}: {total}
          </Tag>
          {channel?.channel_info?.multi_key_mode && (
            <Tag size='small' shape='circle' color='white'>
              {channel.channel_info.multi_key_mode === 'random' ? t('随机模式') : t('轮询模式')}
            </Tag>
          )}
        </Space>
      }
      visible={visible}
      onCancel={onCancel}
      width={900}
      footer={null}
    >
      <div className="flex flex-col mb-5">
        {/* Stats & Mode */}
        <div
          className="rounded-xl p-4 mb-3"
          style={{
            background: 'var(--semi-color-bg-1)',
            border: '1px solid var(--semi-color-border)'
          }}
        >
          <Row gutter={16} align="middle">
            <Col span={8}>
              <div style={{ background: 'var(--semi-color-bg-0)', border: '1px solid var(--semi-color-border)', borderRadius: 12, padding: 12 }}>
                <div className="flex items-center gap-2 mb-2">
                  <Badge dot type='success' />
                  <Text type='tertiary'>{t('已启用')}</Text>
                </div>
                <div className="flex items-end gap-2 mb-2">
                  <Text style={{ fontSize: 18, fontWeight: 700, color: '#22c55e' }}>{enabledCount}</Text>
                  <Text style={{ fontSize: 18, color: 'var(--semi-color-text-2)' }}>/ {total}</Text>
                </div>
                <Progress percent={enabledPercent} showInfo={false} size="small" stroke="#22c55e" style={{ height: 6, borderRadius: 999 }} />
              </div>
            </Col>
            <Col span={8}>
              <div style={{ background: 'var(--semi-color-bg-0)', border: '1px solid var(--semi-color-border)', borderRadius: 12, padding: 12 }}>
                <div className="flex items-center gap-2 mb-2">
                  <Badge dot type='danger' />
                  <Text type='tertiary'>{t('手动禁用')}</Text>
                </div>
                <div className="flex items-end gap-2 mb-2">
                  <Text style={{ fontSize: 18, fontWeight: 700, color: '#ef4444' }}>{manualDisabledCount}</Text>
                  <Text style={{ fontSize: 18, color: 'var(--semi-color-text-2)' }}>/ {total}</Text>
                </div>
                <Progress percent={manualDisabledPercent} showInfo={false} size="small" stroke="#ef4444" style={{ height: 6, borderRadius: 999 }} />
              </div>
            </Col>
            <Col span={8}>
              <div style={{ background: 'var(--semi-color-bg-0)', border: '1px solid var(--semi-color-border)', borderRadius: 12, padding: 12 }}>
                <div className="flex items-center gap-2 mb-2">
                  <Badge dot type='warning' />
                  <Text type='tertiary'>{t('自动禁用')}</Text>
                </div>
                <div className="flex items-end gap-2 mb-2">
                  <Text style={{ fontSize: 18, fontWeight: 700, color: '#f59e0b' }}>{autoDisabledCount}</Text>
                  <Text style={{ fontSize: 18, color: 'var(--semi-color-text-2)' }}>/ {total}</Text>
                </div>
                <Progress percent={autoDisabledPercent} showInfo={false} size="small" stroke="#f59e0b" style={{ height: 6, borderRadius: 999 }} />
              </div>
            </Col>
          </Row>
        </div>

        {/* Table */}
        <div className="flex-1 flex flex-col min-h-0">
          <Spin spinning={loading}>
            <Card className='!rounded-xl'>
              <Table
                title={() => (
                  <Row gutter={12} style={{ width: '100%' }}>
                    <Col span={14}>
                      <Row gutter={12} style={{ alignItems: 'center' }}>
                        <Col>
                          <Select
                            value={statusFilter}
                            onChange={handleStatusFilterChange}
                            size='small'
                            placeholder={t('全部状态')}
                          >
                            <Select.Option value={null}>{t('全部状态')}</Select.Option>
                            <Select.Option value={1}>{t('已启用')}</Select.Option>
                            <Select.Option value={2}>{t('手动禁用')}</Select.Option>
                            <Select.Option value={3}>{t('自动禁用')}</Select.Option>
                          </Select>
                        </Col>
                      </Row>
                    </Col>
                    <Col span={10} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Space>
                        <Button
                          size='small'
                          type='tertiary'
                          onClick={() => loadKeyStatus(currentPage, pageSize)}
                          loading={loading}
                        >
                          {t('刷新')}
                        </Button>
                        {(manualDisabledCount + autoDisabledCount) > 0 && (
                          <Popconfirm
                            title={t('确定要启用所有密钥吗？')}
                            onConfirm={handleEnableAll}
                            position={'topRight'}
                          >
                            <Button
                              size='small'
                              type='primary'
                              loading={operationLoading.enable_all}
                            >
                              {t('启用全部')}
                            </Button>
                          </Popconfirm>
                        )}
                        {enabledCount > 0 && (
                          <Popconfirm
                            title={t('确定要禁用所有的密钥吗？')}
                            onConfirm={handleDisableAll}
                            okType={'danger'}
                            position={'topRight'}
                          >
                            <Button
                              size='small'
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
                            size='small'
                            type='warning'
                            loading={operationLoading.delete_disabled}
                          >
                            {t('删除自动禁用密钥')}
                          </Button>
                        </Popconfirm>
                      </Space>
                    </Col>
                  </Row>
                )}
                columns={columns}
                dataSource={keyStatusList}
                pagination={{
                  currentPage: currentPage,
                  pageSize: pageSize,
                  total: total,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  pageSizeOpts: [10, 20, 50, 100],
                  onChange: (page, size) => {
                    setCurrentPage(page);
                    loadKeyStatus(page, size);
                  },
                  onShowSizeChange: (current, size) => {
                    setCurrentPage(1);
                    handlePageSizeChange(size);
                  }
                }}
                size='small'
                bordered={false}
                rowKey='index'
                scroll={{ x: 'max-content' }}
                empty={
                  <Empty
                    image={<IllustrationNoResult style={{ width: 140, height: 140 }} />}
                    darkModeImage={<IllustrationNoResultDark style={{ width: 140, height: 140 }} />}
                    title={t('暂无密钥数据')}
                    description={t('请检查渠道配置或刷新重试')}
                    style={{ padding: 30 }}
                  />
                }
              />
            </Card>
          </Spin>
        </div>
      </div>
    </Modal>
  );
};

export default MultiKeyManageModal; 