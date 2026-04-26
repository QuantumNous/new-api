/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affore General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@heroui/react';
import { Inbox, PlusCircle, X } from 'lucide-react';
import { API, showError, showSuccess } from '../../../../helpers';
import { convertUSDToCurrency } from '../../../../helpers/render';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import CardTable from '../../../common/ui/CardTable';
import ConfirmDialog from '@/components/common/ui/ConfirmDialog';

const PAGE_SIZE = 10;

const selectClass =
  'h-10 w-full rounded-lg border border-[color:var(--app-border)] bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary disabled:opacity-50';

function formatTs(ts) {
  if (!ts) return '-';
  return new Date(ts * 1000).toLocaleString();
}

function StatusChip({ tone, children }) {
  const cls =
    tone === 'green'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
      : 'bg-surface-secondary text-muted';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {children}
    </span>
  );
}

function renderStatusTag(sub, t) {
  const now = Date.now() / 1000;
  const end = sub?.end_time || 0;
  const status = sub?.status || '';

  const isExpiredByTime = end > 0 && end < now;
  const isActive = status === 'active' && !isExpiredByTime;
  if (isActive) return <StatusChip tone='green'>{t('生效')}</StatusChip>;
  if (status === 'cancelled') return <StatusChip>{t('已作废')}</StatusChip>;
  return <StatusChip>{t('已过期')}</StatusChip>;
}

