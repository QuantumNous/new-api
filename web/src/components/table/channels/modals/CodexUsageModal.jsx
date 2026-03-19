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
  Tag,
  Typography,
  Spin,
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

const RateLimitWindowCard = ({ t, title, windowData }) => {
  const tt = typeof t === 'function' ? t : (v) => v;
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

      <div className='mt-2'>
        <Progress
          percent={percent}
          stroke={pickStrokeColor(percent)}
          showInfo={true}
        />
      </div>

      <div className='mt-1 flex flex-wrap items-center gap-2 text-xs text-semi-color-text-2'>
        <div>
          {tt('已使用：')}
          {percent}%
        </div>
        <div>
          {tt('距离重置：')}
          {formatDurationSeconds(resetAfterSeconds, tt)}
        </div>
        <div>
          {tt('窗口：')}
          {formatDurationSeconds(limitWindowSeconds, tt)}
        </div>
      </div>
    </div>
  );
};

const CodexUsageView = ({ t, record, payload, onCopy, onRefresh }) => {
  const tt = typeof t === 'function' ? t : (v) => v;
  const data = payload?.data ?? null;
  const rateLimit = data?.rate_limit ?? {};

  const primary = rateLimit?.primary_window ?? null;
  const secondary = rateLimit?.secondary_window ?? null;

  const allowed = !!rateLimit?.allowed;
  const limitReached = !!rateLimit?.limit_reached;
  const upstreamStatus = payload?.upstream_status;

  const statusTag =
    allowed && !limitReached ? (
      <Tag color='green'>{tt('可用')}</Tag>
    ) : (
      <Tag color='red'>{tt('受限')}</Tag>
    );

  const rawText =
    typeof data === 'string' ? data : JSON.stringify(data ?? payload, null, 2);

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <Text type='tertiary' size='small'>
          {tt('渠道：')}
          {record?.name || '-'} ({tt('编号：')}
          {record?.id || '-'})
        </Text>
        <div className='flex items-center gap-2'>
          {statusTag}
          <Button
            size='small'
            type='tertiary'
            theme='borderless'
            onClick={onRefresh}
          >
            {tt('刷新')}
          </Button>
        </div>
      </div>

      <div className='flex flex-wrap items-center justify-between gap-2'>
        <Text type='tertiary' size='small'>
          {tt('上游状态码：')}
          {upstreamStatus ?? '-'}
        </Text>
      </div>

      <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
        <RateLimitWindowCard
          t={tt}
          title={tt('5小时窗口')}
          windowData={primary}
        />
        <RateLimitWindowCard
          t={tt}
          title={tt('每周窗口')}
          windowData={secondary}
        />
      </div>

      <div>
        <div className='mb-1 flex items-center justify-between gap-2'>
          <div className='text-sm font-medium'>{tt('原始 JSON')}</div>
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
        <pre className='max-h-[50vh] overflow-auto rounded-lg bg-semi-color-fill-0 p-3 text-xs text-semi-color-text-0'>
          {rawText}
        </pre>
      </div>
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
    title: tt('Codex 用量'),
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
