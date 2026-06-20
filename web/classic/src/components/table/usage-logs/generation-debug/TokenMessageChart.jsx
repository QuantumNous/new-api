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
import { Card, Typography } from '@douyinfe/semi-ui';
import {
  cacheStatusBackground,
  cacheStatusLabel,
  confidenceLabel,
  formatTokens,
  roleLabel,
} from './utils';

const unitHitRate = (unit) =>
  unit.estimated_tokens > 0
    ? unit.cache_overlap_tokens / unit.estimated_tokens
    : 0;

const TokenMessageChart = ({ units, cacheBoundary, t }) => {
  if (!units?.length) return null;
  const maxTokens = Math.max(
    ...units.map((unit) => unit.estimated_tokens || 0),
    1,
  );

  return (
    <Card
      bodyStyle={{ padding: 12 }}
      style={{ borderRadius: 8 }}
      title={
        <div
          style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}
        >
          <Typography.Text strong>
            {t('Tokens per prompt field')}
          </Typography.Text>
          <Typography.Text type='tertiary' size='small'>
            {t('Field attribution is inferred')}
          </Typography.Text>
        </div>
      }
    >
      <div style={{ display: 'flex', alignItems: 'end', gap: 6, height: 116 }}>
        {units.map((unit) => {
          const height = Math.max(
            6,
            Math.round(((unit.estimated_tokens || 0) / maxTokens) * 96),
          );
          const isBreakpoint = cacheBoundary?.break_unit_index === unit.index;
          const hitRate = unitHitRate(unit);
          const hitPercent = Math.min(100, Math.max(0, hitRate * 100));
          const tooltip = [
            `${t('Path')}: ${unit.path}`,
            `${t('Role')}: ${roleLabel(unit.role, t)}`,
            `${t('Estimated tokens')}: ${formatTokens(unit.estimated_tokens)}`,
            `${t('Cumulative range')}: ${formatTokens(unit.cumulative_start)} - ${formatTokens(unit.cumulative_end)}`,
            `${t('Cache status')}: ${cacheStatusLabel(unit.cache_status, t)}`,
            `${t('Cache overlap')}: ${formatTokens(unit.cache_overlap_tokens)}`,
            `${t('Field cache hit rate')}: ${hitRate.toLocaleString(undefined, {
              style: 'percent',
              maximumFractionDigits: 1,
            })}`,
            `${t('Confidence')}: ${confidenceLabel(unit.confidence, t)}`,
          ].join('\n');
          const background =
            unit.cache_status === 'partial'
              ? `linear-gradient(to top, ${cacheStatusBackground('hit')} 0%, ${cacheStatusBackground('hit')} ${hitPercent}%, ${cacheStatusBackground('partial')} ${hitPercent}%, ${cacheStatusBackground('partial')} 100%)`
              : cacheStatusBackground(unit.cache_status);
          return (
            <div
              key={`${unit.index}-${unit.path}`}
              title={tooltip}
              style={{
                flex: '1 1 18px',
                minWidth: 12,
                maxWidth: 42,
                height,
                borderRadius: '4px 4px 0 0',
                background,
                opacity: unit.cache_status === 'miss' ? 0.55 : 0.95,
                borderLeft: isBreakpoint
                  ? '2px solid var(--semi-color-danger)'
                  : undefined,
              }}
            />
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
        {['hit', 'partial', 'miss', 'unknown'].map((status) => (
          <Typography.Text key={status} type='tertiary' size='small'>
            <span
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: 999,
                marginRight: 4,
                background: cacheStatusBackground(status),
              }}
            />
            {cacheStatusLabel(status, t)}
          </Typography.Text>
        ))}
        {cacheBoundary?.break_unit_path && (
          <Typography.Text type='tertiary' size='small'>
            {t('Breakpoint')}: {cacheBoundary.break_unit_path} · {t('offset')}{' '}
            {formatTokens(cacheBoundary.break_offset_tokens)} {t('tokens')}
          </Typography.Text>
        )}
      </div>
    </Card>
  );
};

export default TokenMessageChart;
