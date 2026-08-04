import React, { useMemo } from 'react';
import { Button, Card, Empty, Tag } from '@douyinfe/semi-ui';
import { Download, BarChart3, TrendingUp } from 'lucide-react';
import { VChart } from '@visactor/react-vchart';
import { getQuotaPerUnit } from '../../helpers/quota';
import { getAnalysisTableDimensions } from '../../hooks/dashboard/analysisCsv';

const formatMoney = (quota) =>
  `$${(Number(quota || 0) / (getQuotaPerUnit() || 500000)).toFixed(2)}`;

const formatPeriod = (period) => {
  if (!period) return '-';
  return new Date(Number(period) * 1000).toLocaleString('zh-CN', {
    hour12: false,
    timeZone: 'Asia/Shanghai',
  });
};

const AnalysisPanel = ({
  analysis,
  loading,
  notice,
  error,
  isAdminUser,
  exportAnalysis,
  CARD_PROPS,
  CHART_CONFIG,
  t,
}) => {
  const rows = analysis?.rows || [];
  const tableDimensions = getAnalysisTableDimensions(
    isAdminUser,
    analysis?.dimensions,
  );
  const hasDimension = (dimension) => tableDimensions.includes(dimension);
  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          acc.quota += Number(row.quota || 0);
          acc.requests += Number(row.request_count || 0);
          acc.tokens +=
            Number(row.prompt_tokens || 0) + Number(row.completion_tokens || 0);
          return acc;
        },
        { quota: 0, requests: 0, tokens: 0 },
      ),
    [rows],
  );

  const modelChartSpec = useMemo(() => {
    const byModel = new Map();
    rows.forEach((row) => {
      const key = row.model_name || t('未标记模型');
      byModel.set(key, (byModel.get(key) || 0) + Number(row.quota || 0));
    });
    const values = [...byModel.entries()]
      .map(([model, quota]) => ({
        model,
        amount: quota / (getQuotaPerUnit() || 500000),
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 12);
    return {
      type: 'bar',
      data: [{ id: 'analysisModelData', values }],
      xField: 'amount',
      yField: 'model',
      direction: 'horizontal',
      seriesField: 'model',
      legends: { visible: false },
      axes: {
        x: { title: { visible: true, text: t('消费金额（USD）') } },
        y: { label: { style: { fontSize: 11 } } },
      },
      tooltip: { visible: true },
    };
  }, [rows, t]);

  const trendChartSpec = useMemo(() => {
    const byPeriod = new Map();
    rows.forEach((row) => {
      const key = Number(row.period || 0);
      byPeriod.set(key, (byPeriod.get(key) || 0) + Number(row.quota || 0));
    });
    const values = [...byPeriod.entries()]
      .sort(([a], [b]) => a - b)
      .map(([period, quota]) => ({
        period: formatPeriod(period),
        amount: quota / (getQuotaPerUnit() || 500000),
      }));
    return {
      type: 'line',
      data: [{ id: 'analysisTrendData', values }],
      xField: 'period',
      yField: 'amount',
      point: { visible: values.length < 32 },
      smooth: true,
      line: { style: { lineWidth: 3 } },
      axes: { y: { title: { visible: true, text: t('USD') } } },
      tooltip: { visible: true },
    };
  }, [rows, t]);

  return (
    <Card
      {...CARD_PROPS}
      className='!rounded-2xl mb-4 border-0 shadow-sm'
      title={
        <div className='flex items-center justify-between gap-3'>
          <div className='flex items-center gap-2'>
            <BarChart3 size={17} />
            <span>{t('多维消费分析')}</span>
            <Tag color='blue' size='small'>
              {isAdminUser ? t('管理员视图') : t('用户视图')}
            </Tag>
          </div>
          <Button
            icon={<Download size={15} />}
            theme='solid'
            type='primary'
            size='small'
            onClick={exportAnalysis}
            disabled={loading || rows.length === 0}
          >
            {t('导出 CSV')}
          </Button>
        </div>
      }
    >
      <div className='mb-4 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600'>
        {t(
          '本卡片数据来源为消费日志；下方旧版概览卡片可能使用 quota_data 口径，金额不应直接合并。',
        )}
      </div>

      <div
        className={`grid grid-cols-2 ${isAdminUser ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-3 mb-4`}
      >
        <div className='rounded-xl bg-blue-50 p-3'>
          <div className='text-xs text-gray-500'>{t('消费金额')}</div>
          <div className='text-xl font-semibold text-blue-700'>
            {formatMoney(totals.quota)}
          </div>
        </div>
        <div className='rounded-xl bg-indigo-50 p-3'>
          <div className='text-xs text-gray-500'>{t('成功请求')}</div>
          <div className='text-xl font-semibold text-indigo-700'>
            {totals.requests.toLocaleString()}
          </div>
        </div>
        <div className='rounded-xl bg-cyan-50 p-3'>
          <div className='text-xs text-gray-500'>{t('使用 Tokens')}</div>
          <div className='text-xl font-semibold text-cyan-700'>
            {totals.tokens.toLocaleString()}
          </div>
        </div>
        {isAdminUser && (
          <div className='rounded-xl bg-amber-50 p-3'>
            <div className='text-xs text-gray-500'>{t('毛利率')}</div>
            <div className='text-xl font-semibold text-amber-700'>
              {t('待成本台账')}
            </div>
          </div>
        )}
      </div>

      {isAdminUser && analysis?.cost_basis_note && (
        <div className='mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800'>
          {analysis.cost_basis_note}
        </div>
      )}

      {notice && (
        <div className='mb-4 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800'>
          {notice}
        </div>
      )}

      {loading ? (
        <div className='h-48 flex items-center justify-center text-gray-400'>
          {t('正在加载消费分析')}…
        </div>
      ) : error ? (
        <div className='rounded-lg bg-red-50 px-3 py-3 text-sm text-red-800'>
          {error}
        </div>
      ) : rows.length === 0 ? (
        <Empty description={t('当前筛选条件下暂无消费记录')} />
      ) : (
        <>
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4'>
            <div className='rounded-xl border border-gray-100 p-2'>
              <div className='flex items-center gap-2 px-2 py-1 text-sm font-medium'>
                <BarChart3 size={15} /> {t('模型消费分布')}
              </div>
              <div className='h-64'>
                <VChart spec={modelChartSpec} option={CHART_CONFIG} />
              </div>
            </div>
            <div className='rounded-xl border border-gray-100 p-2'>
              <div className='flex items-center gap-2 px-2 py-1 text-sm font-medium'>
                <TrendingUp size={15} /> {t('消费趋势')}
              </div>
              <div className='h-64'>
                <VChart spec={trendChartSpec} option={CHART_CONFIG} />
              </div>
            </div>
          </div>
          <div className='overflow-x-auto rounded-xl border border-gray-100'>
            <table className='min-w-full text-sm'>
              <thead className='bg-gray-50 text-left text-xs text-gray-500'>
                <tr>
                  {hasDimension('period') && (
                    <th className='px-3 py-2'>{t('时间')}</th>
                  )}
                  {hasDimension('username') && (
                    <th className='px-3 py-2'>{t('用户')}</th>
                  )}
                  {hasDimension('model_name') && (
                    <th className='px-3 py-2'>{t('模型')}</th>
                  )}
                  {hasDimension('token_name') && (
                    <th className='px-3 py-2'>{t('令牌')}</th>
                  )}
                  {hasDimension('group') && (
                    <th className='px-3 py-2'>{t('分组')}</th>
                  )}
                  {hasDimension('channel') && (
                    <th className='px-3 py-2'>{t('渠道')}</th>
                  )}
                  <th className='px-3 py-2 text-right'>{t('请求数')}</th>
                  <th className='px-3 py-2 text-right'>{t('消费')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 100).map((row, index) => (
                  <tr
                    key={`${row.period}-${row.model_name}-${index}`}
                    className='border-t border-gray-50'
                  >
                    {hasDimension('period') && (
                      <td className='px-3 py-2 whitespace-nowrap'>
                        {formatPeriod(row.period)}
                      </td>
                    )}
                    {hasDimension('username') && (
                      <td className='px-3 py-2'>{row.username || '-'}</td>
                    )}
                    {hasDimension('model_name') && (
                      <td className='px-3 py-2'>{row.model_name || '-'}</td>
                    )}
                    {hasDimension('token_name') && (
                      <td className='px-3 py-2'>{row.token_name || '-'}</td>
                    )}
                    {hasDimension('group') && (
                      <td className='px-3 py-2'>{row.group || '-'}</td>
                    )}
                    {hasDimension('channel') && (
                      <td className='px-3 py-2'>{row.channel_id || '-'}</td>
                    )}
                    <td className='px-3 py-2 text-right'>
                      {Number(row.request_count || 0).toLocaleString()}
                    </td>
                    <td className='px-3 py-2 text-right font-medium'>
                      {formatMoney(row.quota)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 100 && (
            <div className='mt-2 text-xs text-gray-500'>
              {t('表格仅展示前 100 条，完整结果请导出 CSV。')}
            </div>
          )}
        </>
      )}
    </Card>
  );
};

export default AnalysisPanel;
