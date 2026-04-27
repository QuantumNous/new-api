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

import React, { useEffect, useRef, useState } from 'react';
import { Button, Tooltip } from '@heroui/react';
import { renderQuota } from '../../../helpers';
import { convertUSDToCurrency } from '../../../helpers/render';
import ConfirmDialog from '@/components/common/ui/ConfirmDialog';

const TONE_CLASSES = {
  white: 'border border-border bg-background text-foreground',
  violet:
    'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
  cyan: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300',
  green:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
};

function Chip({ tone = 'white', children, prefix }) {
  const cls = TONE_CLASSES[tone] || TONE_CLASSES.white;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {prefix}
      {children}
    </span>
  );
}

function Dot({ tone = 'green' }) {
  const color =
    tone === 'green'
      ? 'bg-emerald-500'
      : tone === 'red'
        ? 'bg-red-500'
        : 'bg-muted';
  return <span className={`h-1.5 w-1.5 rounded-full ${color}`} />;
}

function Muted({ children, className = '' }) {
  return (
    <span className={`text-xs text-muted ${className}`}>{children}</span>
  );
}

function Strong({ children, className = '', style }) {
  return (
    <span
      className={`text-sm font-semibold text-foreground ${className}`}
      style={style}
    >
      {children}
    </span>
  );
}

function HoverPanel({ children, content, position = 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const timer = useRef(null);

  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(true);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 100);
  };

  useEffect(() => () => timer.current && clearTimeout(timer.current), []);

  const placeClasses =
    position === 'right'
      ? 'left-full top-0 ml-2'
      : position === 'top'
        ? 'bottom-full left-1/2 -translate-x-1/2 mb-2'
        : 'top-full left-0 mt-2';

  return (
    <span
      ref={ref}
      className='relative inline-flex'
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}
      {open ? (
        <div
          role='tooltip'
          className={`absolute ${placeClasses} z-30 rounded-lg border border-border bg-background p-3 text-xs shadow-lg`}
        >
          {content}
        </div>
      ) : null}
    </span>
  );
}

function formatDuration(plan, t) {
  if (!plan) return '';
  const u = plan.duration_unit || 'month';
  if (u === 'custom') {
    return `${t('自定义')} ${plan.custom_seconds || 0}s`;
  }
  const unitMap = {
    year: t('年'),
    month: t('月'),
    day: t('日'),
    hour: t('小时'),
  };
  return `${plan.duration_value || 0}${unitMap[u] || u}`;
}

function formatResetPeriod(plan, t) {
  const period = plan?.quota_reset_period || 'never';
  if (period === 'daily') return t('每天');
  if (period === 'weekly') return t('每周');
  if (period === 'monthly') return t('每月');
  if (period === 'custom') {
    const seconds = Number(plan?.quota_reset_custom_seconds || 0);
    if (seconds >= 86400) return `${Math.floor(seconds / 86400)} ${t('天')}`;
    if (seconds >= 3600) return `${Math.floor(seconds / 3600)} ${t('小时')}`;
    if (seconds >= 60) return `${Math.floor(seconds / 60)} ${t('分钟')}`;
    return `${seconds} ${t('秒')}`;
  }
  return t('不重置');
}

const renderPlanTitle = (text, record, t) => {
  const subtitle = record?.plan?.subtitle;
  const plan = record?.plan;

  const popoverContent = (
    <div style={{ width: 260 }}>
      <Strong>{text}</Strong>
      {subtitle && (
        <div className='mt-1 text-xs text-muted'>{subtitle}</div>
      )}
      <div className='my-3 h-px bg-border' />
      <div className='grid grid-cols-2 gap-2 text-xs'>
        <Muted>{t('价格')}</Muted>
        <Strong className='text-emerald-600 dark:text-emerald-300'>
          {convertUSDToCurrency(Number(plan?.price_amount || 0), 2)}
        </Strong>
        <Muted>{t('总额度')}</Muted>
        {plan?.total_amount > 0 ? (
          <Tooltip
            content={`${t('原生额度')}：${plan.total_amount}`}
            placement='top'
          >
            <Strong>{renderQuota(plan.total_amount)}</Strong>
          </Tooltip>
        ) : (
          <Strong>{t('不限')}</Strong>
        )}
        <Muted>{t('升级分组')}</Muted>
        <Strong>
          {plan?.upgrade_group ? plan.upgrade_group : t('不升级')}
        </Strong>
        <Muted>{t('购买上限')}</Muted>
        <Strong>
          {plan?.max_purchase_per_user > 0
            ? plan.max_purchase_per_user
            : t('不限')}
        </Strong>
        <Muted>{t('有效期')}</Muted>
        <Strong>{formatDuration(plan, t)}</Strong>
        <Muted>{t('重置')}</Muted>
        <Strong>{formatResetPeriod(plan, t)}</Strong>
      </div>
    </div>
  );

  return (
    <HoverPanel content={popoverContent} position='right'>
      <div className='cursor-pointer max-w-[180px]'>
        <Strong className='block truncate'>{text}</Strong>
        {subtitle && (
          <span className='block truncate text-xs text-muted'>{subtitle}</span>
        )}
      </div>
    </HoverPanel>
  );
};

const renderPrice = (text) => (
  <Strong className='text-emerald-600 dark:text-emerald-300'>
    {convertUSDToCurrency(Number(text || 0), 2)}
  </Strong>
);

const renderPurchaseLimit = (text, record, t) => {
  const limit = Number(record?.plan?.max_purchase_per_user || 0);
  return (
    <span className={limit > 0 ? 'text-sm text-foreground' : 'text-xs text-muted'}>
      {limit > 0 ? limit : t('不限')}
    </span>
  );
};

