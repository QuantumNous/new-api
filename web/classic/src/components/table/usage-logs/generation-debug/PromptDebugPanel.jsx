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

import React, { useMemo, useState } from 'react';
import { Button, Card, Tag, Typography } from '@douyinfe/semi-ui';
import { copy } from '../../../../helpers';
import JsonViewer from './JsonViewer';
import TokenMessageChart from './TokenMessageChart';
import {
  cacheStatusColor,
  cacheStatusLabel,
  confidenceLabel,
  derivePromptCacheView,
  formatTokens,
  normalizedPromptUnits,
  roleLabel,
  roleCountsFromMessages,
  sourceLabel,
  unitKindLabel,
} from './utils';

const MetricLine = ({ label, value, mono }) => (
  <div style={{ minWidth: 0 }}>
    <Typography.Text type='tertiary' size='small'>
      {label}
    </Typography.Text>
    <div
      style={{
        fontWeight: 600,
        fontFamily: mono ? 'monospace' : undefined,
        wordBreak: 'break-word',
      }}
    >
      {value}
    </div>
  </div>
);

const CacheBoundaryCard = ({
  prompt,
  providerPromptTokens,
  providerCachedTokens,
  cacheBoundary,
  t,
}) => {
  const accounting = prompt?.token_accounting;
  const promptTokens =
    providerPromptTokens ??
    accounting?.prompt_tokens ??
    prompt?.total_estimated_tokens ??
    0;
  const cachedTokens =
    providerCachedTokens ??
    accounting?.cached_tokens ??
    cacheBoundary?.cached_tokens ??
    0;
  const hitRate =
    cacheBoundary?.cache_hit_rate ??
    (promptTokens > 0 ? cachedTokens / promptTokens : 0);
  const providerConfidence =
    providerPromptTokens !== undefined
      ? 'exact'
      : (accounting?.confidence ?? 'estimated');
  const breakpoint = cacheBoundary?.break_unit_path
    ? `${cacheBoundary.break_unit_path} · ${t('offset')} ${formatTokens(cacheBoundary.break_offset_tokens)} ${t('estimated tokens')}`
    : t('No prompt field breakpoint');

  return (
    <Card bodyStyle={{ padding: 12 }} style={{ borderRadius: 8 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
        }}
      >
        <MetricLine
          label={t('Provider prompt tokens')}
          value={`${formatTokens(promptTokens)} ${confidenceLabel(providerConfidence, t)}`}
        />
        <MetricLine
          label={t('Provider cached tokens')}
          value={`${formatTokens(cachedTokens)} ${confidenceLabel(providerConfidence, t)}`}
        />
        <MetricLine
          label={t('Cache hit rate')}
          value={`${formatTokens(cachedTokens)} / ${formatTokens(promptTokens)} · ${hitRate.toLocaleString(
            undefined,
            {
              style: 'percent',
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            },
          )} ${t('exact-total / inferred-field')}`}
        />
        <MetricLine label={t('Breakpoint')} value={breakpoint} mono />
      </div>
      <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {accounting?.cache_write_tokens > 0 && (
          <Tag color='blue' size='small'>
            {t('Cache write tokens')}:{' '}
            {formatTokens(accounting.cache_write_tokens)} ·{' '}
            {confidenceLabel(
              accounting.cache_write_confidence ?? accounting.confidence,
              t,
            )}
          </Tag>
        )}
        {cachedTokens === 0 && (
          <Tag color='grey' size='small'>
            {t('No cache hit detected')}
          </Tag>
        )}
      </div>
    </Card>
  );
};

const UnitList = ({ units, selectedUnit, onSelectUnit, t }) => (
  <div
    style={{
      height: 'min(55vh, 560px)',
      overflow: 'auto',
      border: '1px solid var(--semi-color-border)',
      borderRadius: 8,
    }}
  >
    {units.map((unit) => (
      <button
        key={`${unit.index}-${unit.path}`}
        type='button'
        onClick={() => onSelectUnit(unit)}
        style={{
          width: '100%',
          display: 'block',
          textAlign: 'left',
          border: 0,
          borderBottom: '1px solid var(--semi-color-border)',
          background:
            selectedUnit?.index === unit.index
              ? 'var(--semi-color-fill-0)'
              : 'transparent',
          padding: 12,
          cursor: 'pointer',
        }}
      >
        <div
          style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexWrap: 'wrap',
            }}
          >
            <Typography.Text
              type='tertiary'
              size='small'
              style={{ fontFamily: 'monospace' }}
            >
              #{unit.index + 1}
            </Typography.Text>
            <Tag size='small'>{roleLabel(unit.role, t)}</Tag>
            <Tag color={cacheStatusColor(unit.cache_status)} size='small'>
              {cacheStatusLabel(unit.cache_status, t)}
            </Tag>
          </div>
          <Typography.Text type='tertiary' size='small'>
            ~{formatTokens(unit.estimated_tokens)} {t('tokens')}
          </Typography.Text>
        </div>
        <Typography.Text
          type='tertiary'
          size='small'
          ellipsis={{ showTooltip: true }}
          style={{ display: 'block', fontFamily: 'monospace', marginTop: 6 }}
        >
          {unit.path} ·{' '}
          {unit.confidence === 'inferred'
            ? t('field attribution inferred')
            : t('estimated tokens')}
        </Typography.Text>
        <Typography.Paragraph
          ellipsis={{ rows: 3, showTooltip: true }}
          style={{ margin: '6px 0 0', fontSize: 12 }}
        >
          {unit.content_preview || t('No text content')}
        </Typography.Paragraph>
      </button>
    ))}
  </div>
);

