import React, { useMemo } from 'react';
import { Table, Tag, Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';

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
    const out = [];
    (byModel || []).forEach((m) => {
      m.kinds.forEach((k) => {
        out.push({
          _key: `${m.model}__${k.kind}`,
          model: m.model,
          kind: k.kind,
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
        width: 160,
        render: (v, r) => (r.kind === 'input' || r.kind === 'amount' ? v : ''),
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