const UserSubscriptionsModal = ({
  visible,
  onCancel,
  user,
  t,
  onSuccess,
}) => {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [plansLoading, setPlansLoading] = useState(false);

  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');

  const [subs, setSubs] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pendingConfirm, setPendingConfirm] = useState(null);

  const planTitleMap = useMemo(() => {
    const map = new Map();
    (plans || []).forEach((p) => {
      const id = p?.plan?.id;
      const title = p?.plan?.title;
      if (id) map.set(id, title || `#${id}`);
    });
    return map;
  }, [plans]);

  const pagedSubs = useMemo(() => {
    const start = Math.max(0, (Number(currentPage || 1) - 1) * PAGE_SIZE);
    const end = start + PAGE_SIZE;
    return (subs || []).slice(start, end);
  }, [subs, currentPage]);

  const planOptions = useMemo(() => {
    return (plans || []).map((p) => ({
      label: `${p?.plan?.title || ''} (${convertUSDToCurrency(
        Number(p?.plan?.price_amount || 0),
        2,
      )})`,
      value: String(p?.plan?.id ?? ''),
    }));
  }, [plans]);

  const loadPlans = async () => {
    setPlansLoading(true);
    try {
      const res = await API.get('/api/subscription/admin/plans');
      if (res.data?.success) {
        setPlans(res.data.data || []);
      } else {
        showError(res.data?.message || t('加载失败'));
      }
    } catch (e) {
      showError(t('请求失败'));
    } finally {
      setPlansLoading(false);
    }
  };

  const loadUserSubscriptions = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await API.get(
        `/api/subscription/admin/users/${user.id}/subscriptions`,
      );
      if (res.data?.success) {
        const next = res.data.data || [];
        setSubs(next);
        setCurrentPage(1);
      } else {
        showError(res.data?.message || t('加载失败'));
      }
    } catch (e) {
      showError(t('请求失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!visible) return;
    setSelectedPlanId('');
    setCurrentPage(1);
    loadPlans();
    loadUserSubscriptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (event) => {
      if (event.key === 'Escape') onCancel?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, onCancel]);

  const createSubscription = async () => {
    if (!user?.id) {
      showError(t('用户信息缺失'));
      return;
    }
    if (!selectedPlanId) {
      showError(t('请选择订阅套餐'));
      return;
    }
    setCreating(true);
    try {
      const res = await API.post(
        `/api/subscription/admin/users/${user.id}/subscriptions`,
        { plan_id: Number(selectedPlanId) },
      );
      if (res.data?.success) {
        const msg = res.data?.data?.message;
        showSuccess(msg ? msg : t('新增成功'));
        setSelectedPlanId('');
        await loadUserSubscriptions();
        onSuccess?.();
      } else {
        showError(res.data?.message || t('新增失败'));
      }
    } catch (e) {
      showError(t('请求失败'));
    } finally {
      setCreating(false);
    }
  };

  const performInvalidate = async (subId) => {
    try {
      const res = await API.post(
        `/api/subscription/admin/user_subscriptions/${subId}/invalidate`,
      );
      if (res.data?.success) {
        const msg = res.data?.data?.message;
        showSuccess(msg ? msg : t('已作废'));
        await loadUserSubscriptions();
        onSuccess?.();
      } else {
        showError(res.data?.message || t('操作失败'));
      }
    } catch (e) {
      showError(t('请求失败'));
    }
  };

  const performDelete = async (subId) => {
    try {
      const res = await API.delete(
        `/api/subscription/admin/user_subscriptions/${subId}`,
      );
      if (res.data?.success) {
        const msg = res.data?.data?.message;
        showSuccess(msg ? msg : t('已删除'));
        await loadUserSubscriptions();
        onSuccess?.();
      } else {
        showError(res.data?.message || t('删除失败'));
      }
    } catch (e) {
      showError(t('请求失败'));
    }
  };

  const columns = useMemo(() => {
    return [
      {
        title: 'ID',
        dataIndex: ['subscription', 'id'],
        key: 'id',
        width: 70,
      },
      {
        title: t('套餐'),
        key: 'plan',
        width: 180,
        render: (_, record) => {
          const sub = record?.subscription;
          const planId = sub?.plan_id;
          const title =
            planTitleMap.get(planId) || (planId ? `#${planId}` : '-');
          return (
            <div className='min-w-0'>
              <div className='truncate text-sm font-medium text-foreground'>
                {title}
              </div>
              <div className='text-xs text-muted'>
                {t('来源')}: {sub?.source || '-'}
              </div>
            </div>
          );
        },
      },
      {
        title: t('状态'),
        key: 'status',
        width: 90,
        render: (_, record) => renderStatusTag(record?.subscription, t),
      },
      {
        title: t('有效期'),
        key: 'validity',
        width: 200,
        render: (_, record) => {
          const sub = record?.subscription;
          return (
            <div className='space-y-0.5 text-xs text-muted'>
              <div>
                {t('开始')}: {formatTs(sub?.start_time)}
              </div>
              <div>
                {t('结束')}: {formatTs(sub?.end_time)}
              </div>
            </div>
          );
        },
      },
      {
        title: t('总额度'),
        key: 'total',
        width: 120,
        render: (_, record) => {
          const sub = record?.subscription;
          const total = Number(sub?.amount_total || 0);
          const used = Number(sub?.amount_used || 0);
          return (
            <span
              className={
                total > 0 ? 'text-sm text-foreground' : 'text-xs text-muted'
              }
            >
              {total > 0 ? `${used}/${total}` : t('不限')}
            </span>
          );
        },
      },
      {
        title: '',
        key: 'operate',
        width: 140,
        fixed: 'right',
        render: (_, record) => {
          const sub = record?.subscription;
          const now = Date.now() / 1000;
          const isExpired =
            (sub?.end_time || 0) > 0 && (sub?.end_time || 0) < now;
          const isActive = sub?.status === 'active' && !isExpired;
          const isCancelled = sub?.status === 'cancelled';
          return (
            <div className='flex flex-wrap items-center gap-1.5'>
              <Button
                size='sm'
                color='warning'
                variant='flat'
                isDisabled={!isActive || isCancelled}
                onPress={() =>
                  setPendingConfirm({
                    title: t('确认作废'),
                    content: t(
                      '作废后该订阅将立即失效，历史记录不受影响。是否继续？',
                    ),
                    danger: false,
                    action: () => performInvalidate(sub?.id),
                  })
                }
              >
                {t('作废')}
              </Button>
              <Button
                size='sm'
                color='danger'
                variant='flat'
                onPress={() =>
                  setPendingConfirm({
                    title: t('确认删除'),
                    content: t(
                      '删除会彻底移除该订阅记录（含权益明细）。是否继续？',
                    ),
                    danger: true,
                    action: () => performDelete(sub?.id),
                  })
                }
              >
                {t('删除')}
              </Button>
            </div>
          );
        },
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, planTitleMap]);

  return (
    <>
      <div
        aria-hidden={!visible}
        onClick={onCancel}
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
          visible ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <aside
        role='dialog'
        aria-modal='true'
        aria-hidden={!visible}
        style={{ width: isMobile ? '100%' : 920 }}
        className={`fixed bottom-0 right-0 top-0 z-50 flex flex-col bg-background shadow-2xl transition-transform duration-300 ease-out ${
          visible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className='flex items-center justify-between gap-3 border-b border-[color:var(--app-border)] px-5 py-3'>
          <div className='flex flex-wrap items-center gap-2'>
            <span className='inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'>
              {t('管理')}
            </span>
            <h4 className='m-0 text-lg font-semibold text-foreground'>
              {t('用户订阅管理')}
            </h4>
            <span className='text-sm text-muted'>
              {user?.username || '-'} (ID: {user?.id || '-'})
            </span>
          </div>
          <Button
            isIconOnly
            variant='light'
            size='sm'
            aria-label={t('关闭')}
            onPress={onCancel}
          >
            <X size={16} />
          </Button>
        </header>

        <div className='flex-1 overflow-y-auto p-4'>
          <div className='mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
            <div className='flex flex-1 gap-2'>
              <select
                value={selectedPlanId}
                onChange={(event) => setSelectedPlanId(event.target.value)}
                disabled={plansLoading}
                aria-label={t('选择订阅套餐')}
                className={selectClass}
                style={{ minWidth: isMobile ? undefined : 300, flex: 1 }}
              >
                <option value=''>
                  {plansLoading ? t('加载中...') : t('选择订阅套餐')}
                </option>
                {planOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <Button
                color='primary'
                startContent={<PlusCircle size={14} />}
                isPending={creating}
                onPress={createSubscription}
              >
                {t('新增订阅')}
              </Button>
            </div>
          </div>

          <CardTable
            columns={columns}
            dataSource={pagedSubs}
            rowKey={(row) => row?.subscription?.id}
            loading={loading}
            scroll={{ x: 'max-content' }}
            hidePagination={false}
            pagination={{
              currentPage,
              pageSize: PAGE_SIZE,
              total: subs.length,
              pageSizeOpts: [10, 20, 50],
              showSizeChanger: false,
              onPageChange: setCurrentPage,
            }}
            empty={
              <div className='flex flex-col items-center gap-3 py-10 text-center text-sm text-muted'>
                <div className='flex h-16 w-16 items-center justify-center rounded-full bg-surface-secondary text-muted'>
                  <Inbox size={28} />
                </div>
                <div>{t('暂无订阅记录')}</div>
              </div>
            }
            size='middle'
          />
        </div>
      </aside>

      <ConfirmDialog
        visible={!!pendingConfirm}
        title={pendingConfirm?.title || ''}
        cancelText={t('取消')}
        confirmText={t('确认')}
        danger={!!pendingConfirm?.danger}
        onCancel={() => setPendingConfirm(null)}
        onConfirm={() => {
          const action = pendingConfirm?.action;
          setPendingConfirm(null);
          action?.();
        }}
      >
        {pendingConfirm?.content}
      </ConfirmDialog>
    </>
  );
};

export default UserSubscriptionsModal;
