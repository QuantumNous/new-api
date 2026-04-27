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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Button,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalFooter,
  ModalHeader,
  Spinner,
  useOverlayState,
} from '@heroui/react';
import { ChevronDown, RefreshCw, X } from 'lucide-react';
import { API, showError } from '../../../../helpers';

const TAG_TONE = {
  green: 'bg-success/15 text-success',
  red: 'bg-danger/15 text-danger',
  amber: 'bg-warning/15 text-warning',
  blue: 'bg-primary/15 text-primary',
  cyan: 'bg-[color-mix(in_oklab,var(--app-primary)_18%,transparent)] text-[color-mix(in_oklab,var(--app-primary)_72%,var(--app-foreground))]',
  violet:
    'bg-[color-mix(in_oklab,var(--app-primary)_12%,transparent)] text-[color-mix(in_oklab,var(--app-primary)_82%,var(--app-foreground))]',
  grey: 'bg-surface-secondary text-muted',
};

function StatusChip({ tone = 'grey', size = 'md', strong = false, children }) {
  const sizeCls = size === 'lg' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-xs';
  const weight = strong ? 'font-semibold' : 'font-medium';
  return (
    <span
      className={`inline-flex items-center rounded-full ${sizeCls} ${weight} ${
        TAG_TONE[tone] || TAG_TONE.grey
      }`}
    >
      {children}
    </span>
  );
}

const clampPercent = (value) => {
  const v = Number(value);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
};

// Returns the semantic Tailwind class name for the progress bar fill
// based on the current usage percentage.
const pickProgressTone = (percent) => {
  const p = clampPercent(percent);
  if (p >= 95) return 'bg-danger';
  if (p >= 80) return 'bg-warning';
  return 'bg-primary';
};

function ProgressBar({ percent, showInfo = true }) {
  const safe = clampPercent(percent);
  const tone = pickProgressTone(safe);
  return (
    <div className='flex items-center gap-2'>
      <div className='h-2 flex-1 overflow-hidden rounded-full bg-surface-secondary'>
        <div
          className={`h-full rounded-full transition-[width] duration-200 ${tone}`}
          style={{ width: `${safe}%` }}
        />
      </div>
      {showInfo ? (
        <span className='shrink-0 text-xs font-medium text-foreground'>
          {Math.round(safe)}%
        </span>
      ) : null}
    </div>
  );
}

const normalizePlanType = (value) => {
  if (value == null) return '';
  return String(value).trim().toLowerCase();
};

const getWindowDurationSeconds = (windowData) => {
  const value = Number(windowData?.limit_window_seconds);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
};

const classifyWindowByDuration = (windowData) => {
  const seconds = getWindowDurationSeconds(windowData);
  if (seconds == null) return null;
  return seconds >= 24 * 60 * 60 ? 'weekly' : 'fiveHour';
};

const resolveRateLimitWindows = (data) => {
  const rateLimit = data?.rate_limit ?? {};
  const primary = rateLimit?.primary_window ?? null;
  const secondary = rateLimit?.secondary_window ?? null;
  const windows = [primary, secondary].filter(Boolean);
  const planType = normalizePlanType(data?.plan_type ?? rateLimit?.plan_type);

  let fiveHourWindow = null;
  let weeklyWindow = null;

  for (const windowData of windows) {
    const bucket = classifyWindowByDuration(windowData);
    if (bucket === 'fiveHour' && !fiveHourWindow) {
      fiveHourWindow = windowData;
      continue;
    }
    if (bucket === 'weekly' && !weeklyWindow) {
      weeklyWindow = windowData;
    }
  }

  if (planType === 'free') {
    if (!weeklyWindow) {
      weeklyWindow = primary ?? secondary ?? null;
    }
    return { fiveHourWindow: null, weeklyWindow };
  }

  if (!fiveHourWindow && !weeklyWindow) {
    return {
      fiveHourWindow: primary ?? null,
      weeklyWindow: secondary ?? null,
    };
  }

  if (!fiveHourWindow) {
    fiveHourWindow =
      windows.find((windowData) => windowData !== weeklyWindow) ?? null;
  }
  if (!weeklyWindow) {
    weeklyWindow =
      windows.find((windowData) => windowData !== fiveHourWindow) ?? null;
  }

  return { fiveHourWindow, weeklyWindow };
};

