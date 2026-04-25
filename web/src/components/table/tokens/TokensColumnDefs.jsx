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

import React, { useState } from 'react';
import { Button, Tooltip } from '@heroui/react';
import { ChevronDown, Copy as CopyIcon, Eye, EyeOff } from 'lucide-react';
import HoverPanel from '@/components/common/ui/HoverPanel';
import ClickMenu from '@/components/common/ui/ClickMenu';
import ConfirmDialog from '@/components/common/ui/ConfirmDialog';
import {
  copy,
  getModelCategories,
  renderGroup,
  renderQuota,
  showError,
  showSuccess,
  timestamp2string,
} from '../../../helpers';

// ---------- Tailwind primitives ----------
const TONE_CLASSES = {
  blue: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  green:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  yellow:
    'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  grey: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  black: 'bg-slate-700 text-slate-100 dark:bg-slate-700 dark:text-slate-100',
  white:
    'border border-[color:var(--app-border)] bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-200',
};

function Chip({ tone = 'white', className = '', children }) {
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
        className='inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted opacity-0 transition group-hover:opacity-100 hover:bg-[color:var(--app-background)] hover:text-foreground'
      >
        <CopyIcon size={11} />
      </button>
    </div>
  );
}

function ProgressBar({ percent }) {
  const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
  let barClass = 'bg-emerald-500';
  if (clamped === 100) barClass = 'bg-emerald-500';
  else if (clamped <= 10) barClass = 'bg-red-500';
  else if (clamped <= 30) barClass = 'bg-amber-500';
  return (
    <div className='h-1 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800'>
      <div
        className={`h-full rounded-full ${barClass} transition-all`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

// Vendor avatar pill — replaces HeroCompat Avatar size='extra-extra-small'
function VendorAvatar({ children, label }) {
  return (
    <span
      aria-label={label}
      className='inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border border-[color:var(--app-border)] bg-white text-[10px] font-semibold text-foreground dark:bg-slate-900'
    >
      {children}
    </span>
  );
}

// Render functions
function renderTimestamp(timestamp) {
  return <>{timestamp2string(timestamp)}</>;
}

const renderStatus = (text, record, t) => {
  const enabled = text === 1;

  let tone = 'black';
  let label = t('未知状态');
  if (enabled) {
    tone = 'green';
    label = t('已启用');
  } else if (text === 2) {
    tone = 'red';
    label = t('已禁用');
  } else if (text === 3) {
    tone = 'yellow';
    label = t('已过期');
  } else if (text === 4) {
    tone = 'grey';
    label = t('已耗尽');
  }

  return <Chip tone={tone}>{label}</Chip>;
};

const renderGroupColumn = (text, record, t, groupRatios = {}) => {
  if (text === 'auto') {
    return (
      <Tooltip
        content={t(
          '当前分组为 auto，会自动选择最优分组，当一个组不可用时自动降级到下一个组（熔断机制）',
        )}
        placement='top'
      >
        <span>
          <Chip tone='white'>
            {t('智能熔断')}
            {record && record.cross_group_retry ? `(${t('跨分组')})` : ''}
          </Chip>
        </span>
      </Tooltip>
    );
  }
  const ratio = groupRatios[text];
  return (
    <span className='flex items-center gap-1'>
      {renderGroup(text)}
      {ratio !== undefined && <Chip tone='green'>{ratio}x</Chip>}
    </span>
  );
};

// ---------- Token key cell with show/hide + copy menu ----------
function TokenKeyCell({
  record,
  showKeys,
  resolvedTokenKeys,
  loadingTokenKeys,
  toggleTokenVisibility,
  copyTokenKey,
  copyTokenConnectionString,
  t,
}) {
  const revealed = !!showKeys[record.id];
  const loading = !!loadingTokenKeys[record.id];
  const keyValue =
    revealed && resolvedTokenKeys[record.id]
      ? resolvedTokenKeys[record.id]
      : record.key || '';
  const displayedKey = keyValue ? `sk-${keyValue}` : '';

  return (
    <div className='w-[200px]'>
      <div className='flex h-8 items-center gap-1 overflow-hidden rounded-lg border border-[color:var(--app-border)] bg-background pl-2 text-xs'>
        <input
          readOnly
          value={displayedKey}
          aria-label={t('密钥')}
          className='h-full min-w-0 flex-1 bg-transparent text-foreground outline-none'
        />
        <Button
          isIconOnly
          variant='light'
          size='sm'
          aria-label='toggle token visibility'
          isPending={loading}
          onPress={async () => {
            await toggleTokenVisibility(record);
          }}
        >
          {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
        </Button>
        <ClickMenu
          placement='bottomRight'
          items={[
            {
              label: t('复制密钥'),
              onClick: () => copyTokenKey(record),
            },
            {
              label: t('复制连接信息'),
              onClick: () => copyTokenConnectionString(record),
            },
          ]}
          trigger={
            <Button
              isIconOnly
              variant='light'
              size='sm'
              aria-label='copy token key'
              isPending={loading}
            >
              <CopyIcon size={14} />
            </Button>
          }
        />
      </div>
    </div>
  );
}

const renderModelLimits = (text, record, t) => {
  if (record.model_limits_enabled && text) {
    const models = text.split(',').filter(Boolean);
    const categories = getModelCategories(t);

    const vendorAvatars = [];
    const matchedModels = new Set();
    Object.entries(categories).forEach(([key, category]) => {
      if (key === 'all') return;
      if (!category.icon || !category.filter) return;
      const vendorModels = models.filter((m) =>
        category.filter({ model_name: m }),
      );
      if (vendorModels.length > 0) {
        vendorAvatars.push(
          <Tooltip
            key={key}
            content={vendorModels.join(', ')}
            placement='top'
            showArrow
          >
            <span>
              <VendorAvatar label={category.label}>
                {category.icon}
              </VendorAvatar>
            </span>
          </Tooltip>,
        );
        vendorModels.forEach((m) => matchedModels.add(m));
      }
    });

    const unmatchedModels = models.filter((m) => !matchedModels.has(m));
    if (unmatchedModels.length > 0) {
      vendorAvatars.push(
        <Tooltip
          key='unknown'
          content={unmatchedModels.join(', ')}
          placement='top'
          showArrow
        >
          <span>
            <VendorAvatar label='unknown'>{t('其他')}</VendorAvatar>
          </span>
        </Tooltip>,
      );
    }

    return (
      <div className='flex flex-wrap items-center gap-1'>{vendorAvatars}</div>
    );
  }
  return <Chip tone='white'>{t('无限制')}</Chip>;
};

const renderAllowIps = (text, t) => {
  if (!text || text.trim() === '') {
    return <Chip tone='white'>{t('无限制')}</Chip>;
  }

  const ips = text
    .split('\n')
    .map((ip) => ip.trim())
    .filter(Boolean);

  const displayIps = ips.slice(0, 1);
  const extraCount = ips.length - displayIps.length;

  return (
    <div className='flex flex-wrap items-center gap-1'>
      {displayIps.map((ip, idx) => (
        <Chip key={idx} tone='white'>
          {ip}
        </Chip>
      ))}
      {extraCount > 0 ? (
        <Tooltip
          content={ips.slice(1).join(', ')}
          placement='top'
          showArrow
        >
          <span>
            <Chip tone='white'>+{extraCount}</Chip>
          </span>
        </Tooltip>
      ) : null}
    </div>
  );
};

const renderQuotaUsage = (text, record, t) => {
  const used = parseInt(record.used_quota) || 0;
  const remain = parseInt(record.remain_quota) || 0;
  const total = used + remain;

  if (record.unlimited_quota) {
    const popoverContent = (
      <div className='space-y-1'>
        <CopyableLine value={renderQuota(used)}>
          {t('已用额度')}: {renderQuota(used)}
        </CopyableLine>
      </div>
    );
    return (
      <HoverPanel content={popoverContent} placement='top'>
        <Chip tone='white'>{t('无限额度')}</Chip>
      </HoverPanel>
    );
  }

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
    <HoverPanel content={popoverContent} placement='top'>
      <span className='inline-flex flex-col items-stretch gap-1 rounded-full border border-[color:var(--app-border)] bg-white px-2 py-1 text-xs text-slate-700 dark:bg-slate-900 dark:text-slate-200'>
        <span className='leading-none'>{`${renderQuota(remain)} / ${renderQuota(total)}`}</span>
        <ProgressBar percent={percent} />
      </span>
    </HoverPanel>
  );
};

// ---------- Operations cell (split chat menu + enable/disable + edit + delete) ----------
function OperationsCell({
  record,
  onOpenLink,
  setEditingToken,
  setShowEdit,
  manageToken,
  refresh,
  t,
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  let chatsArray = [];
  try {
    const raw = localStorage.getItem('chats');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];
        const name = Object.keys(item)[0];
        if (!name) continue;
        chatsArray.push({
          name,
          value: item[name],
        });
      }
    }
  } catch (_) {
    showError(t('聊天链接配置错误，请联系管理员'));
  }

  const chatMenuItems = chatsArray.map((entry) => ({
    label: entry.name,
    onClick: () => onOpenLink(entry.name, entry.value, record),
  }));

  return (
    <div className='flex flex-wrap items-center gap-1.5'>
      <div className='inline-flex items-stretch overflow-hidden rounded-md border border-[color:var(--app-border)]'>
        <button
          type='button'
          className='px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-[color:var(--app-background)]'
          onClick={() => {
            if (chatsArray.length === 0) {
              showError(t('请联系管理员配置聊天链接'));
            } else {
              const first = chatsArray[0];
              onOpenLink(first.name, first.value, record);
            }
          }}
        >
          {t('聊天')}
        </button>
        <ClickMenu
          placement='bottomRight'
          items={chatMenuItems}
          trigger={
            <button
              type='button'
              aria-label={t('选择聊天链接')}
              className='flex items-center justify-center border-l border-[color:var(--app-border)] px-1.5 text-xs text-foreground transition hover:bg-[color:var(--app-background)]'
            >
              <ChevronDown size={12} />
            </button>
          }
        />
      </div>

      {record.status === 1 ? (
        <Button
          color='danger'
          variant='flat'
          size='sm'
          onPress={async () => {
            await manageToken(record.id, 'disable', record);
            await refresh();
          }}
        >
          {t('禁用')}
        </Button>
      ) : (
        <Button
          variant='flat'
          size='sm'
          onPress={async () => {
            await manageToken(record.id, 'enable', record);
            await refresh();
          }}
        >
          {t('启用')}
        </Button>
      )}

      <Button
        variant='light'
        size='sm'
        onPress={() => {
          setEditingToken(record);
          setShowEdit(true);
        }}
      >
        {t('编辑')}
      </Button>

      <Button
        color='danger'
        variant='flat'
        size='sm'
        onPress={() => setConfirmDelete(true)}
      >
        {t('删除')}
      </Button>

      <ConfirmDialog
        visible={confirmDelete}
        title={t('确定是否要删除此令牌？')}
        cancelText={t('取消')}
        confirmText={t('确定')}
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false);
          await manageToken(record.id, 'delete', record);
          await refresh();
        }}
      >
        {t('此修改将不可逆')}
      </ConfirmDialog>
    </div>
  );
}

