import React, { useMemo, useState } from 'react';
import { Select, Space, Table, Tag, Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';

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

const billDayFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  month: '2-digit',
  day: '2-digit',
});

// Strict-hour display: show endpoint only ("05-16 20:00").
function fmtHour(unix) {
  if (!unix) return '-';
  const parts = billHourFmt.formatToParts(new Date(unix * 1000));
  const lookup = (type) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${lookup('month')}-${lookup('day')} ${lookup('hour')}:00`;
}

// Aggregated row display: show the actual [windowStart, windowEnd] span
// the sliding window produced. A row whose window collapsed to a single
// hour gets "20:00" — same as strict mode; a row covering multiple hours
// gets "18-21" so the operator sees what was bundled.
function fmtWindow(windowStart, windowEnd) {
  if (!windowEnd) return '-';
  const endParts = billHourFmt.formatToParts(new Date(windowEnd * 1000));
  const lookupEnd = (type) => endParts.find((p) => p.type === type)?.value ?? '00';
  if (!windowStart || windowEnd - windowStart <= 3600) {
    return `${lookupEnd('month')}-${lookupEnd('day')} ${lookupEnd('hour')}:00`;
  }
  const startParts = billHourFmt.formatToParts(new Date(windowStart * 1000));
  const lookupStart = (type) => startParts.find((p) => p.type === type)?.value ?? '00';
  // If the window spans across midnight or different days, still keep the
  // end date — drift normally stays within a few hours so this is rare.
  return `${lookupEnd('month')}-${lookupEnd('day')} ${lookupStart('hour')}-${lookupEnd('hour')}`;
}

function fmtTokens(v) {
  if (v === undefined || v === null) return '0';
  return v.toLocaleString();
}

function fmtCny(v) {
  if (v === undefined || v === null) return '¥0.000000';
  const sign = v < 0 ? '-' : '';
  return `${sign}¥${Math.abs(v).toFixed(6)}`;
}

const MATCHED_DELTA_THRESHOLD_CNY = 0.01;

const STATUS_TAGS = {
  supplier_only: { color: 'red', textKey: '仅供应商' },
  local_only: { color: 'orange', textKey: '仅我方' },
};

function statusTag(r, t) {
  if (r.status === 'matched') {
    const dAmount = Math.abs(r.delta?.amount_cny || 0);
    const dTokens =
      Math.abs(r.delta?.tokens_input || 0) +
      Math.abs(r.delta?.tokens_output || 0) +
      Math.abs(r.delta?.tokens_cache_read || 0) +
      Math.abs(r.delta?.tokens_cache_write || 0) +
      Math.abs(r.delta?.tokens_count || 0);
    if (dAmount < MATCHED_DELTA_THRESHOLD_CNY && dTokens === 0) {
      return { color: 'green', label: t('一致') };
    }
    return { color: 'yellow', label: t('有差异') };
  }
  const tag = STATUS_TAGS[r.status] || { color: 'grey', textKey: r.status };
  return { color: tag.color, label: t(tag.textKey) };
}

// Roll up rows into wider time windows on the client side. The reason this
// exists: even after backend aggregation, supplier 落盘漂移 means a request
// recorded at HH:30 may end up in the supplier's HH bucket or HH+1 bucket
// essentially at random. With windowHours=1 the diff table looks inconsistent
// (supplier_only / local_only paired with adjacent rows that cancel out).
// Widening the window 1h → 2h → 4h → 24h collapses those drifted pairs.
//
// Algorithm: **per-model sliding window**. An absolute-aligned bucket like
// `ceil(t / windowSecs) * windowSecs` doesn't work — a 20:00 ↔ 21:00 drift
// pair sits on opposite sides of the 2h alignment boundary (20:00 ∈ [18,20),
// 21:00 ∈ [20,22)) and stays unmerged, defeating the whole point. Instead,
// for each model sort rows by hour_bucket, then greedily extend a window
// while subsequent rows are within `windowSecs` of the window's start.
function aggregateRowsByWindow(rows, windowHours) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  if (windowHours <= 1) return rows;
  const windowSecs = windowHours * 3600;

  const emptySide = () => ({
    tokens_input: 0,
    tokens_output: 0,
    tokens_cache_read: 0,
    tokens_cache_write: 0,
    tokens_count: 0,
    amount_cny: 0,
    request_count: 0,
  });
  const addSide = (a, b) => {
    a.tokens_input += b.tokens_input || 0;
    a.tokens_output += b.tokens_output || 0;
    a.tokens_cache_read += b.tokens_cache_read || 0;
    a.tokens_cache_write += b.tokens_cache_write || 0;
    a.tokens_count += b.tokens_count || 0;
    a.amount_cny += b.amount_cny || 0;
    a.request_count += b.request_count || 0;
  };

  // Group by model so the sliding window is independent per model.
  const byModel = new Map();
  for (const r of rows) {
    if (!byModel.has(r.model)) byModel.set(r.model, []);
    byModel.get(r.model).push(r);
  }

  const windows = [];
  for (const [model, modelRows] of byModel) {
    modelRows.sort((a, b) => a.hour_bucket - b.hour_bucket);
    let cur = null;
    const close = () => {
      if (cur) windows.push(cur);
      cur = null;
    };
    const start = (r) => {
      cur = {
        model,
        windowStart: r.hour_bucket - 3600, // hour_bucket is endpoint of [start-1h, start)
        windowEnd: r.hour_bucket,
        supplier: null,
        local: null,
        delta: emptySide(),
        regions: new Set(),
      };
      mergeRow(cur, r);
    };
    const extend = (r) => {
      cur.windowEnd = r.hour_bucket;
      mergeRow(cur, r);
    };
    const mergeRow = (w, r) => {
      if (r.supplier) {
        if (!w.supplier) w.supplier = emptySide();
        addSide(w.supplier, r.supplier);
      }
      if (r.local) {
        if (!w.local) w.local = emptySide();
        addSide(w.local, r.local);
      }
      addSide(w.delta, r.delta || {});
      (r.regions || []).forEach((reg) => w.regions.add(reg));
    };
    for (const r of modelRows) {
      if (cur === null) {
        start(r);
      } else if (r.hour_bucket - cur.windowStart <= windowSecs) {
        extend(r);
      } else {
        close();
        start(r);
      }
    }
    close();
  }

  // Sort by window end (= "owns up to this time") then model.
  windows.sort((a, b) => {
    if (a.windowEnd !== b.windowEnd) return a.windowEnd - b.windowEnd;
    return a.model.localeCompare(b.model);
  });

  // Re-derive status + cumulative Δ¥ over the new row order.
  let cum = 0;
  for (const w of windows) {
    cum += w.delta.amount_cny || 0;
    w.cumulative_delta_amount_cny = cum;
    if (w.supplier && w.local) w.status = 'matched';
    else if (w.supplier) w.status = 'supplier_only';
    else w.status = 'local_only';
    w.regions = [...w.regions].sort();
    // Keep `hour_bucket` for fmtBucket compatibility (= end of window).
    w.hour_bucket = w.windowEnd;
  }
  return windows;
}

// Default to 2-hour windows: the supplier (parallel) drifts requests by up
// to ±1 hour, so a 2h window captures most drift pairs without losing too
// much temporal resolution. Admins can switch to 1h for forensic detail or
// 4h / 全天 if drift is wider.
const DEFAULT_WINDOW_HOURS = 2;

// DiffTable renders the per-(model, time-window) diff rows.
export default function DiffTable({ rows }) {
  const { t } = useTranslation();
  const [windowHours, setWindowHours] = useState(DEFAULT_WINDOW_HOURS);

  const enrichedRows = useMemo(() => {
    const merged = aggregateRowsByWindow(rows || [], windowHours);
    return merged.map((r, idx) => ({ ...r, _idx: idx }));
  }, [rows, windowHours]);

  const columns = useMemo(
    () => [
      {
        title: windowHours <= 1 ? t('小时') : t('时段'),
        dataIndex: 'hour_bucket',
        width: 140,
        render: (_, r) =>
          windowHours <= 1
            ? fmtHour(r.hour_bucket)
            : fmtWindow(r.windowStart, r.windowEnd),
      },
      {
        title: t('模型'),
        dataIndex: 'model',
        width: 140,
        render: (v) => <Text>{v}</Text>,
      },
      {
        title: t('状态'),
        dataIndex: 'status',
        width: 100,
        render: (_, r) => {
          const tag = statusTag(r, t);
          return <Tag color={tag.color}>{tag.label}</Tag>;
        },
      },
      {
        title: t('供方 in/out/读/写'),
        width: 200,
        render: (_, r) => {
          if (!r.supplier) return <Text type='tertiary'>—</Text>;
          const s = r.supplier;
          return (
            <Text size='small'>
              {fmtTokens(s.tokens_input)} / {fmtTokens(s.tokens_output)} /{' '}
              {fmtTokens(s.tokens_cache_read)} /{' '}
              {fmtTokens(s.tokens_cache_write)}
            </Text>
          );
        },
      },
      {
        title: t('我方 in/out/读/写'),
        width: 200,
        render: (_, r) => {
          if (!r.local) return <Text type='tertiary'>—</Text>;
          const s = r.local;
          return (
            <Text size='small'>
              {fmtTokens(s.tokens_input)} / {fmtTokens(s.tokens_output)} /{' '}
              {fmtTokens(s.tokens_cache_read)} /{' '}
              {fmtTokens(s.tokens_cache_write)}
            </Text>
          );
        },
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
          const heavy = Math.abs(v) > 0.01;
          return (
            <Text type={heavy ? 'danger' : undefined} size='small'>
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
    [t, windowHours],
  );

  const windowOptions = [
    { label: t('严格小时'), value: 1 },
    { label: t('2 小时窗口（消化漂移）'), value: 2 },
    { label: t('4 小时窗口'), value: 4 },
    { label: t('全天合并'), value: 24 },
  ];

  return (
    <div className='flex flex-col gap-2'>
      <div className='flex justify-end'>
        <Space>
          <Text type='tertiary' size='small'>
            {t('明细合并')}
          </Text>
          <Select
            value={windowHours}
            onChange={setWindowHours}
            optionList={windowOptions}
            size='small'
            style={{ width: 220 }}
          />
        </Space>
      </div>
      <Table
        columns={columns}
        dataSource={enrichedRows}
        rowKey='_idx'
        pagination={{ pageSize: 50, showSizeChanger: false }}
        size='small'
        scroll={{ x: 'max-content' }}
        rowClassName={(r) => {
          if (r.status === 'supplier_only') return 'reconcile-row-supplier-only';
          if (r.status === 'local_only') return 'reconcile-row-local-only';
          return '';
        }}
      />
    </div>
  );
}