const renderDuration = (text, record, t) => (
  <span className='text-sm text-foreground'>
    {formatDuration(record?.plan, t)}
  </span>
);

const renderEnabled = (text, record, t) =>
  text ? (
    <Chip tone='white' prefix={<Dot tone='green' />}>
      {t('启用')}
    </Chip>
  ) : (
    <Chip tone='white' prefix={<Dot tone='red' />}>
      {t('禁用')}
    </Chip>
  );

const renderTotalAmount = (text, record, t) => {
  const total = Number(record?.plan?.total_amount || 0);
  return (
    <span className={total > 0 ? 'text-sm text-foreground' : 'text-xs text-muted'}>
      {total > 0 ? (
        <Tooltip
          content={`${t('原生额度')}：${total}`}
          placement='top'
        >
          <span>{renderQuota(total)}</span>
        </Tooltip>
      ) : (
        t('不限')
      )}
    </span>
  );
};

const renderUpgradeGroup = (text, record, t) => {
  const group = record?.plan?.upgrade_group || '';
  return (
    <span className={group ? 'text-sm text-foreground' : 'text-xs text-muted'}>
      {group ? group : t('不升级')}
    </span>
  );
};

const renderResetPeriod = (text, record, t) => {
  const period = record?.plan?.quota_reset_period || 'never';
  const isNever = period === 'never';
  return (
    <span className={isNever ? 'text-xs text-muted' : 'text-sm text-foreground'}>
      {formatResetPeriod(record?.plan, t)}
    </span>
  );
};

const renderPaymentConfig = (text, record, t, enableEpay) => {
  const hasStripe = !!record?.plan?.stripe_price_id;
  const hasCreem = !!record?.plan?.creem_product_id;
  const hasEpay = !!enableEpay;

  return (
    <div className='flex flex-wrap items-center gap-1'>
      {hasStripe && <Chip tone='violet'>Stripe</Chip>}
      {hasCreem && <Chip tone='cyan'>Creem</Chip>}
      {hasEpay && <Chip tone='green'>{t('易支付')}</Chip>}
    </div>
  );
};

function OperationsCell({ record, openEdit, setPlanEnabled, t }) {
  const [confirm, setConfirm] = useState(null);
  const isEnabled = record?.plan?.enabled;

  const handleToggle = () => {
    if (isEnabled) {
      setConfirm({
        title: t('确认禁用'),
        content: t('禁用后用户端不再展示，但历史订单不受影响。是否继续？'),
        action: () => setPlanEnabled(record, false),
        danger: true,
      });
    } else {
      setConfirm({
        title: t('确认启用'),
        content: t('启用后套餐将在用户端展示。是否继续？'),
        action: () => setPlanEnabled(record, true),
        danger: false,
      });
    }
  };

  return (
    <div className='flex items-center gap-1.5'>
      <Button
        variant='tertiary'
        size='sm'
        onPress={() => openEdit(record)}
      >
        {t('编辑')}
      </Button>
      {isEnabled ? (
        <Button
          variant='danger-soft'
          size='sm'
          onPress={handleToggle}
        >
          {t('禁用')}
        </Button>
      ) : (
        <Button
          variant='tertiary'
          size='sm'
          onPress={handleToggle}
        >
          {t('启用')}
        </Button>
      )}

      <ConfirmDialog
        visible={!!confirm}
        title={confirm?.title || ''}
        cancelText={t('取消')}
        confirmText={t('确定')}
        danger={!!confirm?.danger}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const action = confirm?.action;
          setConfirm(null);
          action?.();
        }}
      >
        {confirm?.content}
      </ConfirmDialog>
    </div>
  );
}

const renderOperations = (text, record, { openEdit, setPlanEnabled, t }) => (
  <OperationsCell
    record={record}
    openEdit={openEdit}
    setPlanEnabled={setPlanEnabled}
    t={t}
  />
);

export const getSubscriptionsColumns = ({
  t,
  openEdit,
  setPlanEnabled,
  enableEpay,
}) => {
  return [
    {
      title: 'ID',
      dataIndex: ['plan', 'id'],
      width: 60,
      render: (text) => <Muted>#{text}</Muted>,
    },
    {
      title: t('套餐'),
      dataIndex: ['plan', 'title'],
      width: 200,
      render: (text, record) => renderPlanTitle(text, record, t),
    },
    {
      title: t('价格'),
      dataIndex: ['plan', 'price_amount'],
      width: 100,
      render: (text) => renderPrice(text),
    },
    {
      title: t('购买上限'),
      width: 90,
      render: (text, record) => renderPurchaseLimit(text, record, t),
    },
    {
      title: t('优先级'),
      dataIndex: ['plan', 'sort_order'],
      width: 80,
      render: (text) => <Muted>{Number(text || 0)}</Muted>,
    },
    {
      title: t('有效期'),
      width: 100,
      render: (text, record) => renderDuration(text, record, t),
    },
    {
      title: t('重置'),
      width: 80,
      render: (text, record) => renderResetPeriod(text, record, t),
    },
    {
      title: t('状态'),
      dataIndex: ['plan', 'enabled'],
      width: 80,
      render: (text, record) => renderEnabled(text, record, t),
    },
    {
      title: t('支付渠道'),
      width: 180,
      render: (text, record) =>
        renderPaymentConfig(text, record, t, enableEpay),
    },
    {
      title: t('总额度'),
      width: 100,
      render: (text, record) => renderTotalAmount(text, record, t),
    },
    {
      title: t('升级分组'),
      width: 100,
      render: (text, record) => renderUpgradeGroup(text, record, t),
    },
    {
      title: t('操作'),
      dataIndex: 'operate',
      fixed: 'right',
      width: 160,
      render: (text, record) =>
        renderOperations(text, record, { openEdit, setPlanEnabled, t }),
    },
  ];
};
