import React, { useMemo } from 'react';
import { Table, Tag, Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { diffKindTag } from './diffKind';

const { Text } = Typography;

const KIND_LABELS = {
  input: '输入',
  output: '输出',
  cache_read: '缓存读取',
  cache_write: '缓存写入',
  count: '计件',
};

function fmtTokens(v) {
  if (v === undefined || v === null) return '0';
  return v.toLocaleString();
}

function fmtCny(v) {
  if (v === undefined || v === null) return '¥0.000000';
  const sign = v < 0 ? '-' : '';
  return `${sign}¥${Math.abs(v).toFixed(6)}`;
}

// Flatten by_model → one Table row per (model, kind), plus a model-level
// amount row at the end of each model's group. Easier to scan than a
// nested table and Semi Table doesn't natively render group headers.
export default function ByModelTable({ byModel }) {
  const { t } = useTranslation();

  const data = useMemo(() => {
    // Biggest amount contributors first, so the models driving the total gap
    // sit at the top instead of being buried in alphabetical order.
    const sorted = [...(byModel || [])].sort(
      (a, b) =>
        Math.abs(b.delta_amount_cny || 0) - Math.abs(a.delta_amount_cny || 0),
    );
    const out = [];
    sorted.forEach((m) => {
      m.kinds.forEach((k) => {
        out.push({
          _key: `${m.model}__${k.kind}`,
          model: m.model,
          kind: k.kind,
          diffKind: m.diff_kind,
          sup: k.supplier_tokens,
          loc: k.local_tokens,
          delta: k.delta_tokens,
          deltaPct: k.delta_pct,
          isAmount: false,
        });
      });
      out.push({
        _key: `${m.model}__amount`,
        model: m.model,
        kind: 'amount',
        diffKind: m.diff_kind,
        sup: m.supplier_amount_cny,
        loc: m.local_amount_cny,
        delta: m.delta_amount_cny,
        isAmount: true,
      });
    });
    return out;
  }, [byModel]);

  const columns = useMemo(
    () => [
      {
        title: t('模型'),
        dataIndex: 'model',
        width: 220,
        render: (v, r) => {
          // Only label the model on its amount row (last row of the group),
          // so the diff_kind tag appears once per model.
          if (!r.isAmount) return r.kind === 'input' ? v : '';
          const kt = diffKindTag(r.diffKind, t);
          return (
            <div className='flex items-center gap-2'>
              <Text>{v}</Text>
              {kt && <Tag color={kt.color}>{kt.label}</Tag>}
            </div>
          );
        },
      },
      {
        title: t('维度'),
        dataIndex: 'kind',
        width: 120,
        render: (v, r) =>
          r.isAmount ? (
            <Tag color='blue'>{t('合计金额')}</Tag>
          ) : (
            <Text>{t(KIND_LABELS[v] || v)}</Text>
          ),
      },
      {
        title: t('供方'),
        dataIndex: 'sup',
        width: 140,
        render: (v, r) => (r.isAmount ? fmtCny(v) : fmtTokens(v)),
      },
      {
        title: t('我方'),
        dataIndex: 'loc',
        width: 140,
        render: (v, r) => (r.isAmount ? fmtCny(v) : fmtTokens(v)),
      },
      {
        title: t('差额'),
        dataIndex: 'delta',
        width: 140,
        render: (v, r) => {
          if (r.isAmount) {
            return (
              <Text type={Math.abs(v) > 0.01 ? 'danger' : undefined}>
                {fmtCny(v)}
              </Text>
            );
          }
          return (
            <Text type={v !== 0 ? 'danger' : undefined}>{fmtTokens(v)}</Text>
          );
        },
      },
      {
        title: t('差额%'),
        dataIndex: 'deltaPct',
        width: 100,
        render: (v, r) => {
          if (r.isAmount || v === undefined || v === null) return '—';
          return `${(v * 100).toFixed(2)}%`;
        },
      },
    ],
    [t],
  );

  return (
    <Table
      columns={columns}
      dataSource={data}
      rowKey='_key'
      pagination={false}
      size='small'
      scroll={{ x: 'max-content' }}
      rowClassName={(r) => (r.isAmount ? 'reconcile-by-model-amount-row' : '')}
    />
  );
}
