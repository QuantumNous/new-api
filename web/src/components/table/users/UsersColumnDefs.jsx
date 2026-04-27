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
import { Copy, MoreHorizontal } from 'lucide-react';
import { renderGroup, renderNumber, renderQuota, copy, showSuccess } from '../../../helpers';

const TONE_CLASSES = {
  blue:
    'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  yellow:
    'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  orange:
    'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
  red:
    'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  green:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  grey: 'bg-surface-secondary text-muted',
  white:
    'border border-border bg-background text-foreground',
};

function Chip({ tone = 'white', children, className = '' }) {
  const cls = TONE_CLASSES[tone] || TONE_CLASSES.white;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls} ${className}`}
    >
      {children}
    </span>
  );
}

function CopyableLine({ value, children }) {
  const handleCopy = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (await copy(value)) {
      showSuccess('已复制');
    }
  };
  return (
    <div className='group flex items-center gap-1.5'>
      <span className='min-w-0 truncate'>{children}</span>
      <button
        type='button'
        onClick={handleCopy}
        aria-label='copy'
        className='inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted opacity-0 transition group-hover:opacity-100 hover:bg-surface-secondary hover:text-foreground'
      >
        <Copy size={11} />
      </button>
    </div>
  );
}

function HoverPanel({ children, content, position = 'top' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const timer = useRef(null);

  const show = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setOpen(true);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 100);
  };

  useEffect(() => () => timer.current && clearTimeout(timer.current), []);

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
          className={`absolute left-1/2 -translate-x-1/2 z-30 min-w-[10rem] rounded-lg border border-border bg-background p-2 text-xs shadow-lg ${
            position === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          }`}
        >
          {content}
        </div>
      ) : null}
    </span>
  );
}

function ProgressBar({ percent }) {
  const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
  return (
    <div className='h-1 w-full overflow-hidden rounded-full bg-surface-secondary'>
      <div
        className='h-full rounded-full bg-emerald-500 transition-all'
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function ClickMenu({ items, trigger }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <span ref={ref} className='relative inline-flex'>
      <span onClick={() => setOpen((prev) => !prev)}>{trigger}</span>
      {open ? (
        <div
          role='menu'
          className='absolute right-0 top-full z-30 mt-1 min-w-[10rem] overflow-hidden rounded-lg border border-border bg-background shadow-lg'
        >
          {items.map((item, idx) => {
            if (item.divider) {
              return (
                <div
                  key={`divider-${idx}`}
                  className='my-1 h-px bg-border'
                />
              );
            }
            return (
              <button
                key={`item-${idx}`}
                type='button'
                role='menuitem'
                className={`flex w-full items-center px-3 py-2 text-left text-sm transition ${
                  item.danger
                    ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40'
                    : 'text-foreground hover:bg-surface-secondary'
                }`}
                onClick={() => {
                  setOpen(false);
                  item.onClick?.();
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </span>
  );
}

const renderRole = (role, t) => {
  switch (role) {
    case 1:
      return <Chip tone='blue'>{t('普通用户')}</Chip>;
    case 10:
      return <Chip tone='yellow'>{t('管理员')}</Chip>;
    case 100:
      return <Chip tone='orange'>{t('超级管理员')}</Chip>;
    default:
      return <Chip tone='red'>{t('未知身份')}</Chip>;
  }
};

const renderUsername = (text, record) => {
  const remark = record.remark;
  if (!remark) {
    return <span>{text}</span>;
  }
  const maxLen = 10;
  const displayRemark =
    remark.length > maxLen ? remark.slice(0, maxLen) + '…' : remark;
  return (
    <div className='flex items-center gap-1.5'>
      <span>{text}</span>
      <Tooltip content={remark} placement='top'>
        <span className='inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-xs text-foreground'>
          <span
            className='h-2 w-2 shrink-0 rounded-full'
            style={{ backgroundColor: '#10b981' }}
          />
          {displayRemark}
        </span>
      </Tooltip>
    </div>
  );
};

const renderStatistics = (text, record, showEnableDisableModal, t) => {
  const isDeleted = record.DeletedAt !== null;

  let tone = 'grey';
  let tagText = t('未知状态');
  if (isDeleted) {
    tone = 'red';
    tagText = t('已注销');
  } else if (record.status === 1) {
    tone = 'green';
    tagText = t('已启用');
  } else if (record.status === 2) {
    tone = 'red';
    tagText = t('已禁用');
  }

  return (
    <Tooltip
      content={
        <div className='text-xs'>
          {t('调用次数')}: {renderNumber(record.request_count)}
        </div>
      }
      placement='top'
    >
      <span>
        <Chip tone={tone}>{tagText}</Chip>
      </span>
    </Tooltip>
  );
};

const renderQuotaUsage = (text, record, t) => {
  const used = parseInt(record.used_quota) || 0;
  const remain = parseInt(record.quota) || 0;
  const total = used + remain;
  const percent = total > 0 ? (remain / total) * 100 : 0;

  const popoverContent = (
    <div className='space-y-1'>
      <CopyableLine value={renderQuota(used)}>
        {t('已用额度')}: {renderQuota(used)}
      </CopyableLine>
      <CopyableLine value={renderQuota(remain)}>
        {t('剩余额度')}: {renderQuota(remain)} ({percent.toFixed(0)}%)
      </CopyableLine>
      <CopyableLine value={renderQuota(total)}>
        {t('总额度')}: {renderQuota(total)}
      </CopyableLine>
    </div>
  );

  return (
    <HoverPanel content={popoverContent} position='top'>
      <span className='inline-flex flex-col items-stretch gap-1 rounded-full border border-border bg-background px-2 py-1 text-xs text-foreground'>
        <span className='leading-none tabular-nums'>{`${renderQuota(remain)} / ${renderQuota(total)}`}</span>
        <ProgressBar percent={percent} />
      </span>
    </HoverPanel>
  );
};

const renderInviteInfo = (text, record, t) => (
  <div className='flex flex-wrap items-center gap-1'>
    <Chip tone='white'>
      {t('邀请')}: {renderNumber(record.aff_count)}
    </Chip>
    <Chip tone='white'>
      {t('收益')}: {renderQuota(record.aff_history_quota)}
    </Chip>
    <Chip tone='white'>
      {record.inviter_id === 0
        ? t('无邀请人')
        : `${t('邀请人')}: ${record.inviter_id}`}
    </Chip>
  </div>
);

const renderOperations = (
  text,
  record,
  {
    setEditingUser,
    setShowEditUser,
    showPromoteModal,
    showDemoteModal,
    showEnableDisableModal,
    showDeleteModal,
    showResetPasskeyModal,
    showResetTwoFAModal,
    showUserSubscriptionsModal,
    t,
  },
) => {
  if (record.DeletedAt !== null) {
    return null;
  }

  const moreItems = [
    {
      label: t('订阅管理'),
      onClick: () => showUserSubscriptionsModal(record),
    },
    { divider: true },
    {
      label: t('重置 Passkey'),
      onClick: () => showResetPasskeyModal(record),
    },
    {
      label: t('重置 2FA'),
      onClick: () => showResetTwoFAModal(record),
    },
    { divider: true },
    {
      label: t('注销'),
      danger: true,
      onClick: () => showDeleteModal(record),
    },
  ];

  return (
    <div className='flex flex-wrap items-center gap-1.5'>
      {record.status === 1 ? (
        <Button
          color='danger'
          size='sm'
          variant='tertiary'
          onPress={() => showEnableDisableModal(record, 'disable')}
        >
          {t('禁用')}
        </Button>
      ) : (
        <Button
          size='sm'
          variant='tertiary'
          onPress={() => showEnableDisableModal(record, 'enable')}
        >
          {t('启用')}
        </Button>
      )}
      <Button
        variant='tertiary'
        size='sm'
        onPress={() => {
          setEditingUser(record);
          setShowEditUser(true);
        }}
      >
        {t('编辑')}
      </Button>
      <Button
        color='warning'
        variant='tertiary'
        size='sm'
        onPress={() => showPromoteModal(record)}
      >
        {t('提升')}
      </Button>
      <Button
        variant='tertiary'
        size='sm'
        onPress={() => showDemoteModal(record)}
      >
        {t('降级')}
      </Button>
      <ClickMenu
        items={moreItems}
        trigger={
          <Button
            isIconOnly
            variant='tertiary'
            size='sm'
            aria-label='more'
          >
            <MoreHorizontal size={14} />
          </Button>
        }
      />
    </div>
  );
};

export const getUsersColumns = ({
  t,
  setEditingUser,
  setShowEditUser,
  showPromoteModal,
  showDemoteModal,
  showEnableDisableModal,
  showDeleteModal,
  showResetPasskeyModal,
  showResetTwoFAModal,
  showUserSubscriptionsModal,
}) => {
  return [
    {
      title: 'ID',
      dataIndex: 'id',
    },
    {
      title: t('用户名'),
      dataIndex: 'username',
      render: (text, record) => renderUsername(text, record),
    },
    {
      title: t('状态'),
      dataIndex: 'info',
      render: (text, record) =>
        renderStatistics(text, record, showEnableDisableModal, t),
    },
    {
      title: t('剩余额度/总额度'),
      key: 'quota_usage',
      render: (text, record) => renderQuotaUsage(text, record, t),
    },
    {
      title: t('分组'),
      dataIndex: 'group',
      render: (text) => <div>{renderGroup(text)}</div>,
    },
    {
      title: t('角色'),
      dataIndex: 'role',
      render: (text) => <div>{renderRole(text, t)}</div>,
    },
    {
      title: t('邀请信息'),
      dataIndex: 'invite',
      render: (text, record) => renderInviteInfo(text, record, t),
    },
    {
      title: '',
      dataIndex: 'operate',
      fixed: 'right',
      width: 200,
      render: (text, record) =>
        renderOperations(text, record, {
          setEditingUser,
          setShowEditUser,
          showPromoteModal,
          showDemoteModal,
          showEnableDisableModal,
          showDeleteModal,
          showResetPasskeyModal,
          showResetTwoFAModal,
          showUserSubscriptionsModal,
          t,
        }),
    },
  ];
};
