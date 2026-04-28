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
import { Button, Meter, Tooltip } from '@heroui/react';
import { ChevronDown, Copy as CopyIcon, Eye, EyeOff } from 'lucide-react';
import HoverPanel from '@/components/common/ui/HoverPanel';
import ClickMenu from '@/components/common/ui/ClickMenu';
import ConfirmDialog from '@/components/common/ui/ConfirmDialog';
import {
  getModelCategories,
  renderGroup,
  renderQuota,
  showError,
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
  grey: 'bg-surface-secondary text-muted',
  black: 'bg-foreground text-background',
  white:
    'border border-border bg-background text-foreground',
};

function Chip({ tone = 'white', className = '', children }) {
  const cls = TONE_CLASSES[tone] || TONE_CLASSES.white;
  // `whitespace-nowrap shrink-0` keeps short CJK labels (已启用 / 无限额度 /
  // 永不过期 / 用户分组) on a single line even when the host cell or flex row
  // is narrow — without it, narrow columns wrap CJK character-by-character.
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${cls} ${className}`}
    >
      {children}
    </span>
  );
}

// Vendor avatar pill — replaces HeroCompat Avatar size='extra-extra-small'
function VendorAvatar({ children, label }) {
  return (
    <span
      aria-label={label}
      className='inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border border-border bg-background text-[10px] font-semibold text-foreground'
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

  // `ghost` keeps both icon-only buttons transparent at rest and only paints a
  // subtle hover background — matches the rest of the inline row controls and
  // avoids the chip-sized "tertiary" pills that filled the full input height.
  // The size override (`h-6 w-6`) shrinks them from 32px (size='sm' icon-only
  // default) to 24px so they sit centered inside the 32px input row with a bit
  // of breathing room on top/bottom.
  // `[&_svg]:!size-3` overrides HeroUI's `.button--sm svg { size-4 }` rule so
  // the inner Lucide glyph renders at 12px instead of the chunky 16px default.
  const inlineIconBtn =
    '!h-6 !w-6 !min-w-6 !rounded-md text-muted hover:!text-foreground [&_svg]:!size-3';

  return (
    <div className='w-[200px]'>
      <div className='flex h-8 items-center gap-0.5 overflow-hidden rounded-lg border border-[color:var(--app-border)] bg-background pl-2 pr-1 text-xs'>
        <input
          readOnly
          value={displayedKey}
          aria-label={t('密钥')}
          className='h-full min-w-0 flex-1 bg-transparent text-foreground outline-none'
        />
        <Button
          isIconOnly
          variant='ghost'
          size='sm'
          className={inlineIconBtn}
          aria-label={revealed ? t('隐藏密钥') : t('显示密钥')}
          isPending={loading}
          onPress={async () => {
            await toggleTokenVisibility(record);
          }}
        >
          {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
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
              variant='ghost'
              size='sm'
              className={inlineIconBtn}
              aria-label={t('复制密钥')}
              isPending={loading}
            >
              <CopyIcon size={13} />
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

  // Plain key/value row helper. CopyableLine isn't usable here anymore
  // because HoverPanel now wraps a (non-interactive) HeroUI Tooltip — the
  // popup dismisses as soon as the cursor leaves the trigger, so click
  // targets inside the popup are unreachable.
  const StatRow = ({ label, value }) => (
    <div className='flex items-center justify-between gap-3'>
      <span className='text-muted'>{label}</span>
      <span className='tabular-nums text-foreground'>{value}</span>
    </div>
  );

  if (record.unlimited_quota) {
    const popoverContent = (
      <div className='space-y-1'>
        <StatRow label={t('已用额度')} value={renderQuota(used)} />
      </div>
    );
    return (
      <HoverPanel content={popoverContent} placement='top'>
        <Chip tone='white'>{t('无限额度')}</Chip>
      </HoverPanel>
    );
  }

  const percent = total > 0 ? (remain / total) * 100 : 0;
  // Map remaining-quota percentage to a Meter color: low remaining = warn/danger.
  // Same thresholds as the previous local ProgressBar (≤10% danger, ≤30% warning,
  // otherwise success).
  const meterColor =
    percent <= 10 ? 'danger' : percent <= 30 ? 'warning' : 'success';

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

  // HeroUI Meter — semantic React Aria primitive for "value-in-range".
  // Default `.meter` class lays out as a grid (label | output / track-track),
  // but in this table cell we want value text on top, bar below, both
  // centered, so we override the root display with a flex column.
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
    <div className='inline-flex items-center gap-1.5 whitespace-nowrap'>
      {/* Split button: primary "聊天" action + chevron that opens the chat-app
          chooser. Both are HeroUI Buttons with matching height (!h-7) so this
          row aligns with the 禁用/编辑/删除 buttons. ButtonGroup can't be used
          here because ClickMenu wraps its trigger in <span>s, which breaks the
          `:first-child/:last-child` CSS selectors ButtonGroup relies on — so
          the two corners are zeroed manually with `!rounded-r-none` /
          `!rounded-l-none`, and a `border-l` divider visually splits them. */}
      <div className='inline-flex items-stretch'>
        <Button
          variant='tertiary'
          size='sm'
          className='!h-7 !rounded-r-none !px-2.5 !text-xs'
          onPress={() => {
            if (chatsArray.length === 0) {
              showError(t('请联系管理员配置聊天链接'));
            } else {
              const first = chatsArray[0];
              onOpenLink(first.name, first.value, record);
            }
          }}
        >
          {t('聊天')}
        </Button>
        <ClickMenu
          placement='bottomRight'
          items={chatMenuItems}
          trigger={
            <Button
              isIconOnly
              variant='tertiary'
              size='sm'
              aria-label={t('选择聊天链接')}
              className='!h-7 !w-6 !min-w-6 !rounded-l-none !border-l !border-[color:var(--app-border)]'
            >
              <ChevronDown size={12} />
            </Button>
          }
        />
      </div>

      {/* `text-xs` shrinks the label from 14px to 12px to match the inline
          "聊天" button at the start of this cell; `h-7 px-2.5` keeps the
          buttons compact and visually aligned with that smaller height. */}
      {record.status === 1 ? (
        <Button
          variant='danger-soft'
          size='sm'
          className='!h-7 !px-2.5 !text-xs'
          onPress={async () => {
            await manageToken(record.id, 'disable', record);
            await refresh();
          }}
        >
          {t('禁用')}
        </Button>
      ) : (
        <Button
          variant='tertiary'
          size='sm'
          className='!h-7 !px-2.5 !text-xs'
          onPress={async () => {
            await manageToken(record.id, 'enable', record);
            await refresh();
          }}
        >
          {t('启用')}
        </Button>
      )}

      <Button
        variant='tertiary'
        size='sm'
        className='!h-7 !px-2.5 !text-xs'
        onPress={() => {
          setEditingToken(record);
          setShowEdit(true);
        }}
      >
        {t('编辑')}
      </Button>

      <Button
        variant='danger-soft'
        size='sm'
        className='!h-7 !px-2.5 !text-xs'
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
      width: 220,
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
