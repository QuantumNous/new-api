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

// /console/user column defs — mirrors the structure of TokensColumnDefs so
// the two pages share the same visual + interaction grammar:
//
//   • shared `HoverPanel` (= HeroUI Tooltip wrapper) for on-hover quota
//     breakdowns, instead of a private hand-rolled tooltip with manual
//     show/hide timers.
//   • shared `ClickMenu` for the row "more" overflow menu, instead of a
//     duplicated local copy with its own click-outside listener.
//   • HeroUI `Meter` for quota progress (semantic value-in-range with
//     warning/danger thresholds), instead of a hand-rolled `<div>` bar.
//   • HeroUI `Tooltip` + `Button` for inline interactions.
//
// The local `Chip` wrapper is intentionally kept (mirrors the same pattern
// in TokensColumnDefs) — it maps semantic tone names (green/red/yellow/...)
// onto Tailwind utility classes that pull from the design tokens, which is
// strictly richer than HeroUI `<Chip>`'s 6-color palette.

import React from 'react';
import { Button, Meter, Tooltip } from '@heroui/react';
import { MoreHorizontal } from 'lucide-react';
import HoverPanel from '@/components/common/ui/HoverPanel';
import ClickMenu from '@/components/common/ui/ClickMenu';
import { renderGroup, renderNumber, renderQuota } from '../../../helpers';
import { warningGhostButtonClass } from '../../common/ui/buttonTones';

const TONE_CLASSES = {
  blue: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  yellow:
    'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  orange:
    'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  green:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  grey: 'bg-surface-secondary text-muted',
  white:
    'border border-border bg-background text-foreground',
};

function Chip({ tone = 'white', children, className = '' }) {
  const cls = TONE_CLASSES[tone] || TONE_CLASSES.white;
  // `whitespace-nowrap shrink-0` matches the tokens-table chip so short
  // CJK labels (普通用户 / 已启用 / 已禁用 / ...) stay on one line even
  // inside narrow cells.
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${cls} ${className}`}
    >
      {children}
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
    return <span className='whitespace-nowrap'>{text}</span>;
  }
  const maxLen = 10;
  const displayRemark =
    remark.length > maxLen ? remark.slice(0, maxLen) + '…' : remark;
  return (
    // `inline-flex whitespace-nowrap` so the username + remark chip stays on
    // a single line and the row keeps its compact rhythm. Without it the
    // remark chip would wrap below the username on narrow viewports.
    <div className='inline-flex items-center gap-1.5 whitespace-nowrap'>
      <span>{text}</span>
      <Tooltip content={remark} placement='top'>
        <span className='inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-xs text-foreground'>
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

const renderStatistics = (text, record, t) => {
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

  // Shared HoverPanel wraps a HeroUI Tooltip — the popup auto-dismisses
  // when the cursor leaves the trigger, so click-targets inside cannot be
  // reached. CopyableLine still renders a clickable copy button, but
  // mirrors the tokens table's plain key/value treatment for parity.
  const StatRow = ({ label, value }) => (
    <div className='flex items-center justify-between gap-3'>
      <span className='text-muted'>{label}</span>
      <span className='tabular-nums text-foreground'>{value}</span>
    </div>
  );

  const popoverContent = (
    <div className='space-y-1'>
      <StatRow label={t('已用额度')} value={renderQuota(used)} />
      <StatRow
        label={t('剩余额度')}
        value={`${renderQuota(remain)} (${percent.toFixed(0)}%)`}
      />
      <StatRow label={t('总额度')} value={renderQuota(total)} />
    </div>
  );

  // Same Meter color thresholds as TokensColumnDefs: ≤10% danger,
  // ≤30% warning, otherwise success. Keeping the two pages aligned so
  // a 5%-remaining user reads visually the same as a 5%-remaining token.
  const meterColor =
    percent <= 10 ? 'danger' : percent <= 30 ? 'warning' : 'success';

  return (
    <HoverPanel content={popoverContent} placement='top'>
      <Meter
        aria-label={t('额度使用')}
        value={remain}
        maxValue={Math.max(total, 1)}
        color={meterColor}
        size='sm'
        className='!flex w-32 cursor-help flex-col items-stretch gap-1'
      >
        <Meter.Output className='!text-xs !font-normal text-foreground text-center leading-none tabular-nums'>
          {`${renderQuota(remain)} / ${renderQuota(total)}`}
        </Meter.Output>
        <Meter.Track>
          <Meter.Fill />
        </Meter.Track>
      </Meter>
    </HoverPanel>
  );
};

const renderInviteInfo = (text, record, t) => (
  // `inline-flex whitespace-nowrap` keeps the three meta chips on one line.
  // The cell already inherits `whitespace-nowrap` from HeroTable, so the
  // table grows horizontally (and the `Table.ScrollContainer` provides a
  // scrollbar) instead of inflating the row height to ~3 lines on narrow
  // viewports. Each Chip carries `shrink-0` so they don't squeeze either.
  <div className='inline-flex items-center gap-1 whitespace-nowrap'>
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

  // Inline + nowrap so the 5 row controls stay on a single line and the
  // surrounding `Table.ScrollContainer` provides horizontal scroll if the
  // viewport can't fit them. `!h-7 !px-2.5 !text-[11px]` mirrors the
  // tokens table's compact action chips so /console/user and /console/token
  // share the same row rhythm. Without this the buttons used the default
  // sm size (32px / 14px text) and wrapped to 2-3 rows on narrow viewports,
  // blowing up row heights to ~120px.
  const compactBtn = '!h-7 !px-2.5 !text-[11px]';
  const compactIconBtn =
    '!h-7 !w-7 !min-w-7 !px-0 [&_svg]:!size-3.5';

  return (
    <div className='inline-flex items-center gap-1.5 whitespace-nowrap'>
      {record.status === 1 ? (
        <Button
          variant='danger-soft'
          size='sm'
          className={compactBtn}
          onPress={() => showEnableDisableModal(record, 'disable')}
        >
          {t('禁用')}
        </Button>
      ) : (
        <Button
          variant='tertiary'
          size='sm'
          className={compactBtn}
          onPress={() => showEnableDisableModal(record, 'enable')}
        >
          {t('启用')}
        </Button>
      )}
      <Button
        variant='tertiary'
        size='sm'
        className={compactBtn}
        onPress={() => {
          setEditingUser(record);
          setShowEditUser(true);
        }}
      >
        {t('编辑')}
      </Button>
      <Button
        variant='tertiary'
        size='sm'
        className={`${compactBtn} ${warningGhostButtonClass}`}
        onPress={() => showPromoteModal(record)}
      >
        {t('提升')}
      </Button>
      <Button
        variant='tertiary'
        size='sm'
        className={compactBtn}
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
            className={compactIconBtn}
            aria-label={t('更多操作')}
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
      render: (text, record) => renderStatistics(text, record, t),
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
