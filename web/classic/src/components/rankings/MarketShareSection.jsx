import React, { useMemo } from 'react';
import { Card, Typography } from '@douyinfe/semi-ui';
import { VChart } from '@visactor/react-vchart';
import { PieChart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatTokens, formatShare } from '../../helpers/rankings';

const { Title, Text } = Typography;
const CHART_CONFIG = { mode: 'desktop-browser' };

const VENDOR_COLOURS = {
  OpenAI: '#10a37f', Anthropic: '#d97757', Google: '#4285f4', DeepSeek: '#7c5cff',
  Alibaba: '#ff9900', xAI: '#1f2937', Meta: '#1877f2', Moonshot: '#ec4899',
  Zhipu: '#06b6d4', Mistral: '#ff7000', ByteDance: '#3b82f6', Tencent: '#22c55e',
  MiniMax: '#a855f7', Cohere: '#fb923c', Baidu: '#ef4444', Others: '#94a3b8',
};

const FALLBACK_PALETTE = ['#0ea5e9','#22c55e','#a855f7','#f97316','#14b8a6','#eab308','#ec4899','#84cc16','#6366f1','#10b981','#f43f5e','#0891b2','#94a3b8'];

function buildColourMap(names) {
  const result = {};
  let fi = 0;
  for (const name of names) {
    result[name] = VENDOR_COLOURS[name] || FALLBACK_PALETTE[fi++ % FALLBACK_PALETTE.length];
  }
  return result;
}

const PERIOD_DESCRIPTIONS = {
  today: '过去24小时各厂商的Token占比',
  week: '过去一周各厂商的Token占比',
  month: '过去一个月各厂商的Token占比',
  year: '过去一年各厂商的Token占比',
  all: '所有时间各厂商的Token占比',
};

export default function MarketShareSection({ history, rows, period }) {
  const { t } = useTranslation();

  const colourMap = useMemo(
    () => buildColourMap((history?.vendors || []).map((v) => v.name)),
    [history]
  );

  const orderedPoints = useMemo(() => {
    if (!history?.points) return [];
    const order = new Map(history.vendors.map((v, idx) => [v.name, idx]));
    return [...history.points].sort((a, b) => {
      const tsCmp = a.ts.localeCompare(b.ts);
      if (tsCmp !== 0) return tsCmp;
      return (order.get(a.vendor) ?? 999) - (order.get(b.vendor) ?? 999);
    });
  }, [history]);

  const spec = useMemo(() => {
    if (orderedPoints.length === 0) return null;
    return {
      type: 'bar',
      data: [{ id: 'vendor-share', values: orderedPoints }],
      xField: 'label',
      yField: 'share',
      seriesField: 'vendor',
      stack: true,
      legends: { visible: false },
      color: { specified: colourMap },
      axes: [
        { orient: 'bottom', label: { autoHide: true, autoLimit: true }, tick: { visible: false } },
        {
          orient: 'left', min: 0, max: 1,
          label: { formatMethod: (val) => `${Math.round(Number(val) * 100)}%` },
          grid: { visible: true, style: { lineDash: [3, 3] } },
        },
      ],
      tooltip: {
        dimension: {
          title: { value: (datum) => String(datum?.label ?? '') },
          content: [{ key: (datum) => String(datum?.vendor ?? ''), value: (datum) => Number(datum?.share) || 0 }],
          updateContent: (array) =>
            array.filter((item) => Number(item.value) > 0.001)
              .sort((a, b) => Number(b.value) - Number(a.value))
              .map((item) => ({ key: item.key, value: `${(Number(item.value) * 100).toFixed(1)}%` })),
        },
      },
      animationAppear: { duration: 500 },
    };
  }, [colourMap, orderedPoints]);

  const visible = rows.slice(0, 12);
  const half = Math.ceil(visible.length / 2);
  const left = visible.slice(0, half);
  const right = visible.slice(half);

  return (
    <Card className='!rounded-2xl'>
      <div className='mb-4'>
        <Title heading={5} className='flex items-center gap-2 !mb-1'>
          <PieChart size={16} className='text-semi-color-primary' />
          {t('市场份额')}
        </Title>
        <Text type='tertiary' size='small'>{t(PERIOD_DESCRIPTIONS[period])}</Text>
      </div>

      <div className='h-64 md:h-72'>
        {spec ? (
          <VChart key={`vendor-${period}`} spec={spec} option={CHART_CONFIG} />
        ) : (
          <div className='flex items-center justify-center h-full'>
            <Text type='tertiary'>{t('暂无历史数据')}</Text>
          </div>
        )}
      </div>

      <div className='border-t border-semi-color-border mt-4 pt-4'>
        <Title heading={6} className='!mb-1'>{t('按厂商')}</Title>
        <Text type='tertiary' size='small'>{t('按总Token量排序的厂商')}</Text>

        {visible.length === 0 ? (
          <div className='text-center py-8'>
            <Text type='tertiary'>{t('暂无数据')}</Text>
          </div>
        ) : (
          <div className='grid grid-cols-1 md:grid-cols-2 gap-x-8 mt-3'>
            <VendorList rows={left} colourMap={colourMap} />
            {right.length > 0 && <VendorList rows={right} colourMap={colourMap} />}
          </div>
        )}
      </div>
    </Card>
  );
}

function VendorList({ rows, colourMap }) {
  return (
    <ul className='list-none p-0 m-0'>
      {rows.map((vendor) => (
        <li key={vendor.vendor} className='flex items-center gap-3 py-2.5 border-b border-semi-color-border last:border-0'>
          <span className='w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0' style={{
            backgroundColor: vendor.rank <= 3 ? 'var(--semi-color-primary-light-default)' : 'var(--semi-color-fill-0)',
            color: vendor.rank <= 3 ? 'var(--semi-color-primary)' : 'var(--semi-color-text-2)',
          }}>{vendor.rank}</span>
          <span className='w-3 h-3 rounded-full shrink-0' style={{ backgroundColor: colourMap[vendor.vendor] || '#94a3b8' }} />
          <span className='flex-1 min-w-0 text-sm font-medium truncate' style={{ color: 'var(--semi-color-text-0)' }}>{vendor.vendor}</span>
          <div className='text-right'>
            <div className='text-sm font-semibold font-mono'>{formatTokens(vendor.total_tokens)}</div>
            <div className='text-xs font-mono' style={{ color: 'var(--semi-color-text-2)' }}>{formatShare(vendor.share)}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
