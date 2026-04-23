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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Button,
  Progress,
  Typography,
  Spin,
  Tag,
  Descriptions,
  Collapse,
} from '@douyinfe/semi-ui';
import { API, showError } from '../../../../helpers';

const { Text } = Typography;

const clampPercent = (value) => {
  const v = Number(value);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
};

const pickStrokeColor = (percent) => {
  const p = clampPercent(percent);
  if (p >= 95) return '#ef4444';
  if (p >= 80) return '#f59e0b';
  return '#3b82f6';
};

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
    fiveHourWindow = windows.find((windowData) => windowData !== weeklyWindow) ?? null;
  }
  if (!weeklyWindow) {
    weeklyWindow = windows.find((windowData) => windowData !== fiveHourWindow) ?? null;
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

const getAccountTypeTagColor = (value) => {
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
    return <Tag color='grey'>{tt('待确认')}</Tag>;
  }
  if (rateLimit?.allowed && !rateLimit?.limit_reached) {
    return <Tag color='green'>{tt('可用')}</Tag>;
  }
  return <Tag color='red'>{tt('受限')}</Tag>;
};

const AccountInfoValue = ({ t, value, onCopy, monospace = false }) => {
  const tt = typeof t === 'function' ? t : (v) => v;
  const text = getDisplayText(value);
  const hasValue = text !== '';

  return (
    <div className='flex min-w-0 items-start justify-between gap-2'>
      <div
        className={`min-w-0 flex-1 break-all text-xs leading-5 text-semi-color-text-1 ${
          monospace ? 'font-mono' : ''
        }`}
      >
        {hasValue ? text : '-'}
      </div>
      <Button
        size='small'
        type='tertiary'
        theme='borderless'
        className='shrink-0 px-1 text-xs'
        disabled={!hasValue}
        onClick={() => onCopy?.(text)}
      >
        {tt('复制')}
      </Button>
    </div>
  );
};

const RateLimitWindowCard = ({ t, title, windowData }) => {
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
    <div className='rounded-lg border border-semi-color-border bg-semi-color-bg-0 p-3'>
      <div className='flex items-center justify-between gap-2'>
        <div className='font-medium'>{title}</div>
        <Text type='tertiary' size='small'>
          {tt('重置时间：')}
          {formatUnixSeconds(resetAt)}
        </Text>
      </div>

      {hasWindowData ? (
        <div className='mt-2'>
          <Progress
            percent={percent}
            stroke={pickStrokeColor(percent)}
            showInfo={true}
          />
        </div>
      ) : (
        <div className='mt-3 text-sm text-semi-color-text-2'>-</div>
      )}

      <div className='mt-1 flex flex-wrap items-center gap-2 text-xs text-semi-color-text-2'>
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
};