const formatDurationSeconds = (seconds, t) => {
  const tt = typeof t === 'function' ? t : (v) => v;
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return '-';
  const total = Math.floor(s);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}${tt('小时')} ${minutes}${tt('分钟')}`;
  if (minutes > 0) return `${minutes}${tt('分钟')} ${secs}${tt('秒')}`;
  return `${secs}${tt('秒')}`;
};

const formatUnixSeconds = (unixSeconds) => {
  const v = Number(unixSeconds);
  if (!Number.isFinite(v) || v <= 0) return '-';
  try {
    return new Date(v * 1000).toLocaleString();
  } catch (error) {
    return String(unixSeconds);
  }
};

const getDisplayText = (value) => {
  if (value == null) return '';
  return String(value).trim();
};

const formatAccountTypeLabel = (value, t) => {
  const tt = typeof t === 'function' ? t : (v) => v;
  const normalized = normalizePlanType(value);
  switch (normalized) {
    case 'free':
      return 'Free';
    case 'plus':
      return 'Plus';
    case 'pro':
      return 'Pro';
    case 'team':
      return 'Team';
    case 'enterprise':
      return 'Enterprise';
    default:
      return getDisplayText(value) || tt('未识别');
  }
};

const getAccountTypeTagTone = (value) => {
  const normalized = normalizePlanType(value);
  switch (normalized) {
    case 'enterprise':
      return 'green';
    case 'team':
      return 'cyan';
    case 'pro':
      return 'blue';
    case 'plus':
      return 'violet';
    case 'free':
      return 'amber';
    default:
      return 'grey';
  }
};

const resolveUsageStatusTag = (t, rateLimit) => {
  const tt = typeof t === 'function' ? t : (v) => v;
  if (!rateLimit || Object.keys(rateLimit).length === 0) {
    return <StatusChip tone='grey'>{tt('待确认')}</StatusChip>;
  }
  if (rateLimit?.allowed && !rateLimit?.limit_reached) {
    return <StatusChip tone='green'>{tt('可用')}</StatusChip>;
  }
  return <StatusChip tone='red'>{tt('受限')}</StatusChip>;
};

function AccountInfoRow({ t, label, value, onCopy, monospace = false }) {
  const tt = typeof t === 'function' ? t : (v) => v;
  const text = getDisplayText(value);
  const hasValue = text !== '';

  return (
    <div className='grid grid-cols-[120px_1fr_auto] items-start gap-2 px-3 py-2'>
      <div className='text-xs font-medium text-muted'>{label}</div>
      <div
        className={`min-w-0 break-all text-xs leading-5 text-foreground ${
          monospace ? 'font-mono' : ''
        }`}
      >
        {hasValue ? text : '-'}
      </div>
      <Button
        size='sm'
        variant='tertiary'
        isDisabled={!hasValue}
        onPress={() => onCopy?.(text)}
      >
        {tt('复制')}
      </Button>
    </div>
  );
}

function RateLimitWindowCard({ t, title, windowData }) {
  const tt = typeof t === 'function' ? t : (v) => v;
  const hasWindowData =
    !!windowData &&
    typeof windowData === 'object' &&
    Object.keys(windowData).length > 0;
  const percent = clampPercent(windowData?.used_percent ?? 0);
  const resetAt = windowData?.reset_at;
  const resetAfterSeconds = windowData?.reset_after_seconds;
  const limitWindowSeconds = windowData?.limit_window_seconds;

  return (
    <div className='rounded-xl border border-border bg-background p-3'>
      <div className='flex items-center justify-between gap-2'>
        <div className='text-sm font-semibold text-foreground'>{title}</div>
        <div className='text-xs text-muted'>
          {tt('重置时间：')}
          {formatUnixSeconds(resetAt)}
        </div>
      </div>

      {hasWindowData ? (
        <div className='mt-3'>
          <ProgressBar percent={percent} />
        </div>
      ) : (
        <div className='mt-3 text-sm text-muted'>-</div>
      )}

      <div className='mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted'>
        <div>
          {tt('已使用：')}
          {hasWindowData ? `${percent}%` : '-'}
        </div>
        <div>
          {tt('距离重置：')}
          {hasWindowData ? formatDurationSeconds(resetAfterSeconds, tt) : '-'}
        </div>
        <div>
          {tt('窗口：')}
          {hasWindowData ? formatDurationSeconds(limitWindowSeconds, tt) : '-'}
        </div>
      </div>
    </div>
  );
}

function CodexUsageView({ t, record, payload, onCopy, onRefresh }) {
  const tt = typeof t === 'function' ? t : (v) => v;
  const [showRawJson, setShowRawJson] = useState(false);
  const data = payload?.data ?? null;
  const rateLimit = data?.rate_limit ?? {};
  const { fiveHourWindow, weeklyWindow } = resolveRateLimitWindows(data);
  const upstreamStatus = payload?.upstream_status;
  const accountType = data?.plan_type ?? rateLimit?.plan_type;
  const accountTypeLabel = formatAccountTypeLabel(accountType, tt);
  const accountTypeTagTone = getAccountTypeTagTone(accountType);
  const statusTag = resolveUsageStatusTag(tt, rateLimit);
  const userId = data?.user_id;
  const email = data?.email;
  const accountId = data?.account_id;
  const errorMessage =
    payload?.success === false
      ? getDisplayText(payload?.message) || tt('获取用量失败')
      : '';

  const rawText =
    typeof data === 'string' ? data : JSON.stringify(data ?? payload, null, 2);

  return (
    <div className='flex flex-col gap-4'>
      {errorMessage && (
        <div className='rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger'>
          {errorMessage}
        </div>
      )}

      <div className='rounded-xl border border-border bg-background p-3'>
        <div className='flex flex-wrap items-start justify-between gap-2'>
          <div className='min-w-0'>
            <div className='text-xs font-semibold text-muted'>
              {tt('Codex 帐号')}
            </div>
            <div className='mt-2 flex flex-wrap items-center gap-2'>
              <StatusChip tone={accountTypeTagTone} size='lg' strong>
                {accountTypeLabel}
              </StatusChip>
              {statusTag}
              <StatusChip tone='grey'>
                {tt('上游状态码：')}
                {upstreamStatus ?? '-'}
              </StatusChip>
            </div>
          </div>
          <Button size='sm' variant='secondary' onPress={onRefresh}>
            <RefreshCw size={14} />
            {tt('刷新')}
          </Button>
        </div>

        <div className='mt-3 overflow-hidden rounded-lg bg-surface-secondary'>
          <AccountInfoRow
            t={tt}
            label='User ID'
            value={userId}
            onCopy={onCopy}
            monospace
          />
          <div className='border-t border-border' />
          <AccountInfoRow
            t={tt}
            label={tt('邮箱')}
            value={email}
            onCopy={onCopy}
          />
          <div className='border-t border-border' />
          <AccountInfoRow
            t={tt}
            label='Account ID'
            value={accountId}
            onCopy={onCopy}
            monospace
          />
        </div>

        <div className='mt-2 text-xs text-muted'>
          {tt('渠道：')}
          {record?.name || '-'} ({tt('编号：')}
          {record?.id || '-'})
        </div>
      </div>

      <div>
        <div className='text-sm font-semibold text-foreground'>
          {tt('额度窗口')}
        </div>
        <div className='text-xs text-muted'>
          {tt('用于观察当前帐号在 Codex 上游的限额使用情况')}
        </div>
      </div>

      <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
        <RateLimitWindowCard
          t={tt}
          title={tt('5小时窗口')}
          windowData={fiveHourWindow}
        />
        <RateLimitWindowCard
          t={tt}
          title={tt('每周窗口')}
          windowData={weeklyWindow}
        />
      </div>

      {/* Raw JSON collapse: native <details> mirrors the existing
          CollapseSection pattern used elsewhere in the migrated modals. */}
      <details
        className='group rounded-xl border border-border bg-background'
        open={showRawJson}
        onToggle={(event) => setShowRawJson(event.currentTarget.open)}
      >
        <summary className='flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm font-medium text-foreground'>
          <span>{tt('原始 JSON')}</span>
          <ChevronDown
            size={16}
            className='text-muted transition-transform group-open:rotate-180'
          />
        </summary>
        <div className='border-t border-border px-3 py-3'>
          <div className='mb-2 flex justify-end'>
            <Button
              size='sm'
              variant='secondary'
              isDisabled={!rawText}
              onPress={() => onCopy?.(rawText)}
            >
              {tt('复制')}
            </Button>
          </div>
          <pre className='max-h-[50vh] overflow-y-auto rounded-lg bg-surface-secondary p-3 text-xs text-foreground'>
            {rawText}
          </pre>
        </div>
      </details>
    </div>
  );
}

function CodexUsageLoader({ t, record, initialPayload, onCopy }) {
  const tt = typeof t === 'function' ? t : (v) => v;
  const [loading, setLoading] = useState(!initialPayload);
  const [payload, setPayload] = useState(initialPayload ?? null);
  const hasShownErrorRef = useRef(false);
  const mountedRef = useRef(true);
  const recordId = record?.id;

  const fetchUsage = useCallback(async () => {
    if (!recordId) {
      if (mountedRef.current) setPayload(null);
      return;
    }

    if (mountedRef.current) setLoading(true);
    try {
      const res = await API.get(`/api/channel/${recordId}/codex/usage`, {
        skipErrorHandler: true,
      });
      if (!mountedRef.current) return;
      setPayload(res?.data ?? null);
      if (!res?.data?.success && !hasShownErrorRef.current) {
        hasShownErrorRef.current = true;
        showError(tt('获取用量失败'));
      }
    } catch (error) {
      if (!mountedRef.current) return;
      if (!hasShownErrorRef.current) {
        hasShownErrorRef.current = true;
        showError(tt('获取用量失败'));
      }
      setPayload({ success: false, message: String(error) });
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [recordId, tt]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (initialPayload) return;
    fetchUsage().catch(() => {});
  }, [fetchUsage, initialPayload]);

  if (loading) {
    return (
      <div className='flex flex-col items-center justify-center gap-3 py-10'>
        <Spinner color='primary' />
        <div className='text-xs text-muted'>{tt('加载中...')}</div>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className='flex flex-col gap-3'>
        <div className='text-sm text-danger'>{tt('获取用量失败')}</div>
        <div className='flex justify-end'>
          <Button size='sm' variant='secondary' onPress={fetchUsage}>
            <RefreshCw size={14} />
            {tt('刷新')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <CodexUsageView
      t={tt}
      record={record}
      payload={payload}
      onCopy={onCopy}
      onRefresh={fetchUsage}
    />
  );
}

const CodexUsageModal = ({
  visible,
  onClose,
  t,
  record,
  initialPayload,
  onCopy,
}) => {
  const tt = typeof t === 'function' ? t : (v) => v;
  const modalState = useOverlayState({
    isOpen: visible,
    onOpenChange: (isOpen) => {
      if (!isOpen) onClose?.();
    },
  });

  return (
    <Modal state={modalState}>
      <ModalBackdrop variant='blur'>
        <ModalContainer size='3xl' placement='center' className='max-w-[95vw]'>
          <ModalDialog className='bg-background/95 backdrop-blur'>
            <ModalHeader className='border-b border-border'>
              <span>{tt('Codex 帐号与用量')}</span>
            </ModalHeader>
            <ModalBody className='px-6 py-5'>
              {visible ? (
                <CodexUsageLoader
                  t={tt}
                  record={record}
                  initialPayload={initialPayload}
                  onCopy={onCopy}
                />
              ) : null}
            </ModalBody>
            <ModalFooter className='border-t border-border'>
              <Button color='primary' onPress={onClose}>
                <X size={14} />
                {tt('关闭')}
              </Button>
            </ModalFooter>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
};

export default CodexUsageModal;
