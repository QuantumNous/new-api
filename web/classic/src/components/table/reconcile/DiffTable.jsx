import React, { useMemo } from 'react';
import { Table, Tag, Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { diffKindTag } from './diffKind';

const { Text } = Typography;

// Format the hour bucket in Asia/Shanghai (the supplier's billing timezone),
// not the browser's local zone — otherwise admins in other timezones see
// hours shifted away from what the uploaded sheet says.
const billHourFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hour12: false,
});

// Show endpoint only ("05-16 20:00").
function fmtHour(unix) {
  if (!unix) return '-';
  const parts = billHourFmt.formatToParts(new Date(unix * 1000));
  const lookup = (type) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${lookup('month')}-${lookup('day')} ${lookup('hour')}:00`;
}

function fmtTokens(v) {
  if (v === undefined || v === null) return '0';
  return v.toLocaleString();
}

// Render one side's token usage. For per-count (计件) models — video/image
// tasks the supplier bills per 「个」 — the four text token fields are all 0,
// so show the count instead of a misleading "0 / 0 / 0 / 0".
function fmtSideTokens(s, t) {
  if (!s) return '—';
  const hasText =
    (s.tokens_input || 0) +
      (s.tokens_output || 0) +
      (s.tokens_cache_read || 0) +
      (s.tokens_cache_write || 0) >
    0;
  const count = s.tokens_count || 0;
  const textPart = `${fmtTokens(s.tokens_input)} / ${fmtTokens(
    s.tokens_output,
  )} / ${fmtTokens(s.tokens_cache_read)} / ${fmtTokens(s.tokens_cache_write)}`;
  if (count > 0 && !hasText) {
    return `${t('计件')} ${fmtTokens(count)}`;
  }
  if (count > 0) {
    return `${textPart} · ${t('计件')} ${fmtTokens(count)}`;
  }
  return textPart;
}

function fmtCny(v) {
  if (v === undefined || v === null) return '¥0.000000';
  const sign = v < 0 ? '-' : '';
  return `${sign}¥${Math.abs(v).toFixed(6)}`;
}

const STATUS_TAGS = {
  supplier_only: { color: 'red', textKey: '仅供应商' },
  local_only: { color: 'orange', textKey: '仅我方' },
  matched: { color: 'yellow', textKey: '有差异' },
};

// DiffTable renders the v3.1 detail rows. The backend has already aligned away
// the supplier's hour-bucket drift and dropped pure-drift buckets, so every
// row here is a genuine residual difference — no client-side window selector.
export default function DiffTable({ rows }) {
  const { t } = useTranslation();

  const data = useMemo(
    () => (rows || []).map((r, idx) => ({ ...r, _idx: idx })),
    [rows],
  );

  const columns = useMemo(
    () => [
      {
        title: t('时段'),
        dataIndex: 'hour_bucket',
        width: 150,
        render: (_, r) => {
          // Supplier billing drifts by ±1h; when this model was aligned by a
          // non-zero shift, show the supplier's original hour so the operator
          // sees it's the same traffic, not a new hour's difference.
          const shifted =
            r.align_shift_hours &&
            r.supplier_bucket &&
            r.supplier_bucket !== r.hour_bucket;
          return (
            <div className='flex flex-col'>
              <Text size='small'>{fmtHour(r.hour_bucket)}</Text>
              {shifted ? (
                <Text type='tertiary' size='small'>
                  {t('供方')} {fmtHour(r.supplier_bucket)}（
                  {t('对齐')} {r.align_shift_hours > 0 ? '+' : ''}
                  {r.align_shift_hours}h）
                </Text>
              ) : null}
            </div>
          );
        },
      },
      {
        title: t('模型'),
        dataIndex: 'model',
        width: 140,
        render: (v) => <Text>{v}</Text>,
      },
      {
        title: t('差异类型'),
        dataIndex: 'diff_kind',
        width: 110,
        render: (v, r) => {
          const kt = diffKindTag(v, t);
          if (kt) return <Tag color={kt.color}>{kt.label}</Tag>;
          const st = STATUS_TAGS[r.status];
          return st ? <Tag color={st.color}>{t(st.textKey)}</Tag> : '—';
        },
      },
      {
        title: t('供方 in/out/读/写'),
        width: 200,
        render: (_, r) =>
          r.supplier ? (
            <Text size='small'>{fmtSideTokens(r.supplier, t)}</Text>
          ) : (
            <Text type='tertiary'>—</Text>
          ),
      },
      {
        title: t('我方 in/out/读/写'),
        width: 200,
        render: (_, r) =>
          r.local ? (
            <Text size='small'>{fmtSideTokens(r.local, t)}</Text>
          ) : (
            <Text type='tertiary'>—</Text>
          ),
      },
      {
        title: t('供方¥'),
        width: 110,
        render: (_, r) => (r.supplier ? fmtCny(r.supplier.amount_cny) : '—'),
      },
      {
        title: t('我方¥'),
        width: 110,
        render: (_, r) => (r.local ? fmtCny(r.local.amount_cny) : '—'),
      },
      {
        title: t('Δ¥'),
        width: 110,
        render: (_, r) => {
          const v = r.delta?.amount_cny;
          if (!v) return '—';
          return (
            <Text type='danger' size='small'>
              {fmtCny(v)}
            </Text>
          );
        },
      },
      {
        title: t('累计Δ¥'),
        width: 130,
        render: (_, r) => {
          const v = r.cumulative_delta_amount_cny;
          const heavy = Math.abs(v) > 0.01;
          return (
            <Text type={heavy ? 'danger' : undefined} size='small'>
              {fmtCny(v)}
            </Text>
          );
        },
      },
      {
        title: t('区域'),
        dataIndex: 'regions',
        width: 160,
        render: (v) =>
          v && v.length ? (
            <Text size='small' type='tertiary' className='truncate'>
              {v.join(', ')}
            </Text>
          ) : (
            '—'
          ),
      },
    ],
    [t],
  );

  return (
    <Table
      columns={columns}
      dataSource={data}
      rowKey='_idx'
      pagination={{ pageSize: 50, showSizeChanger: false }}
      size='small'
      scroll={{ x: 'max-content' }}
      empty={t('对齐漂移后无真实差异')}
      rowClassName={(r) => {
        if (r.status === 'supplier_only') return 'reconcile-row-supplier-only';
        if (r.status === 'local_only') return 'reconcile-row-local-only';
        return '';
      }}
    />
  );
}