const UnitDetail = ({ unit, t }) => {
  const [copied, setCopied] = useState(false);
  if (!unit)
    return (
      <Typography.Text type='tertiary'>{t('No prompt data')}</Typography.Text>
    );

  const handleCopyPath = async () => {
    if (await copy(unit.path)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  };

  return (
    <Card
      bodyStyle={{ padding: 12 }}
      style={{ borderRadius: 8, height: '100%' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Tag>{roleLabel(unit.role, t)}</Tag>
          <Tag color={cacheStatusColor(unit.cache_status)}>
            {cacheStatusLabel(unit.cache_status, t)}
          </Tag>
          <Tag color='grey'>{confidenceLabel(unit.confidence, t)}</Tag>
        </div>
        <Button size='small' theme='borderless' onClick={handleCopyPath}>
          {copied ? t('Copied') : t('Copy path')}
        </Button>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
        }}
      >
        <MetricLine label={t('Path')} value={unit.path} mono />
        <MetricLine label={t('Kind')} value={unitKindLabel(unit.kind, t)} />
        <MetricLine
          label={t('Estimated tokens')}
          value={formatTokens(unit.estimated_tokens)}
        />
        <MetricLine
          label={t('Cumulative range')}
          value={`${formatTokens(unit.cumulative_start)} - ${formatTokens(unit.cumulative_end)}`}
        />
        <MetricLine
          label={t('Cache overlap')}
          value={formatTokens(unit.cache_overlap_tokens)}
        />
        <MetricLine
          label={t('Cache source')}
          value={sourceLabel(unit.cache_source, t)}
        />
      </div>
      <div
        style={{
          marginTop: 12,
          maxHeight: 'min(38vh, 360px)',
          overflow: 'auto',
          border: '1px solid var(--semi-color-border)',
          borderRadius: 8,
          padding: 12,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontSize: 12,
        }}
      >
        {unit.content_preview || t('No text content')}
      </div>
    </Card>
  );
};

const PromptDebugPanel = ({
  prompt,
  rawRequest,
  providerPromptTokens,
  providerCachedTokens,
  t,
}) => {
  const [selectedUnitIndex, setSelectedUnitIndex] = useState(0);
  const [showRawRequest, setShowRawRequest] = useState(false);
  const baseUnits = useMemo(() => normalizedPromptUnits(prompt), [prompt]);
  const cacheView = useMemo(
    () =>
      derivePromptCacheView(
        baseUnits,
        providerPromptTokens ?? prompt?.token_accounting?.prompt_tokens ?? 0,
        providerCachedTokens ?? prompt?.token_accounting?.cached_tokens ?? 0,
        prompt?.cache_boundary,
      ),
    [baseUnits, prompt, providerCachedTokens, providerPromptTokens],
  );
  const units = cacheView.units;
  const selectedUnit = units[selectedUnitIndex] ?? units[0];
  const roleCounts = useMemo(() => {
    if (prompt?.role_counts && Object.keys(prompt.role_counts).length > 0) {
      return prompt.role_counts;
    }
    return roleCountsFromMessages(prompt?.messages ?? []);
  }, [prompt]);

  if (!prompt && !rawRequest) {
    return (
      <Typography.Text type='tertiary'>{t('No prompt data')}</Typography.Text>
    );
  }

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}
    >
      <CacheBoundaryCard
        prompt={prompt}
        providerPromptTokens={providerPromptTokens}
        providerCachedTokens={providerCachedTokens}
        cacheBoundary={cacheView.boundary}
        t={t}
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(420px, 0.9fr) minmax(520px, 1.1fr)',
          gap: 12,
          minWidth: 0,
        }}
        className='generation-debug-classic-grid'
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            minWidth: 0,
          }}
        >
          <TokenMessageChart
            units={units}
            cacheBoundary={cacheView.boundary}
            t={t}
          />
          <Card bodyStyle={{ padding: 12 }} style={{ borderRadius: 8 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(roleCounts).map(([role, count]) => (
                <Tag key={role} size='small'>
                  {roleLabel(role, t)} · {count}
                </Tag>
              ))}
            </div>
          </Card>
          <UnitList
            units={units}
            selectedUnit={selectedUnit}
            onSelectUnit={(unit) => {
              setShowRawRequest(false);
              const position = units.findIndex(
                (candidate) =>
                  candidate.index === unit.index &&
                  candidate.path === unit.path,
              );
              setSelectedUnitIndex(Math.max(position, 0));
            }}
            t={t}
          />
        </div>
        <div style={{ minWidth: 0 }}>
          {rawRequest && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
                marginBottom: 8,
              }}
            >
              <Typography.Text strong>
                {t('Selected prompt field')}
              </Typography.Text>
              <Button
                size='small'
                theme={showRawRequest ? 'solid' : 'borderless'}
                onClick={() => setShowRawRequest((value) => !value)}
              >
                {showRawRequest
                  ? t('Show selected field')
                  : t('Show raw request')}
              </Button>
            </div>
          )}
          {showRawRequest && rawRequest ? (
            <JsonViewer value={rawRequest.value} rawMeta={rawRequest} t={t} />
          ) : (
            <UnitDetail unit={selectedUnit} t={t} />
          )}
        </div>
      </div>
      <style>
        {`@media (max-width: 1100px) {
          .generation-debug-classic-grid {
            grid-template-columns: 1fr !important;
          }
        }`}
      </style>
    </div>
  );
};

export default PromptDebugPanel;
