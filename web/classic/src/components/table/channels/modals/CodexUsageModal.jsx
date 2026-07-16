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
  Collapse,
} from '@douyinfe/semi-ui';
import { API, showError } from '../../../../helpers';
import { MOBILE_BREAKPOINT } from '../../../../hooks/common/useIsMobile';

const { Text } = Typography;

const CODEX_USAGE_MODAL_CLASS_NAME = 'codex-usage-modal';

const CodexUsageModalStyles = () => (
  <style>
    {`
@media (max-width: ${MOBILE_BREAKPOINT - 1}px) {
  .${CODEX_USAGE_MODAL_CLASS_NAME} .semi-modal-body.semi-modal-withIcon {
    margin-left: 0 !important;
    width: auto !important;
  }
}
`}
  </style>
);

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

const isMobileViewport = () =>
  typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT;

const getCodexUsageModalLayout = () => {
  if (isMobileViewport()) {
    return {
      width: 'calc(100vw - 16px)',
      style: {
        top: 0,
        maxWidth: 'calc(100vw - 16px)',
        margin: '8px auto',
      },
      bodyStyle: {
        maxHeight: 'calc(100vh - 164px)',
        overflowY: 'auto',
        padding: '16px 16px 12px',
      },
    };
  }

  return {
    width: 900,
    style: {
      top: 0,
      margin: '16px auto',
      maxWidth: 'min(900px, 92vw)',
    },
    bodyStyle: {
      maxHeight: 'calc(100vh - 188px)',
      overflowY: 'auto',
      padding: '20px 24px 16px',
    },
  };
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

const InfoField = ({
  t,
  label,
  value,
  onCopy,
  monospace = false,
  className = '',
}) => {
  const tt = typeof t === 'function' ? t : (v) => v;
  const text = getDisplayText(value);
  const hasValue = text !== '';

  return (
    <div
      className={`min-w-0 rounded-lg bg-semi-color-bg-0 px-3 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}
    >
      <div className='text-[11px] font-medium text-semi-color-text-2'>
        {label}
      </div>
      <div className='mt-1 flex min-w-0 items-start justify-between gap-2'>
        <div
          className={`min-w-0 flex-1 break-all text-xs leading-5 text-semi-color-text-0 ${
            monospace ? 'font-mono [font-variant-numeric:tabular-nums]' : ''
          }`}
        >
          {hasValue ? text : '-'}
        </div>
        {onCopy ? (
          <Button
            size='small'
            type='tertiary'
            theme='borderless'
            className='h-6 shrink-0 px-1 text-xs'
            disabled={!hasValue}
            onClick={() => onCopy(text)}
          >
            {tt('复制')}
          </Button>
        ) : null}
      </div>
    </div>
  );
};

const SectionHeading = ({ title, description, children }) => (
  <div className='flex flex-wrap items-start justify-between gap-3'>
    <div className='min-w-0'>
      <div className='text-sm font-semibold text-semi-color-text-0'>
        {title}
      </div>
      {description ? (
        <div className='mt-1 text-xs leading-5 text-semi-color-text-2'>
          {description}
        </div>
      ) : null}
    </div>
    {children ? (
      <div className='flex shrink-0 flex-wrap items-center gap-2'>
        {children}
      </div>
    ) : null}
  </div>
);

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
    <div className='rounded-lg bg-semi-color-bg-0 p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]'>
      <div className='flex items-start justify-between gap-3'>
        <div className='min-w-0'>
          <div className='text-sm font-semibold text-semi-color-text-0'>
            {title}
          </div>
          <div className='mt-1 text-xs text-semi-color-text-2'>
            {tt('窗口：')}
            {hasWindowData
              ? formatDurationSeconds(limitWindowSeconds, tt)
              : '-'}
          </div>
        </div>
        <div className='shrink-0 text-right'>
          <div
            className='text-xl font-semibold leading-none [font-variant-numeric:tabular-nums]'
            style={{ color: pickStrokeColor(percent) }}
          >
            {hasWindowData ? `${percent}%` : '-'}
          </div>
          <div className='mt-1 text-[11px] text-semi-color-text-2'>
            {tt('已使用')}
          </div>
        </div>
      </div>

      {hasWindowData ? (
        <div className='mt-2'>
          <Progress
            percent={percent}
            stroke={pickStrokeColor(percent)}
            showInfo={false}
          />
        </div>
      ) : (
        <div className='mt-3 text-sm text-semi-color-text-2'>-</div>
      )}

      <div className='mt-3 grid grid-cols-1 gap-2 text-xs text-semi-color-text-2 sm:grid-cols-2'>
        <div className='min-w-0'>
          <div className='text-[11px]'>{tt('重置时间')}</div>
          <div className='break-all text-semi-color-text-0 [font-variant-numeric:tabular-nums]'>
            {hasWindowData ? formatUnixSeconds(resetAt) : '-'}
          </div>
        </div>
        <div className='min-w-0 sm:text-right'>
          <div className='text-[11px]'>{tt('距离重置')}</div>
          <div className='text-semi-color-text-0 [font-variant-numeric:tabular-nums]'>
            {hasWindowData ? formatDurationSeconds(resetAfterSeconds, tt) : '-'}
          </div>
        </div>
      </div>
    </div>
  );
};

const RateLimitWindowGrid = ({ t, fiveHourWindow, weeklyWindow }) => {
  const tt = typeof t === 'function' ? t : (v) => v;

  return (
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
  );
};

const RateLimitGroupSection = ({
  t,
  title,
  description,
  rateLimitSource,
  statusTag,
  meteredFeature,
}) => {
  const tt = typeof t === 'function' ? t : (v) => v;
  const { fiveHourWindow, weeklyWindow } =
    resolveRateLimitWindows(rateLimitSource);
  const featureText = getDisplayText(meteredFeature);

  return (
    <section className='space-y-3 rounded-lg bg-semi-color-fill-0 p-3'>
      <SectionHeading title={title} description={description}>
        {statusTag}
      </SectionHeading>
      {featureText ? (
        <div className='inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-semi-color-bg-0 px-2 py-1 shadow-[0_1px_2px_rgba(0,0,0,0.04)]'>
          <span className='text-[11px] text-semi-color-text-2'>
            metered_feature
          </span>
          <span className='min-w-0 break-all font-mono text-xs text-semi-color-text-0'>
            {featureText}
          </span>
        </div>
      ) : null}

      <RateLimitWindowGrid
        t={tt}
        fiveHourWindow={fiveHourWindow}
        weeklyWindow={weeklyWindow}
      />
    </section>
  );
};

const CodexUsageView = ({ t, record, payload, onCopy, onRefresh }) => {
  const tt = typeof t === 'function' ? t : (v) => v;
  const [showRawJson, setShowRawJson] = useState(false);
  const data = payload?.data ?? null;
  const rateLimit = data?.rate_limit ?? {};
  const additionalRateLimits = Array.isArray(data?.additional_rate_limits)
    ? data.additional_rate_limits.filter(
        (item) =>
          item && typeof item === 'object' && Object.keys(item).length > 0,
      )
    : [];
  const upstreamStatus = payload?.upstream_status;
  const accountType = data?.plan_type ?? rateLimit?.plan_type;
  const accountTypeLabel = formatAccountTypeLabel(accountType, tt);
  const accountTypeTagColor = getAccountTypeTagColor(accountType);
  const statusTag = resolveUsageStatusTag(tt, rateLimit);
  const userId = data?.user_id;
  const email = data?.email;
  const channelLabel = `${record?.name || '-'} (#${record?.id || '-'})`;
  const resetCredits = data?.rate_limit_reset_credits?.available_count;
  const errorMessage =
    payload?.success === false
      ? getDisplayText(payload?.message) || tt('获取用量失败')
      : '';

  const rawText =
    typeof data === 'string' ? data : JSON.stringify(data ?? payload, null, 2);

  return (
    <div className='flex flex-col gap-4'>
      {errorMessage && (
        <div className='rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>
          {errorMessage}
        </div>
      )}

      <div className='rounded-lg bg-semi-color-fill-0 p-4'>
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0'>
            <div className='text-xs font-medium text-semi-color-text-2'>
              {tt('Codex 帐号状态')}
            </div>
          </div>
          <Button
            size='small'
            type='tertiary'
            theme='outline'
            onClick={onRefresh}
            className='shrink-0'
          >
            {tt('刷新')}
          </Button>
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
            HTTP {upstreamStatus ?? '-'}
          </Tag>
          <Tag
            color={Number(resetCredits) > 0 ? 'blue' : 'grey'}
            type='light'
            shape='circle'
          >
            {tt('重置次数：')}
            {Number.isFinite(Number(resetCredits)) ? String(resetCredits) : '-'}
          </Tag>
          {data?.credits?.overage_limit_reached ? (
            <Tag color='red' type='light' shape='circle'>
              {tt('超额受限')}
            </Tag>
          ) : null}
          {data?.spend_control?.reached ? (
            <Tag color='red' type='light' shape='circle'>
              {tt('消费受限')}
            </Tag>
          ) : null}
        </div>

        <div className='mt-4 grid grid-cols-1 gap-3 md:grid-cols-2'>
          <InfoField t={tt} label={tt('邮箱')} value={email} onCopy={onCopy} />
          <InfoField t={tt} label={tt('渠道')} value={channelLabel} />
          <InfoField
            t={tt}
            label='User ID'
            value={userId}
            onCopy={onCopy}
            monospace={true}
            className='md:col-span-2'
          />
        </div>
      </div>

      <div className='space-y-3'>
        <SectionHeading
          title={tt('基础额度')}
          description={tt('当前帐号的基础额度窗口')}
        >
          {statusTag}
        </SectionHeading>
        <RateLimitWindowGrid t={tt} {...resolveRateLimitWindows(data)} />
      </div>

      {additionalRateLimits.length > 0 ? (
        <div className='space-y-3'>
          <SectionHeading
            title={tt('附加额度')}
            description={tt('按模型或能力拆分的附加计费能力窗口')}
          />
          <div className='space-y-3'>
            {additionalRateLimits.map((item, index) => {
              const limitName =
                getDisplayText(item?.limit_name) ||
                getDisplayText(item?.metered_feature) ||
                `${tt('附加额度')} ${index + 1}`;

              return (
                <RateLimitGroupSection
                  key={`${limitName}-${getDisplayText(item?.metered_feature)}-${index}`}
                  t={tt}
                  title={limitName}
                  description={tt('附加计费能力')}
                  rateLimitSource={item}
                  statusTag={resolveUsageStatusTag(tt, item?.rate_limit)}
                  meteredFeature={item?.metered_feature}
                />
              );
            })}
          </div>
        </div>
      ) : null}

      <Collapse
        activeKey={showRawJson ? ['raw-json'] : []}
        onChange={(activeKey) => {
          const keys = Array.isArray(activeKey) ? activeKey : [activeKey];
          setShowRawJson(keys.includes('raw-json'));
        }}
        className='rounded-lg border border-semi-color-border bg-semi-color-bg-0'
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
          <pre className='max-h-[44vh] overflow-y-auto rounded-lg bg-semi-color-fill-0 p-3 text-xs text-semi-color-text-0 [font-variant-numeric:tabular-nums]'>
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
      <>
        <CodexUsageModalStyles />
        <div className='flex items-center justify-center py-10'>
          <Spin spinning={true} size='large' tip={tt('加载中...')} />
        </div>
      </>
    );
  }

  if (!payload) {
    return (
      <>
        <CodexUsageModalStyles />
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
      </>
    );
  }

  return (
    <>
      <CodexUsageModalStyles />
      <CodexUsageView
        t={tt}
        record={record}
        payload={payload}
        onCopy={onCopy}
        onRefresh={fetchUsage}
      />
    </>
  );
};

export const openCodexUsageModal = ({ t, record, payload, onCopy }) => {
  const tt = typeof t === 'function' ? t : (v) => v;
  const layout = getCodexUsageModalLayout();

  Modal.info({
    title: tt('Codex 帐号与用量'),
    className: CODEX_USAGE_MODAL_CLASS_NAME,
    centered: false,
    width: layout.width,
    style: layout.style,
    bodyStyle: layout.bodyStyle,
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
