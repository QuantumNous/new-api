import React from 'react';
import { Spin, Tabs, TabPane, Empty } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { useRankingsData } from '../../hooks/rankings/useRankingsData';
import ModelsSection from './ModelsSection';
import MarketShareSection from './MarketShareSection';
import PulseSection from './PulseSection';

const PERIODS = [
  { key: 'today', label: '今天' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: 'year', label: '本年' },
  { key: 'all', label: '全部' },
];

export default function RankingsPage() {
  const { t } = useTranslation();
  const { period, changePeriod, snapshot, loading, error } = useRankingsData('week');

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', width: '100%', paddingTop: 80 }} className='p-4 md:p-6 lg:p-8'>
      <div className='mb-8'>
        <h1 className='text-2xl font-bold' style={{ color: 'var(--semi-color-text-0)', margin: 0 }}>
          {t('排行榜')}
        </h1>
        <p style={{ color: 'var(--semi-color-text-2)', fontSize: 14, margin: '4px 0 0' }}>
          {t('发现平台上最受欢迎的模型和厂商，数据来自实时使用统计。')}
        </p>
      </div>

      <Tabs type='button' activeKey={period} onChange={changePeriod} className='mb-6'>
        {PERIODS.map((p) => (
          <TabPane key={p.key} tab={t(p.label)} itemKey={p.key} />
        ))}
      </Tabs>

      {loading ? (
        <div className='flex justify-center' style={{ padding: '80px 0' }}>
          <Spin size='large' />
        </div>
      ) : error ? (
        <Empty title={t('加载失败')} description={error} />
      ) : snapshot ? (
        <div className='grid gap-6'>
          <ModelsSection history={snapshot.models_history} rows={snapshot.models} period={period} />
          <MarketShareSection history={snapshot.vendor_share_history} rows={snapshot.vendors} period={period} />
          <PulseSection movers={snapshot.top_movers} droppers={snapshot.top_droppers} />
        </div>
      ) : null}
    </div>
  );
}
