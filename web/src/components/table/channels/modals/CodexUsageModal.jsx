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
import { Button, Modal, Progress, Spin, Tag, Typography } from '@douyinfe/semi-ui';
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

const formatUsageValue = (value) => {
  const v = Number(value);
  if (!Number.isFinite(v)) return '-';
  return v.toFixed(v >= 100 ? 0 : 2);
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

const BulkCodexUsageList = ({ t, items, summary, loading, onCopy, onRefresh }) => {
  const tt = typeof t === 'function' ? t : (v) => v;
  const finishedCount = Number(summary?.finished || 0);
  const totalCount = Number(summary?.total || items.length || 0);
  const successCount = Number(summary?.success || 0);
  const failedCount = Number(summary?.failed || 0);

  if (!items.length && !loading) {
    return (
      <div className='flex flex-col gap-3'>
        <Text>{tt('暂无 Codex 用量数据')}</Text>
        <div className='flex justify-end'>
          <Button size='small' type='primary' theme='outline' onClick={onRefresh}>
            {tt('刷新')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='flex flex-wrap items-center gap-2'>
          <Text type='tertiary' size='small'>
            {tt('共')} {totalCount} {tt('个账号，按用量从大到小排序')}
          </Text>
          <Tag color='blue'>
            {tt('已完成')} {finishedCount}/{totalCount}
          </Tag>
          <Tag color='green'>
            {tt('成功')} {successCount}
          </Tag>
          <Tag color='red'>
            {tt('失败')} {failedCount}
          </Tag>
        </div>
        <div className='flex items-center gap-2'>
          {loading ? <Spin size='small' spinning={true} /> : null}
          <Button size='small' type='tertiary' theme='borderless' onClick={onRefresh}>
            {tt('刷新')}
          </Button>
        </div>
      </div>
      <div className='flex flex-col gap-3 max-h-[70vh] overflow-auto pr-1'>
        {items.map((item, index) => {
          const rawText = JSON.stringify(item?.data ?? item, null, 2);
          const rateLimit = item?.data?.rate_limit ?? {};
          const primary = rateLimit?.primary_window ?? null;
          const secondary = rateLimit?.secondary_window ?? null;
          return (
            <div
              key={item.channel_id}
              className='rounded-lg border border-semi-color-border bg-semi-color-bg-0 p-4'
            >
              <div className='flex flex-wrap items-start justify-between gap-3'>
                <div className='flex flex-wrap items-center gap-2'>
                  <span className='font-medium'>#{index + 1}</span>
                  <span className='font-medium'>{item.channel_name || '-'}</span>
                  <Tag size='small' shape='circle'>ID {item.channel_id}</Tag>
                  <Tag color={item.success ? 'green' : item.finished ? 'red' : 'grey'}>
                    {item.success
                      ? tt('成功')
                      : item.finished
                        ? tt('失败')
                        : tt('加载中')}
                  </Tag>
                  <Tag color='blue'>
                    {tt('用量')} {formatUsageValue(item.usage_value)}
                  </Tag>
                </div>
                <div className='flex flex-wrap items-center gap-2 text-xs text-semi-color-text-2'>
                  <span>
                    {tt('上游状态码：')}
                    {item.finished ? item.upstream_status ?? '-' : '-'}
                  </span>
                  {item.message ? (
                    <Text type='danger' size='small'>
                      {item.message}
                    </Text>
                  ) : null}
                </div>
              </div>

              <div className='mt-3 grid grid-cols-1 gap-3 md:grid-cols-2'>
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

              <div className='mt-3'>
                <div className='mb-1 flex items-center justify-between gap-2'>
                  <div className='text-sm font-medium'>{tt('原始 JSON')}</div>
                  <Button
                    size='small'
                    type='primary'
                    theme='outline'
                    onClick={() => onCopy?.(rawText)}
                    disabled={!item.finished}
                  >
                    {tt('复制')}
                  </Button>
                </div>
                <pre className='max-h-[24vh] overflow-auto rounded-lg bg-semi-color-fill-0 p-3 text-xs text-semi-color-text-0'>
                  {item.finished ? rawText : tt('加载中...')}
                </pre>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const BulkCodexUsageLoader = ({ t, onCopy }) => {
  const tt = typeof t === 'function' ? t : (v) => v;
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    success: 0,
    failed: 0,
    finished: 0,
  });
  const mountedRef = useRef(true);
  const hasShownErrorRef = useRef(false);

  const normalizeSummary = useCallback((nextItems) => {
    let success = 0;
    let failed = 0;
    let finished = 0;
    nextItems.forEach((item) => {
      if (!item?.finished) return;
      finished += 1;
      if (item?.success) success += 1;
      else failed += 1;
    });
    return {
      total: nextItems.length,
      success,
      failed,
      finished,
    };
  }, []);

  const buildPlaceholderItems = useCallback((channelItems) => {
    return (channelItems || []).map((item) => ({
      channel_id: item.channel_id,
      channel_name: item.channel_name,
      channel_status: item.channel_status,
      success: false,
      finished: false,
      message: '',
      upstream_status: null,
      usage_value: 0,
      data: null,
    }));
  }, []);

  const sortItems = useCallback((nextItems) => {
    return [...nextItems].sort((a, b) => {
      const aUsage = Number(a?.usage_value || 0);
      const bUsage = Number(b?.usage_value || 0);
      if (aUsage === bUsage) {
        return Number(a?.channel_id || 0) - Number(b?.channel_id || 0);
      }
      return bUsage - aUsage;
    });
  }, []);

  const fetchUsage = useCallback(async () => {
    if (mountedRef.current) {
      setLoading(true);
      setItems([]);
      setSummary({ total: 0, success: 0, failed: 0, finished: 0 });
    }
    try {
      const res = await API.get('/api/channel/codex/usage/all', {
        skipErrorHandler: true,
        onDownloadProgress: (progressEvent) => {
          const xhr = progressEvent?.event?.target;
          const responseText = xhr?.responseText;
          if (!mountedRef.current || !responseText) return;
          const lastLine = responseText
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .pop();
          if (!lastLine) return;
          try {
            const parsed = JSON.parse(lastLine);
            const nextItems = sortItems(buildPlaceholderItems(parsed?.channels || []));
            setItems(nextItems);
            setSummary(normalizeSummary(nextItems));
          } catch (error) {}
        },
      });
      if (!mountedRef.current) return;
      const responseData = res?.data ?? null;
      const nextItems = sortItems(
        (responseData?.data || []).map((item) => ({
          ...item,
          finished: true,
        })),
      );
      setItems(nextItems);
      setSummary(
        responseData?.summary || normalizeSummary(nextItems),
      );
      if (!responseData?.success && !hasShownErrorRef.current) {
        hasShownErrorRef.current = true;
        showError(tt('获取全部用量失败'));
      }
    } catch (error) {
      if (!mountedRef.current) return;
      if (!hasShownErrorRef.current) {
        hasShownErrorRef.current = true;
        showError(tt('获取全部用量失败'));
      }
      setItems([]);
      setSummary({ total: 0, success: 0, failed: 0, finished: 0 });
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [buildPlaceholderItems, normalizeSummary, sortItems, tt]);

  useEffect(() => {
    mountedRef.current = true;
    fetchUsage().catch(() => {});
    return () => {
      mountedRef.current = false;
    };
  }, [fetchUsage]);

  return (
    <BulkCodexUsageList
      t={tt}
      items={items}
      summary={summary}
      loading={loading}
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

export const openBulkCodexUsageModal = ({ t, onCopy }) => {
  const tt = typeof t === 'function' ? t : (v) => v;

  Modal.info({
    title: tt('全部 Codex 用量'),
    centered: true,
    width: 1000,
    style: { maxWidth: '96vw' },
    content: <BulkCodexUsageLoader t={tt} onCopy={onCopy} />,
    footer: (
      <div className='flex justify-end gap-2'>
        <Button type='primary' theme='solid' onClick={() => Modal.destroyAll()}>
          {tt('关闭')}
        </Button>
      </div>
    ),
  });
};