export const getTokensColumns = ({
  t,
  showKeys,
  resolvedTokenKeys,
  loadingTokenKeys,
  toggleTokenVisibility,
  copyTokenKey,
  copyTokenConnectionString,
  manageToken,
  onOpenLink,
  setEditingToken,
  setShowEdit,
  refresh,
  groupRatios = {},
}) => {
  return [
    {
      title: t('名称'),
      dataIndex: 'name',
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      key: 'status',
      render: (text, record) => renderStatus(text, record, t),
    },
    {
      title: t('剩余额度/总额度'),
      key: 'quota_usage',
      render: (text, record) => renderQuotaUsage(text, record, t),
    },
    {
      title: t('分组'),
      dataIndex: 'group',
      key: 'group',
      render: (text, record) => renderGroupColumn(text, record, t, groupRatios),
    },
    {
      title: t('密钥'),
      key: 'token_key',
      render: (text, record) => (
        <TokenKeyCell
          record={record}
          showKeys={showKeys}
          resolvedTokenKeys={resolvedTokenKeys}
          loadingTokenKeys={loadingTokenKeys}
          toggleTokenVisibility={toggleTokenVisibility}
          copyTokenKey={copyTokenKey}
          copyTokenConnectionString={copyTokenConnectionString}
          t={t}
        />
      ),
    },
    {
      title: t('可用模型'),
      dataIndex: 'model_limits',
      render: (text, record) => renderModelLimits(text, record, t),
    },
    {
      title: t('IP限制'),
      dataIndex: 'allow_ips',
      render: (text) => renderAllowIps(text, t),
    },
    {
      title: t('创建时间'),
      dataIndex: 'created_time',
      render: (text) => <div>{renderTimestamp(text)}</div>,
    },
    {
      title: t('过期时间'),
      dataIndex: 'expired_time',
      render: (text, record) => (
        <div>
          {record.expired_time === -1 ? t('永不过期') : renderTimestamp(text)}
        </div>
      ),
    },
    {
      title: '',
      dataIndex: 'operate',
      fixed: 'right',
      render: (text, record) => (
        <OperationsCell
          record={record}
          onOpenLink={onOpenLink}
          setEditingToken={setEditingToken}
          setShowEdit={setShowEdit}
          manageToken={manageToken}
          refresh={refresh}
          t={t}
        />
      ),
    },
  ];
};