const CodexUsageView = ({ t, record, payload, onCopy, onRefresh }) => {
  const tt = typeof t === 'function' ? t : (v) => v;
  const [showRawJson, setShowRawJson] = useState(false);
  const data = payload?.data ?? null;
  const rateLimit = data?.rate_limit ?? {};
  const { fiveHourWindow, weeklyWindow } = resolveRateLimitWindows(data);
  const upstreamStatus = payload?.upstream_status;
  const accountType = data?.plan_type ?? rateLimit?.plan_type;
  const accountTypeLabel = formatAccountTypeLabel(accountType, tt);
  const accountTypeTagColor = getAccountTypeTagColor(accountType);
  const statusTag = resolveUsageStatusTag(tt, rateLimit);
  const userId = data?.user_id;
  const email = data?.email;
  const accountId = data?.account_id;
  const errorMessage =
    payload?.success === false ? getDisplayText(payload?.message) || tt('获取用量失败') : '';

  const rawText =
    typeof data === 'string' ? data : JSON.stringify(data ?? payload, null, 2);

  return (
    <div className='flex flex-col gap-4'>
      {errorMessage && (
        <div className='rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>
          {errorMessage}
        </div>
      )}

      <div className='rounded-xl border border-semi-color-border bg-semi-color-bg-0 p-3'>
        <div className='flex flex-wrap items-start justify-between gap-2'>
          <div className='min-w-0'>
            <div className='text-xs font-medium text-semi-color-text-2'>
              {tt('Codex 帐号')}
            </div>
            <div className='mt-2 flex flex-wrap items-center gap-2'>
              <Tag
                color={accountTypeTagColor}
                type='light'
                shape='circle'
                size='large'
                className='font-semibold'
              >
                {accountTypeLabel}
              </Tag>
              {statusTag}
              <Tag color='grey' type='light' shape='circle'>
                {tt('上游状态码：')}
                {upstreamStatus ?? '-'}
              </Tag>
            </div>
          </div>
          <Button size='small' type='tertiary' theme='outline' onClick={onRefresh}>
            {tt('刷新')}
          </Button>
        </div>

        <div className='mt-2 rounded-lg bg-semi-color-fill-0 px-3 py-2'>
          <Descriptions>
            <Descriptions.Item itemKey='User ID'>
              <AccountInfoValue
                t={tt}
                value={userId}
                onCopy={onCopy}
                monospace={true}
              />
            </Descriptions.Item>
            <Descriptions.Item itemKey={tt('邮箱')}>
              <AccountInfoValue t={tt} value={email} onCopy={onCopy} />
            </Descriptions.Item>
            <Descriptions.Item itemKey='Account ID'>
              <AccountInfoValue
                t={tt}
                value={accountId}
                onCopy={onCopy}
                monospace={true}
              />
            </Descriptions.Item>
          </Descriptions>
        </div>

        <div className='mt-2 text-xs text-semi-color-text-2'>
          {tt('渠道：')}
          {record?.name || '-'} ({tt('编号：')}
          {record?.id || '-'})
        </div>
      </div>

      <div>
        <div className='mb-2'>
          <div className='text-sm font-semibold text-semi-color-text-0'>
            {tt('额度窗口')}
          </div>
          <Text type='tertiary' size='small'>
            {tt('用于观察当前帐号在 Codex 上游的限额使用情况')}
          </Text>
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

      <Collapse
        activeKey={showRawJson ? ['raw-json'] : []}
        onChange={(activeKey) => {
          const keys = Array.isArray(activeKey) ? activeKey : [activeKey];
          setShowRawJson(keys.includes('raw-json'));
        }}
      >
        <Collapse.Panel header={tt('原始 JSON')} itemKey='raw-json'>
          <div className='mb-2 flex justify-end'>
            <Button
              size='small'
              type='primary'
              theme='outline'
              onClick={() => onCopy?.(rawText)}
              disabled={!rawText}
            >
              {tt('复制')}
            </Button>
          </div>
          <pre className='max-h-[50vh] overflow-y-auto rounded-lg bg-semi-color-fill-0 p-3 text-xs text-semi-color-text-0'>
            {rawText}
          </pre>
        </Collapse.Panel>
      </Collapse>
    </div>
  );
};

const CodexUsageLoader = ({ t, record, initialPayload, onCopy }) => {
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
      <div className='flex items-center justify-center py-10'>
        <Spin spinning={true} size='large' tip={tt('加载中...')} />
      </div>
    );
  }

  if (!payload) {
    return (
      <div className='flex flex-col gap-3'>
        <Text type='danger'>{tt('获取用量失败')}</Text>
        <div className='flex justify-end'>
          <Button
            size='small'
            type='primary'
            theme='outline'
            onClick={fetchUsage}
          >
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
};

export const openCodexUsageModal = ({ t, record, payload, onCopy }) => {
  const tt = typeof t === 'function' ? t : (v) => v;

  Modal.info({
    title: tt('Codex 帐号与用量'),
    centered: true,
    width: 900,
    style: { maxWidth: '95vw' },
    content: (
      <CodexUsageLoader
        t={tt}
        record={record}
        initialPayload={payload}
        onCopy={onCopy}
      />
    ),
    footer: (
      <div className='flex justify-end gap-2'>
        <Button type='primary' theme='solid' onClick={() => Modal.destroyAll()}>
          {tt('关闭')}
        </Button>
      </div>
    ),
  });
};
