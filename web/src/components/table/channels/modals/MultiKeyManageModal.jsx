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

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Card,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalHeader,
  Spinner,
  Tooltip,
  useOverlayState,
} from '@heroui/react';
import { Inbox, RefreshCw } from 'lucide-react';
import {
  API,
  showError,
  showSuccess,
  timestamp2string,
} from '../../../../helpers';
import ConfirmDialog from '../../../common/ui/ConfirmDialog';
import { warningButtonClass } from '../../../common/ui/buttonTones';

// ----------------------------- helpers -----------------------------

const TAG_TONE = {
  green: 'bg-success/15 text-success',
  red: 'bg-danger/15 text-danger',
  orange: 'bg-warning/15 text-warning',
  blue: 'bg-primary/15 text-primary',
  grey: 'bg-surface-secondary text-muted',
  white: 'bg-background border border-border text-foreground',
};

function StatusChip({ tone = 'grey', children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
        TAG_TONE[tone] || TAG_TONE.grey
      }`}
    >
      {children}
    </span>
  );
}

function ProgressBar({ percent, tone = 'primary', height = 6 }) {
  const safe = Math.max(0, Math.min(100, Number(percent) || 0));
  const fill =
    tone === 'success'
      ? 'bg-success'
      : tone === 'danger'
        ? 'bg-danger'
        : tone === 'warning'
          ? 'bg-warning'
          : 'bg-primary';
  return (
    <div
      className='w-full overflow-hidden rounded-full bg-surface-secondary'
      style={{ height }}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-200 ${fill}`}
        style={{ width: `${safe}%` }}
      />
    </div>
  );
}

function StatTile({ tone, label, count, total, percent }) {
  const dotCls =
    tone === 'success'
      ? 'bg-success'
      : tone === 'danger'
        ? 'bg-danger'
        : 'bg-warning';
  const numberCls =
    tone === 'success'
      ? 'text-success'
      : tone === 'danger'
        ? 'text-danger'
        : 'text-warning';

  return (
    <div className='rounded-xl border border-border bg-background p-3'>
      <div className='mb-2 flex items-center gap-2'>
        <span className={`inline-block h-2 w-2 rounded-full ${dotCls}`} />
        <span className='text-xs text-muted'>{label}</span>
      </div>
      <div className='mb-2 flex items-end gap-2'>
        <span className={`text-lg font-bold ${numberCls}`}>{count}</span>
        <span className='text-base text-muted'>/ {total}</span>
      </div>
      <ProgressBar percent={percent} tone={tone} />
    </div>
  );
}

