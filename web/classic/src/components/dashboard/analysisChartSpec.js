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

export const formatPeriod = (period) => {
  if (!period) return '-';
  return new Date(Number(period) * 1000).toLocaleString('zh-CN', {
    hour12: false,
    timeZone: 'Asia/Shanghai',
  });
};

export const buildAnalysisModelChartSpec = (rows, t, quotaPerUnit = 500000) => {
  const byModel = new Map();
  rows.forEach((row) => {
    const key = row.model_name || t('未标记模型');
    byModel.set(key, (byModel.get(key) || 0) + Number(row.quota || 0));
  });
  const values = [...byModel.entries()]
    .map(([model, quota]) => ({
      model,
      amount: quota / (quotaPerUnit || 500000),
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
    axes: [
      {
        orient: 'bottom',
        title: { visible: true, text: t('消费金额（USD）') },
      },
      { orient: 'left', label: { style: { fontSize: 11 } } },
    ],
    tooltip: { visible: true },
  };
};

export const buildAnalysisTrendChartSpec = (rows, t, quotaPerUnit = 500000) => {
  const byPeriod = new Map();
  rows.forEach((row) => {
    const key = Number(row.period || 0);
    byPeriod.set(key, (byPeriod.get(key) || 0) + Number(row.quota || 0));
  });
  const values = [...byPeriod.entries()]
    .sort(([a], [b]) => a - b)
    .map(([period, quota]) => ({
      period: formatPeriod(period),
      amount: quota / (quotaPerUnit || 500000),
    }));

  return {
    type: 'line',
    data: [{ id: 'analysisTrendData', values }],
    xField: 'period',
    yField: 'amount',
    point: { visible: values.length < 32 },
    smooth: true,
    line: { style: { lineWidth: 3 } },
    axes: [{ orient: 'left', title: { visible: true, text: t('USD') } }],
    tooltip: { visible: true },
  };
};
