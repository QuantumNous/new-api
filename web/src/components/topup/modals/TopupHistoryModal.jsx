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
import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Button,
  Chip,
  Input,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalHeader,
  Pagination,
  Spinner,
  useOverlayState,
} from '@heroui/react';
import { Coins, Search } from 'lucide-react';
import { API, copy, showError, showSuccess, timestamp2string } from '../../../helpers';
import { isAdmin } from '../../../helpers/utils';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import ConfirmDialog from '../../common/ui/ConfirmDialog';

// 状态映射配置
const STATUS_CONFIG = {
  success: { type: 'success', key: '成功' },
  pending: { type: 'warning', key: '待支付' },
  failed: { type: 'danger', key: '失败' },
  expired: { type: 'danger', key: '已过期' },
};

// 支付方式映射
const PAYMENT_METHOD_MAP = {
  stripe: 'Stripe',
  creem: 'Creem',
  waffo: 'Waffo',
  alipay: '支付宝',
  wxpay: '微信',
};

const TopupHistoryModal = ({ visible, onCancel, t }) => {
  const [loading, setLoading] = useState(false);
  const [topups, setTopups] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [pendingTradeNo, setPendingTradeNo] = useState('');
  const isMobile = useIsMobile();
  const modalState = useOverlayState({
    isOpen: visible,
    onOpenChange: (isOpen) => {
      if (!isOpen) onCancel();
    },
  });

  const loadTopups = async (currentPage, currentPageSize) => {
    setLoading(true);
    try {
      const base = isAdmin() ? '/api/user/topup' : '/api/user/topup/self';
      const qs =
        `p=${currentPage}&page_size=${currentPageSize}` +
        (keyword ? `&keyword=${encodeURIComponent(keyword)}` : '');
      const endpoint = `${base}?${qs}`;
      const res = await API.get(endpoint);
      const { success, message, data } = res.data;
      if (success) {
        setTopups(data.items || []);
        setTotal(data.total || 0);
      } else {
        showError(message || t('加载失败'));
      }
    } catch (error) {
      showError(t('加载账单失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadTopups(page, pageSize);
    }
  }, [visible, page, pageSize, keyword]);

  const handlePageChange = (currentPage) => {
    setPage(currentPage);
  };

  const handlePageSizeChange = (currentPageSize) => {
    setPageSize(currentPageSize);
    setPage(1);
  };

  const handleKeywordChange = (value) => {
    setKeyword(value);
    setPage(1);
  };

  // 管理员补单
  const handleAdminComplete = async (tradeNo) => {
    try {
      const res = await API.post('/api/user/topup/complete', {
        trade_no: tradeNo,
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('补单成功'));
        await loadTopups(page, pageSize);
      } else {
        showError(message || t('补单失败'));
      }
    } catch (e) {
      showError(t('补单失败'));
    }
  };

  const confirmAdminComplete = (tradeNo) => {
    setPendingTradeNo(tradeNo);
  };

  // 渲染状态徽章
  const renderStatusBadge = (status) => {
    const config = STATUS_CONFIG[status] || { type: 'primary', key: status };
    const colorMap = {
      success: 'success',
      warning: 'warning',
      danger: 'danger',
      primary: 'primary',
    };
    return (
      <Chip color={colorMap[config.type] || 'default'} size='sm' variant='tertiary'>
        {t(config.key)}
      </Chip>
    );
  };

  // 渲染支付方式
  const renderPaymentMethod = (pm) => {
    const displayName = PAYMENT_METHOD_MAP[pm];
    return <span>{displayName ? t(displayName) : pm || '-'}</span>;
  };

  const isSubscriptionTopup = (record) => {
    const tradeNo = (record?.trade_no || '').toLowerCase();
    return Number(record?.amount || 0) === 0 && tradeNo.startsWith('sub');
  };

  // 检查是否为管理员
  const userIsAdmin = useMemo(() => isAdmin(), []);

  const columns = useMemo(() => {
    const baseColumns = [
      {
        title: t('订单号'),
        dataIndex: 'trade_no',
        key: 'trade_no',
        render: (text) => (
          <button
            type='button'
            onClick={async () => {
              if (await copy(text)) {
                showSuccess(t('已复制：') + text);
              } else {
                showError(t('无法复制到剪贴板，请手动复制'));
              }
            }}
            className='max-w-[180px] truncate font-mono text-xs text-sky-600 hover:text-sky-700 dark:text-sky-300'
          >
            {text}
          </button>
        ),
      },
      {
        title: t('支付方式'),
        dataIndex: 'payment_method',
        key: 'payment_method',
        render: renderPaymentMethod,
      },
      {
        title: t('充值额度'),
        dataIndex: 'amount',
        key: 'amount',
        render: (amount, record) => {
          if (isSubscriptionTopup(record)) {
            return (
              <Chip color='secondary' size='sm' variant='tertiary'>
                {t('订阅套餐')}
              </Chip>
            );
          }
          return (
            <span className='flex items-center gap-1'>
              <Coins size={16} />
              <span>{amount}</span>
            </span>
          );
        },
      },
      {
        title: t('支付金额'),
        dataIndex: 'money',
        key: 'money',
        render: (money) => (
          <span className='font-semibold text-danger'>¥{Number(money || 0).toFixed(2)}</span>
        ),
      },
      {
        title: t('状态'),
        dataIndex: 'status',
        key: 'status',
        render: renderStatusBadge,
      },
    ];

    // 管理员才显示操作列
    if (userIsAdmin) {
      baseColumns.push({
        title: t('操作'),
        key: 'action',
        render: (_, record) => {
          const actions = [];
          if (record.status === 'pending') {
            actions.push(
              <Button
                key="complete"
                size='sm'
                variant='tertiary'
                onPress={() => confirmAdminComplete(record.trade_no)}
              >
                {t('补单')}
              </Button>
            );
          }
          return actions.length > 0 ? <>{actions}</> : null;
        },
      });
    }

    baseColumns.push({
      title: t('创建时间'),
      dataIndex: 'create_time',
      key: 'create_time',
      render: (time) => timestamp2string(time),
    });

    return baseColumns;
  }, [t, userIsAdmin]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageSizeOptions = [10, 20, 50, 100].map((value) => ({
    value: String(value),
    label: String(value),
  }));

  const renderCell = (record, column) => {
    const value = record[column.dataIndex];
    return column.render ? column.render(value, record) : value;
  };

  return (
    <>
      <Modal state={modalState}>
        <ModalBackdrop variant='blur'>
          <ModalContainer size={isMobile ? 'full' : '5xl'} scroll='inside'>
            <ModalDialog className='bg-background/95 backdrop-blur'>
              <ModalHeader className='border-b border-border'>
                {t('充值账单')}
              </ModalHeader>
              <ModalBody className='p-4 md:p-6'>
                <div className='mb-4'>
                  <Input
                    startContent={<Search size={16} className='text-muted' />}
                    placeholder={t('订单号')}
                    value={keyword}
                    onValueChange={handleKeywordChange}
                    isClearable
                    size='sm'
                  />
                </div>

                {loading ? (
                  <div className='flex flex-col items-center justify-center gap-3 py-12 text-sm text-muted'>
                    <Spinner />
                    {t('加载中...')}
                  </div>
                ) : topups.length === 0 ? (
                  <div className='rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted'>
                    {t('暂无充值记录')}
                  </div>
                ) : isMobile ? (
                  <div className='space-y-3'>
                    {topups.map((record) => (
                      <div
                        key={record.id}
                        className='rounded-2xl border border-border bg-surface-secondary/60 p-4'
                      >
                        <div className='mb-3 flex items-start justify-between gap-3'>
                          {columns[0].render(record.trade_no, record)}
                          {renderStatusBadge(record.status)}
                        </div>
                        <div className='grid grid-cols-2 gap-3 text-sm'>
                          {columns.slice(1).map((column) => (
                            <div key={column.key}>
                              <div className='mb-1 text-xs text-muted'>
                                {column.title}
                              </div>
                              <div className='text-foreground'>
                                {renderCell(record, column) || '-'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className='overflow-x-auto rounded-2xl border border-border'>
                    <table className='min-w-full divide-y divide-border text-sm'>
                      <thead className='bg-surface-secondary text-xs uppercase tracking-wide text-muted'>
                        <tr>
                          {columns.map((column) => (
                            <th key={column.key} className='px-4 py-3 text-left font-semibold'>
                              {column.title}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className='divide-y divide-border'>
                        {topups.map((record) => (
                          <tr
                            key={record.id}
                            className='bg-background transition hover:bg-surface-secondary/60'
                          >
                            {columns.map((column) => (
                              <td key={column.key} className='px-4 py-3 text-foreground'>
                                {renderCell(record, column) || '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className='mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                  <select
                    aria-label={t('每页数量')}
                    value={String(pageSize)}
                    onChange={(event) =>
                      handlePageSizeChange(Number(event.target.value || 10))
                    }
                    className='h-9 w-32 rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary'
                  >
                    {pageSizeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <Pagination
                    showControls
                    page={page}
                    total={totalPages}
                    onChange={handlePageChange}
                    size='sm'
                  />
                </div>
              </ModalBody>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>

      <ConfirmDialog
        visible={!!pendingTradeNo}
        title={t('确认补单')}
        onCancel={() => setPendingTradeNo('')}
        onConfirm={async () => {
          const tradeNo = pendingTradeNo;
          setPendingTradeNo('');
          await handleAdminComplete(tradeNo);
        }}
        cancelText={t('取消')}
        confirmText={t('确定')}
      >
        {t('是否将该订单标记为成功并为用户入账？')}
      </ConfirmDialog>
    </>
  );
};

export default TopupHistoryModal;
