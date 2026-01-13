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

import React from 'react';
import { Modal, Button, Progress, Tag, Typography } from '@douyinfe/semi-ui';

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

const formatDurationSeconds = (seconds) => {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return '-';
  const total = Math.floor(s);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
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

const RateLimitWindowCard = ({ title, windowData }) => {
  const percent = clampPercent(windowData?.used_percent ?? 0);
  const resetAt = windowData?.reset_at;
  const resetAfterSeconds = windowData?.reset_after_seconds;
  const limitWindowSeconds = windowData?.limit_window_seconds;

  return (
    <div className='rounded-lg border border-semi-color-border bg-semi-color-bg-0 p-3'>
      <div className='flex items-center justify-between gap-2'>
        <div className='font-medium'>{title}</div>
        <Text type='tertiary' size='small'>
          Reset at: {formatUnixSeconds(resetAt)}
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
        <div>Used: {percent}%</div>
        <div>Time to reset: {formatDurationSeconds(resetAfterSeconds)}</div>
        <div>Window: {formatDurationSeconds(limitWindowSeconds)}</div>
      </div>
    </div>
  );
};

export const openCodexUsageModal = ({ t, record, payload, onCopy }) => {
  const data = payload?.data ?? null;
  const rateLimit = data?.rate_limit ?? {};

  const primary = rateLimit?.primary_window ?? null;
  const secondary = rateLimit?.secondary_window ?? null;

  const allowed = !!rateLimit?.allowed;
  const limitReached = !!rateLimit?.limit_reached;
  const upstreamStatus = payload?.upstream_status;

  const statusTag =
    allowed && !limitReached ? (
      <Tag color='green'>{t('Available')}</Tag>
    ) : (
      <Tag color='red'>{t('Limited')}</Tag>
    );

  const rawText =
    typeof data === 'string' ? data : JSON.stringify(data ?? payload, null, 2);

  Modal.info({
    title: (
      <div className='flex items-center gap-2'>
        <span>{t('Codex Usage')}</span>
        {statusTag}
      </div>
    ),
    centered: true,
    width: 900,
    style: { maxWidth: '95vw' },
    content: (
      <div className='flex flex-col gap-3'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <Text type='tertiary' size='small'>
            Channel: {record?.name || '-'} (ID: {record?.id || '-'})
          </Text>
          <Text type='tertiary' size='small'>
            Upstream status: {upstreamStatus ?? '-'}
          </Text>
        </div>

        <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
          <RateLimitWindowCard title={t('5-hour window')} windowData={primary} />
          <RateLimitWindowCard
            title={t('Weekly window')}
            windowData={secondary}
          />
        </div>

        <div>
          <div className='mb-1 flex items-center justify-between gap-2'>
            <div className='text-sm font-medium'>{t('Raw JSON')}</div>
            <Button
              size='small'
              type='primary'
              theme='outline'
              onClick={() => onCopy?.(rawText)}
              disabled={!rawText}
            >
              {t('Copy')}
            </Button>
          </div>
          <pre className='max-h-[50vh] overflow-auto rounded-lg bg-semi-color-fill-0 p-3 text-xs text-semi-color-text-0'>
            {rawText}
          </pre>
        </div>
      </div>
    ),
    footer: (
      <div className='flex justify-end gap-2'>
        <Button type='primary' theme='solid' onClick={() => Modal.destroyAll()}>
          {t('Close')}
        </Button>
      </div>
    ),
  });
};

