import React, { useMemo } from 'react';
import { Card, Typography } from '@douyinfe/semi-ui';
import { VChart } from '@visactor/react-vchart';
import { BarChart3, Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatTokens } from '../../helpers/rankings';
import { getLobeIcon } from '../../helpers/lobeIcon';
import GrowthText from './GrowthText';

const { Title, Text } = Typography;
const CHART_CONFIG = { mode: 'desktop-browser' };

const PERIOD_DESCRIPTIONS = {
  today: '过去24小时各模型的Token使用量',
  week: '过去一周各模型的Token使用量',
  month: '过去一个月各模型的每日Token使用量',
  year: '过去一年各模型的每周Token使用量',
  all: '所有时间各模型的Token使用量',
};

export default function ModelsSection({ history, rows, period }) {
  const { t } = useTranslation();

  const orderedPoints = useMemo(() => {
    if (!history?.points) return [];
    const order = new Map(history.models.map((m, idx) => [m.name, idx]));
    return [...history.points].sort((a, b) => {
      const tsCmp = a.ts.localeCompare(b.ts);
      if (tsCmp !== 0) return tsCmp;
      return (order.get(a.model) ?? 999) - (order.get(b.model) ?? 999);
    });
  }, [history]);

  const totalTokens = useMemo(
    () => rows.reduce((s, r) => s + r.total_tokens, 0),
    [rows]
  );

  const spec = useMemo(() => {
    if (orderedPoints.length === 0) return null;
    return {
      type: 'bar',
      data: [{ id: 'models-history', values: orderedPoints }],
      xField: 'label',
      yField: 'tokens',
      seriesField: 'model',
      stack: true,
      legends: { visible: false },
      axes: [
        { orient: 'bottom', label: { autoHide: true, autoLimit: true }, tick: { visible: false } },
        {
          orient: 'left',
          label: { formatMethod: (val) => formatTokens(Number(val)) },
          grid: { visible: true, style: { lineDash: [3, 3] } },
        },
      ],
      tooltip: {
        dimension: {
          title: { value: (datum) => String(datum?.label ?? '') },
          content: [{ key: (datum) => String(datum?.model ?? ''), value: (datum) => Number(datum?.tokens) || 0 }],
          updateContent: (array) => {
            array.sort((a, b) => Number(b.value) - Number(a.value));
            const sum = array.reduce((s, x) => s + (Number(x.value) || 0), 0);
            const visible = array.slice(0, 10);
            const overflow = array.slice(10);
            const result = visible.map((item) => ({ key: item.key, value: formatTokens(Number(item.value) || 0) }));
            if (overflow.length > 0) {
              const otherSum = overflow.reduce((s, item) => s + (Number(item.value) || 0), 0);
              result.push({ key: `+${overflow.length} more`, value: formatTokens(otherSum) });
            }
            result.unshift({ key: t('合计'), value: formatTokens(sum) });
            return result;
          },
        },
      },
      animationAppear: { duration: 500 },
    };
  }, [orderedPoints, t]);

  const half = Math.ceil(rows.length / 2);
  const leftRows = rows.slice(0, half);
  const rightRows = rows.slice(half);

  return (
    <Card className='!rounded-2xl'>
      <div className='flex items-start justify-between gap-4 mb-4'>
        <div>
          <Title heading={5} className='flex items-center gap-2 !mb-1'>
            <BarChart3 size={16} className='text-semi-color-primary' />
            {t('热门模型')}
          </Title>
          <Text type='tertiary' size='small'>{t(PERIOD_DESCRIPTIONS[period])}</Text>
        </div>
        <div className='text-right'>
          <Title heading={3} className='!mb-0 font-mono'>{formatTokens(totalTokens)}</Title>
          <Text type='tertiary' size='small' style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>tokens</Text>
        </div>
      </div>

      <div className='h-64 md:h-72'>
        {spec ? (
          <VChart key={`models-${period}`} spec={spec} option={CHART_CONFIG} />
        ) : (
          <div className='flex items-center justify-center h-full'>
            <Text type='tertiary'>{t('暂无历史数据')}</Text>
          </div>
        )}
      </div>

      <div className='border-t border-semi-color-border mt-4 pt-4'>
        <Title heading={6} className='flex items-center gap-2 !mb-1'>
          <Trophy size={14} style={{ color: '#eab308' }} />
          {t('模型排行')}
        </Title>
        <Text type='tertiary' size='small'>{t('平台上最受欢迎的模型')}</Text>

        {rows.length === 0 ? (
          <div className='text-center py-8'>
            <Text type='tertiary'>{t('暂无数据')}</Text>
          </div>
        ) : (
          <div className='grid grid-cols-1 md:grid-cols-2 gap-x-8 mt-3'>
            <ModelList rows={leftRows} />
            {rightRows.length > 0 && <ModelList rows={rightRows} />}
          </div>
        )}
      </div>
    </Card>
  );
}

function ModelList({ rows }) {
  return (
    <ul className='list-none p-0 m-0'>
      {rows.map((row) => (
        <li key={row.model_name} className='flex items-center gap-3 py-2.5 border-b border-semi-color-border last:border-0'>
          <span className='w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0' style={{
            backgroundColor: row.rank <= 3 ? 'var(--semi-color-primary-light-default)' : 'var(--semi-color-fill-0)',
            color: row.rank <= 3 ? 'var(--semi-color-primary)' : 'var(--semi-color-text-2)',
          }}>{row.rank}</span>
          {getLobeIcon(row.vendor_icon, 22)}
          <div className='flex-1 min-w-0'>
            <div className='text-sm font-medium font-mono truncate' style={{ color: 'var(--semi-color-text-0)' }}>{row.model_name}</div>
            <div className='text-xs truncate' style={{ color: 'var(--semi-color-text-2)' }}>{row.vendor.toLowerCase()}</div>
          </div>
          <div className='text-right'>
            <div className='text-sm font-semibold font-mono'>{formatTokens(row.total_tokens)}</div>
            <GrowthText value={row.growth_pct} />
          </div>
        </li>
      ))}
    </ul>
  );
}