const STATUS_OPTIONS = (t) => [
  { value: null, label: t('全部状态') },
  { value: 1, label: t('已启用') },
  { value: 2, label: t('手动禁用') },
  { value: 3, label: t('自动禁用') },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const inputClass =
  'h-8 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary disabled:opacity-50';

// ----------------------------- main -----------------------------

const MultiKeyManageModal = ({ visible, onCancel, channel, onRefresh }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [keyStatusList, setKeyStatusList] = useState([]);
  const [operationLoading, setOperationLoading] = useState({});

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Statistics
  const [enabledCount, setEnabledCount] = useState(0);
  const [manualDisabledCount, setManualDisabledCount] = useState(0);
  const [autoDisabledCount, setAutoDisabledCount] = useState(0);

  // Filter
  const [statusFilter, setStatusFilter] = useState(null);

  // ConfirmDialog targets
  const [deleteKeyTarget, setDeleteKeyTarget] = useState(null); // index
  const [confirmEnableAll, setConfirmEnableAll] = useState(false);
  const [confirmDisableAll, setConfirmDisableAll] = useState(false);
  const [confirmDeleteDisabled, setConfirmDeleteDisabled] = useState(false);

  const modalState = useOverlayState({
    isOpen: visible,
    onOpenChange: (isOpen) => {
      if (!isOpen) onCancel?.();
    },
  });

  const loadKeyStatus = async (
    page = currentPage,
    size = pageSize,
    status = statusFilter,
  ) => {
    if (!channel?.id) return;

    setLoading(true);
    try {
      const requestData = {
        channel_id: channel.id,
        action: 'get_key_status',
        page,
        page_size: size,
      };
      if (status !== null) requestData.status = status;

      const res = await API.post('/api/channel/multi_key/manage', requestData);
      if (res.data.success) {
        const data = res.data.data;
        setKeyStatusList(data.keys || []);
        setTotal(data.total || 0);
        setCurrentPage(data.page || 1);
        setPageSize(data.page_size || 10);
        setTotalPages(data.total_pages || 0);
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

  const setOpLoading = (id, value) =>
    setOperationLoading((prev) => ({ ...prev, [id]: value }));

  const handleDisableKey = async (keyIndex) => {
    const id = `disable_${keyIndex}`;
    setOpLoading(id, true);
    try {
      const res = await API.post('/api/channel/multi_key/manage', {
        channel_id: channel.id,
        action: 'disable_key',
        key_index: keyIndex,
      });
      if (res.data.success) {
        showSuccess(t('密钥已禁用'));
        await loadKeyStatus(currentPage, pageSize);
        onRefresh && onRefresh();
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('禁用密钥失败'));
    } finally {
      setOpLoading(id, false);
    }
  };

  const handleEnableKey = async (keyIndex) => {
    const id = `enable_${keyIndex}`;
    setOpLoading(id, true);
    try {
      const res = await API.post('/api/channel/multi_key/manage', {
        channel_id: channel.id,
        action: 'enable_key',
        key_index: keyIndex,
      });
      if (res.data.success) {
        showSuccess(t('密钥已启用'));
        await loadKeyStatus(currentPage, pageSize);
        onRefresh && onRefresh();
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('启用密钥失败'));
    } finally {
      setOpLoading(id, false);
    }
  };

  const handleEnableAll = async () => {
    setOpLoading('enable_all', true);
    try {
      const res = await API.post('/api/channel/multi_key/manage', {
        channel_id: channel.id,
        action: 'enable_all_keys',
      });
      if (res.data.success) {
        showSuccess(res.data.message || t('已启用所有密钥'));
        setCurrentPage(1);
        await loadKeyStatus(1, pageSize);
        onRefresh && onRefresh();
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('启用所有密钥失败'));
    } finally {
      setOpLoading('enable_all', false);
    }
  };

  const handleDisableAll = async () => {
    setOpLoading('disable_all', true);
    try {
      const res = await API.post('/api/channel/multi_key/manage', {
        channel_id: channel.id,
        action: 'disable_all_keys',
      });
      if (res.data.success) {
        showSuccess(res.data.message || t('已禁用所有密钥'));
        setCurrentPage(1);
        await loadKeyStatus(1, pageSize);
        onRefresh && onRefresh();
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('禁用所有密钥失败'));
    } finally {
      setOpLoading('disable_all', false);
    }
  };

  const handleDeleteDisabledKeys = async () => {
    setOpLoading('delete_disabled', true);
    try {
      const res = await API.post('/api/channel/multi_key/manage', {
        channel_id: channel.id,
        action: 'delete_disabled_keys',
      });
      if (res.data.success) {
        showSuccess(res.data.message);
        setCurrentPage(1);
        await loadKeyStatus(1, pageSize);
        onRefresh && onRefresh();
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('删除禁用密钥失败'));
    } finally {
      setOpLoading('delete_disabled', false);
    }
  };

  const handleDeleteKey = async (keyIndex) => {
    const id = `delete_${keyIndex}`;
    setOpLoading(id, true);
    try {
      const res = await API.post('/api/channel/multi_key/manage', {
        channel_id: channel.id,
        action: 'delete_key',
        key_index: keyIndex,
      });
      if (res.data.success) {
        showSuccess(t('密钥已删除'));
        await loadKeyStatus(currentPage, pageSize);
        onRefresh && onRefresh();
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('删除密钥失败'));
    } finally {
      setOpLoading(id, false);
    }
  };

  const handleStatusFilterChange = (status) => {
    setStatusFilter(status);
    setCurrentPage(1);
    loadKeyStatus(1, pageSize, status);
  };

  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setCurrentPage(1);
    loadKeyStatus(1, size);
  };

  useEffect(() => {
    if (visible && channel?.id) {
      setCurrentPage(1);
      loadKeyStatus(1, pageSize);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, channel?.id]);

  useEffect(() => {
    if (!visible) {
      setCurrentPage(1);
      setKeyStatusList([]);
      setTotal(0);
      setTotalPages(0);
      setEnabledCount(0);
      setManualDisabledCount(0);
      setAutoDisabledCount(0);
      setStatusFilter(null);
    }
  }, [visible]);

  const enabledPercent =
    total > 0 ? Math.round((enabledCount / total) * 100) : 0;
  const manualDisabledPercent =
    total > 0 ? Math.round((manualDisabledCount / total) * 100) : 0;
  const autoDisabledPercent =
    total > 0 ? Math.round((autoDisabledCount / total) * 100) : 0;

  const renderStatusTag = (status) => {
    switch (status) {
      case 1:
        return <StatusChip tone='green'>{t('已启用')}</StatusChip>;
      case 2:
        return <StatusChip tone='red'>{t('已禁用')}</StatusChip>;
      case 3:
        return <StatusChip tone='orange'>{t('自动禁用')}</StatusChip>;
      default:
        return <StatusChip tone='grey'>{t('未知状态')}</StatusChip>;
    }
  };

  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, total);

  return (
    <>
      <Modal state={modalState}>
        <ModalBackdrop variant='blur'>
          <ModalContainer
            size='4xl'
            placement='center'
            className='max-w-[95vw]'
          >
            <ModalDialog className='bg-background/95 backdrop-blur'>
              <ModalHeader className='border-b border-border'>
                <div className='flex flex-wrap items-center gap-2'>
                  <span>{t('多密钥管理')}</span>
                  {channel?.name && (
                    <StatusChip tone='white'>{channel.name}</StatusChip>
                  )}
                  <StatusChip tone='white'>
                    {t('总密钥数')}: {total}
                  </StatusChip>
                  {channel?.channel_info?.multi_key_mode && (
                    <StatusChip tone='white'>
                      {channel.channel_info.multi_key_mode === 'random'
                        ? t('随机模式')
                        : t('轮询模式')}
                    </StatusChip>
                  )}
                </div>
              </ModalHeader>
              <ModalBody className='space-y-4 px-6 py-5'>
                {/* Stats */}
                <div className='rounded-xl border border-border bg-background p-4'>
                  <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
                    <StatTile
                      tone='success'
                      label={t('已启用')}
                      count={enabledCount}
                      total={total}
                      percent={enabledPercent}
                    />
                    <StatTile
                      tone='danger'
                      label={t('手动禁用')}
                      count={manualDisabledCount}
                      total={total}
                      percent={manualDisabledPercent}
                    />
                    <StatTile
                      tone='warning'
                      label={t('自动禁用')}
                      count={autoDisabledCount}
                      total={total}
                      percent={autoDisabledPercent}
                    />
                  </div>
                </div>

                {/* Table card */}
                <Card className='!rounded-xl'>
                  <Card.Content className='space-y-3 p-4'>
                    {/* Toolbar */}
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                      <div>
                        <select
                          value={
                            statusFilter === null ? '' : String(statusFilter)
                          }
                          onChange={(event) => {
                            const v = event.target.value;
                            handleStatusFilterChange(
                              v === '' ? null : Number(v),
                            );
                          }}
                          className={inputClass}
                        >
                          {STATUS_OPTIONS(t).map((option) => (
                            <option
                              key={option.value === null ? 'all' : option.value}
                              value={option.value === null ? '' : option.value}
                            >
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className='flex flex-wrap items-center gap-2'>
                        <Button
                          size='sm'
                          variant='tertiary'
                          isPending={loading}
                          onPress={() => loadKeyStatus(currentPage, pageSize)}
                        >
                          <RefreshCw size={14} />
                          {t('刷新')}
                        </Button>
                        {manualDisabledCount + autoDisabledCount > 0 && (
                          <Button
                            size='sm'
                            color='primary'
                            isPending={operationLoading.enable_all}
                            onPress={() => setConfirmEnableAll(true)}
                          >
                            {t('启用全部')}
                          </Button>
                        )}
                        {enabledCount > 0 && (
                          <Button
                            size='sm'
                            color='danger'
                            isPending={operationLoading.disable_all}
                            onPress={() => setConfirmDisableAll(true)}
                          >
                            {t('禁用全部')}
                          </Button>
                        )}
                        <Button
                          size='sm'
                          variant='primary'
                          className={warningButtonClass}
                          isPending={operationLoading.delete_disabled}
                          onPress={() => setConfirmDeleteDisabled(true)}
                        >
                          {t('删除自动禁用密钥')}
                        </Button>
                      </div>
                    </div>

                    {/* Table */}
                    <div className='relative min-h-[200px] overflow-x-auto rounded-xl border border-border'>
                      {loading && (
                        <div className='absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px]'>
                          <Spinner color='primary' />
                        </div>
                      )}
                      <table className='w-full text-sm'>
                        <thead className='bg-surface-secondary text-xs uppercase tracking-wide text-muted'>
                          <tr>
                            <th className='px-4 py-2 text-left font-medium'>
                              {t('索引')}
                            </th>
                            <th className='px-4 py-2 text-left font-medium'>
                              {t('状态')}
                            </th>
                            <th className='px-4 py-2 text-left font-medium'>
                              {t('禁用原因')}
                            </th>
                            <th className='px-4 py-2 text-left font-medium'>
                              {t('禁用时间')}
                            </th>
                            <th className='sticky right-0 w-[180px] bg-surface-secondary px-4 py-2 text-left font-medium'>
                              {t('操作')}
                            </th>
                          </tr>
                        </thead>
                        <tbody className='divide-y divide-border'>
                          {keyStatusList.length === 0 && !loading ? (
                            <tr>
                              <td
                                colSpan={5}
                                className='px-4 py-10 text-center'
                              >
                                <div className='flex flex-col items-center gap-2'>
                                  <Inbox size={36} className='text-muted/60' />
                                  <div className='text-sm font-semibold text-foreground'>
                                    {t('暂无密钥数据')}
                                  </div>
                                  <div className='text-xs text-muted'>
                                    {t('请检查渠道配置或刷新重试')}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            keyStatusList.map((record) => (
                              <tr
                                key={record.index}
                                className='bg-background hover:bg-surface-secondary/60'
                              >
                                <td className='px-4 py-3 align-middle text-foreground'>
                                  #{Number(record.index) + 1}
                                </td>
                                <td className='px-4 py-3 align-middle'>
                                  {renderStatusTag(record.status)}
                                </td>
                                <td className='px-4 py-3 align-middle'>
                                  {record.status === 1 || !record.reason ? (
                                    <span className='text-muted'>-</span>
                                  ) : (
                                    <Tooltip content={record.reason}>
                                      <div className='block max-w-[200px] truncate text-foreground'>
                                        {record.reason}
                                      </div>
                                    </Tooltip>
                                  )}
                                </td>
                                <td className='px-4 py-3 align-middle'>
                                  {record.status === 1 ||
                                  !record.disabled_time ? (
                                    <span className='text-muted'>-</span>
                                  ) : (
                                    <Tooltip
                                      content={timestamp2string(
                                        record.disabled_time,
                                      )}
                                    >
                                      <span className='text-xs text-foreground'>
                                        {timestamp2string(record.disabled_time)}
                                      </span>
                                    </Tooltip>
                                  )}
                                </td>
                                <td className='sticky right-0 bg-background px-4 py-3 align-middle'>
                                  <div className='flex flex-wrap gap-2'>
                                    {record.status === 1 ? (
                                      <Button
                                        size='sm'
                                        variant='danger-soft'
                                        isPending={
                                          operationLoading[
                                            `disable_${record.index}`
                                          ]
                                        }
                                        onPress={() =>
                                          handleDisableKey(record.index)
                                        }
                                      >
                                        {t('禁用')}
                                      </Button>
                                    ) : (
                                      <Button
                                        size='sm'
                                        variant='tertiary'
                                        isPending={
                                          operationLoading[
                                            `enable_${record.index}`
                                          ]
                                        }
                                        onPress={() =>
                                          handleEnableKey(record.index)
                                        }
                                      >
                                        {t('启用')}
                                      </Button>
                                    )}
                                    <Button
                                      size='sm'
                                      variant='danger-soft'
                                      isPending={
                                        operationLoading[
                                          `delete_${record.index}`
                                        ]
                                      }
                                      onPress={() =>
                                        setDeleteKeyTarget(record.index)
                                      }
                                    >
                                      {t('删除')}
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {total > 0 && (
                      <div className='flex flex-wrap items-center justify-between gap-3 text-xs text-muted'>
                        <span>
                          {t('共 {{total}} 项，当前显示 {{start}}-{{end}} 项', {
                            total,
                            start: startIndex,
                            end: endIndex,
                          })}
                        </span>
                        <div className='flex items-center gap-2'>
                          <select
                            value={pageSize}
                            onChange={(event) =>
                              handlePageSizeChange(Number(event.target.value))
                            }
                            className={inputClass}
                          >
                            {PAGE_SIZE_OPTIONS.map((size) => (
                              <option key={size} value={size}>
                                {size} / {t('页')}
                              </option>
                            ))}
                          </select>
                          <Button
                            size='sm'
                            variant='tertiary'
                            isDisabled={currentPage <= 1}
                            onPress={() => {
                              const next = Math.max(1, currentPage - 1);
                              setCurrentPage(next);
                              loadKeyStatus(next, pageSize);
                            }}
                          >
                            {t('上一页')}
                          </Button>
                          <span>
                            {currentPage} / {Math.max(1, totalPages)}
                          </span>
                          <Button
                            size='sm'
                            variant='tertiary'
                            isDisabled={currentPage >= totalPages}
                            onPress={() => {
                              const next = Math.min(
                                Math.max(1, totalPages),
                                currentPage + 1,
                              );
                              setCurrentPage(next);
                              loadKeyStatus(next, pageSize);
                            }}
                          >
                            {t('下一页')}
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card.Content>
                </Card>
              </ModalBody>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>

      {/* 删除单个密钥 */}
      <ConfirmDialog
        visible={deleteKeyTarget !== null}
        title={t('确定要删除此密钥吗？')}
        cancelText={t('取消')}
        confirmText={t('确认')}
        danger
        onCancel={() => setDeleteKeyTarget(null)}
        onConfirm={async () => {
          const target = deleteKeyTarget;
          setDeleteKeyTarget(null);
          if (target !== null) await handleDeleteKey(target);
        }}
      >
        {t('此操作不可撤销，将永久删除该密钥')}
      </ConfirmDialog>

      {/* 启用全部 */}
      <ConfirmDialog
        visible={confirmEnableAll}
        title={t('确定要启用所有密钥吗？')}
        cancelText={t('取消')}
        confirmText={t('确认')}
        onCancel={() => setConfirmEnableAll(false)}
        onConfirm={async () => {
          setConfirmEnableAll(false);
          await handleEnableAll();
        }}
      >
        {t('启用全部')}
      </ConfirmDialog>

      {/* 禁用全部 */}
      <ConfirmDialog
        visible={confirmDisableAll}
        title={t('确定要禁用所有的密钥吗？')}
        cancelText={t('取消')}
        confirmText={t('确认')}
        danger
        onCancel={() => setConfirmDisableAll(false)}
        onConfirm={async () => {
          setConfirmDisableAll(false);
          await handleDisableAll();
        }}
      >
        {t('禁用全部')}
      </ConfirmDialog>

      {/* 删除自动禁用密钥 */}
      <ConfirmDialog
        visible={confirmDeleteDisabled}
        title={t('确定要删除所有已自动禁用的密钥吗？')}
        cancelText={t('取消')}
        confirmText={t('确认')}
        danger
        onCancel={() => setConfirmDeleteDisabled(false)}
        onConfirm={async () => {
          setConfirmDeleteDisabled(false);
          await handleDeleteDisabledKeys();
        }}
      >
        {t('此操作不可撤销，将永久删除已自动禁用的密钥')}
      </ConfirmDialog>
    </>
  );
};

export default MultiKeyManageModal;
