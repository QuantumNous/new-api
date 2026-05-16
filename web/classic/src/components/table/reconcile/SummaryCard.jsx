import React from 'react';
import { Tag, Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

// Render in the supplier billing timezone (Asia/Shanghai), not the browser
// timezone — admin sees the same hour the uploaded sheet shows.
const summaryTimeFmt = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function fmtTime(unix) {
  if (!unix) return '-';
  return summaryTimeFmt.format(new Date(unix * 1000));
}

function fmtCny(v) {
  if (v === undefined || v === null) return '¥0.00';
  const sign = v < 0 ? '-' : '';
  return `${sign}¥${Math.abs(v).toFixed(2)}`;
}

const VERDICT_TAGS = {
  ok_drift_only: { color: 'green', textKey: '仅漂移，对账通过' },
  needs_attention: { color: 'orange', textKey: '需关注' },
  diverging: { color: 'red', textKey: '差异发散，建议排查' },
};

export default function SummaryCard({ summary, drift }) {
  const { t } = useTranslation();
  if (!summary) return null;

  const tag = VERDICT_TAGS[drift?.verdict] || { color: 'grey', textKey: '-' };

  return (
    <div className='flex flex-col gap-2'>
      <div className='flex flex-wrap items-center gap-3'>
        <Text strong>{t('对账区间')}：</Text>
        <Text>
          {fmtTime(summary.from)} — {fmtTime(summary.to)}
        </Text>
        <Tag color={tag.color}>{t(tag.textKey)}</Tag>
      </div>

      <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
        <div>
          <Text type='tertiary' size='small'>
            {t('供应商总额')}
          </Text>
          <div className='text-lg font-semibold'>
            {fmtCny(summary.supplier_total?.amount_cny)}
          </div>
        </div>
        <div>
          <Text type='tertiary' size='small'>
            {t('我方总额')}
          </Text>
          <div className='text-lg font-semibold'>
            {fmtCny(summary.local_total?.amount_cny)}
          </div>
        </div>
        <div>
          <Text type='tertiary' size='small'>
            {t('差额（供应商 − 我方）')}
          </Text>
          <div
            className={`text-lg font-semibold ${
              Math.abs(summary.delta?.amount_cny || 0) > 0.01
                ? 'text-red-500'
                : ''
            }`}
          >
            {fmtCny(summary.delta?.amount_cny)}
            {summary.delta_amount_pct !== undefined && (
              <Text type='tertiary' size='small' className='ml-2'>
                ({(summary.delta_amount_pct * 100).toFixed(3)}%)
              </Text>
            )}
          </div>
        </div>
        <div>
          <Text type='tertiary' size='small'>
            {t('累计差额末值 / 最大')}
          </Text>
          <div className='text-lg font-semibold'>
            {fmtCny(drift?.final_cumulative_delta)} /{' '}
            <Text type='tertiary'>
              {fmtCny(drift?.max_abs_cumulative_delta)}
            </Text>
          </div>
        </div>
      </div>

      <div className='flex flex-wrap gap-2 mt-1'>
        <Tag color='blue'>
          {t('模型数')} {summary.models_count}
        </Tag>
        <Tag color='blue'>
          {t('行数')} {summary.rows_count}
        </Tag>
        <Tag color={summary.supplier_only_rows ? 'red' : 'grey'}>
          {t('仅供应商')} {summary.supplier_only_rows}
        </Tag>
        <Tag color={summary.local_only_rows ? 'orange' : 'grey'}>
          {t('仅我方')} {summary.local_only_rows}
        </Tag>
        {summary.parse_errors_count > 0 && (
          <Tag color='red'>
            {t('解析错误')} {summary.parse_errors_count}
          </Tag>
        )}
      </div>
    </div>
  );
}
