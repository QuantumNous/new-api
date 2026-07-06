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

import { useState, useCallback, useEffect } from 'react';
import { initVChartSemiTheme } from '@visactor/vchart-semi-theme';
import {
  modelColorMap,
  renderNumber,
  renderQuota,
  modelToColor,
  getQuotaWithUnit,
} from '../../helpers';
import {
  processRawData,
  calculateTrendData,
  aggregateDataByTimeAndModel,
  generateChartTimePoints,
  updateChartSpec,
  updateMapValue,
  initializeMaps,
  processUserData,
} from '../../helpers/dashboard';

const USER_COLORS = [
  '#0f766e',
  '#2563eb',
  '#a16207',
  '#7c3aed',
  '#be123c',
  '#475569',
  '#0e7490',
  '#b45309',
  '#4f46e5',
  '#15803d',
];

const COMMAND_CHART_STYLE = {
  background: 'transparent',
  title: {
    textStyle: {
      fill: '#19130c',
      fontSize: 16,
      fontWeight: 900,
    },
    subtextStyle: {
      fill: '#6f675b',
      fontSize: 12,
    },
  },
  axes: [
    {
      orient: 'bottom',
      label: { style: { fill: '#6f675b' } },
      domainLine: { style: { stroke: 'rgba(76, 65, 49, 0.12)' } },
      grid: { style: { stroke: 'rgba(76, 65, 49, 0.055)' } },
    },
    {
      orient: 'left',
      label: { style: { fill: '#6f675b' } },
      domainLine: { style: { stroke: 'rgba(76, 65, 49, 0.1)' } },
      grid: { style: { stroke: 'rgba(76, 65, 49, 0.06)' } },
    },
  ],
  legends: {
    item: {
      label: {
        style: { fill: '#5f574c' },
      },
    },
  },
};

const withCommandChartStyle = (spec) => ({
  ...COMMAND_CHART_STYLE,
  ...spec,
  title: {
    ...COMMAND_CHART_STYLE.title,
    ...spec.title,
    textStyle: {
      ...COMMAND_CHART_STYLE.title.textStyle,
      ...spec.title?.textStyle,
    },
    subtextStyle: {
      ...COMMAND_CHART_STYLE.title.subtextStyle,
      ...spec.title?.subtextStyle,
    },
  },
  axes: spec.axes || COMMAND_CHART_STYLE.axes,
  legends:
    spec.legends === false
      ? false
      : {
          ...COMMAND_CHART_STYLE.legends,
          ...spec.legends,
          item: {
            ...COMMAND_CHART_STYLE.legends.item,
            ...spec.legends?.item,
            label: {
              ...COMMAND_CHART_STYLE.legends.item.label,
              ...spec.legends?.item?.label,
              style: {
                ...COMMAND_CHART_STYLE.legends.item.label.style,
                ...spec.legends?.item?.label?.style,
              },
            },
          },
        },
});

export const useDashboardCharts = (
  dataExportDefaultTime,
  setTrendData,
  setConsumeQuota,
  setTimes,
  setConsumeTokens,
  setPieData,
  setLineData,
  setModelColors,
  t,
) => {
  // ========== 图表规格状态 ==========
  const [spec_pie, setSpecPie] = useState(
    withCommandChartStyle({
      type: 'pie',
      data: [
        {
          id: 'id0',
          values: [{ type: 'null', value: '0' }],
        },
      ],
      outerRadius: 0.8,
      innerRadius: 0.5,
      padAngle: 0.6,
      valueField: 'value',
      categoryField: 'type',
      pie: {
        style: {
          cornerRadius: 10,
        },
        state: {
          hover: {
            outerRadius: 0.85,
            stroke: '#000',
            lineWidth: 1,
          },
          selected: {
            outerRadius: 0.85,
            stroke: '#000',
            lineWidth: 1,
          },
        },
      },
      title: {
        visible: true,
        text: t('模型调用次数占比'),
        subtext: `${t('总计')}：${renderNumber(0)}`,
      },
      legends: {
        visible: true,
        orient: 'left',
      },
      label: {
        visible: true,
      },
      tooltip: {
        mark: {
          content: [
            {
              key: (datum) => datum['type'],
              value: (datum) => renderNumber(datum['value']),
            },
          ],
        },
      },
      color: {
        specified: modelColorMap,
      },
    }),
  );

  const [spec_line, setSpecLine] = useState(
    withCommandChartStyle({
      type: 'bar',
      data: [
        {
          id: 'barData',
          values: [],
        },
      ],
      xField: 'Time',
      yField: 'Usage',
      seriesField: 'Model',
      stack: true,
      legends: {
        visible: true,
        selectMode: 'single',
      },
      title: {
        visible: true,
        text: t('模型消耗分布'),
        subtext: `${t('总计')}：${renderQuota(0, 2)}`,
      },
      bar: {
        state: {
          hover: {
            stroke: '#000',
            lineWidth: 1,
          },
        },
      },
      tooltip: {
        mark: {
          content: [
            {
              key: (datum) => datum['Model'],
              value: (datum) => renderQuota(datum['rawQuota'] || 0, 4),
            },
          ],
        },
        dimension: {
          content: [
            {
              key: (datum) => datum['Model'],
              value: (datum) => datum['rawQuota'] || 0,
            },
          ],
          updateContent: (array) => {
            array.sort((a, b) => b.value - a.value);
            let sum = 0;
            for (let i = 0; i < array.length; i++) {
              if (array[i].key == '其他') {
                continue;
              }
              let value = parseFloat(array[i].value);
              if (isNaN(value)) {
                value = 0;
              }
              if (array[i].datum && array[i].datum.TimeSum) {
                sum = array[i].datum.TimeSum;
              }
              array[i].value = renderQuota(value, 4);
            }
            array.unshift({
              key: t('总计'),
              value: renderQuota(sum, 4),
            });
            return array;
          },
        },
      },
      color: {
        specified: modelColorMap,
      },
    }),
  );

  const [spec_model_line, setSpecModelLine] = useState(
    withCommandChartStyle({
      type: 'line',
      data: [
        {
          id: 'lineData',
          values: [],
        },
      ],
      xField: 'Time',
      yField: 'Count',
      seriesField: 'Model',
      legends: {
        visible: true,
        selectMode: 'single',
      },
      title: {
        visible: true,
        text: t('调用趋势'),
        subtext: '',
      },
      tooltip: {
        mark: {
          content: [
            {
              key: (datum) => datum['Model'],
              value: (datum) => renderNumber(datum['Count']),
            },
          ],
        },
        dimension: {
          content: [
            {
              key: (datum) => datum['Model'],
              value: (datum) => datum['Count'] || 0,
            },
          ],
          updateContent: (array) => {
            array.sort((a, b) => b.value - a.value);
            let sum = 0;
            for (let i = 0; i < array.length; i++) {
              let value = parseFloat(array[i].value);
              if (isNaN(value)) value = 0;
              sum += value;
              array[i].value = renderNumber(value);
            }
            array.unshift({
              key: t('总计'),
              value: renderNumber(sum),
            });
            return array;
          },
        },
      },
      color: {
        specified: modelColorMap,
      },
    }),
  );

  const [spec_rank_bar, setSpecRankBar] = useState(
    withCommandChartStyle({
      type: 'bar',
      data: [
        {
          id: 'rankData',
          values: [],
        },
      ],
      xField: 'Model',
      yField: 'Count',
      seriesField: 'Model',
      legends: {
        visible: true,
        selectMode: 'single',
      },
      title: {
        visible: true,
        text: t('模型调用次数排行'),
        subtext: '',
      },
      bar: {
        state: {
          hover: {
            stroke: '#000',
            lineWidth: 1,
          },
        },
      },
      tooltip: {
        mark: {
          content: [
            {
              key: (datum) => datum['Model'],
              value: (datum) => renderNumber(datum['Count']),
            },
          ],
        },
      },
      color: {
        specified: modelColorMap,
      },
    }),
  );

  // ========== Admin: 用户消耗排行 ==========
  const [spec_user_rank, setSpecUserRank] = useState(
    withCommandChartStyle({
      type: 'bar',
      data: [{ id: 'userRankData', values: [] }],
      xField: 'rawQuota',
      yField: 'User',
      seriesField: 'User',
      direction: 'horizontal',
      legends: { visible: false },
      title: {
        visible: true,
        text: t('用户消耗排行'),
        subtext: '',
      },
      bar: {
        state: { hover: { stroke: '#000', lineWidth: 1 } },
      },
      label: {
        visible: true,
        position: 'outside',
        formatMethod: (value, datum) => renderQuota(datum['rawQuota'] || 0, 2),
      },
      axes: [
        {
          orient: 'left',
          type: 'band',
          label: { visible: true, style: { fill: '#6f675b' } },
        },
        {
          orient: 'bottom',
          type: 'linear',
          visible: false,
        },
      ],
      tooltip: {
        mark: {
          content: [
            {
              key: (datum) => datum['User'],
              value: (datum) => renderQuota(datum['rawQuota'] || 0, 4),
            },
          ],
        },
      },
      color: { type: 'ordinal', range: USER_COLORS },
    }),
  );

  // ========== Admin: 用户消耗趋势 ==========
  const [spec_user_trend, setSpecUserTrend] = useState(
    withCommandChartStyle({
      type: 'area',
      data: [{ id: 'userTrendData', values: [] }],
      xField: 'Time',
      yField: 'rawQuota',
      seriesField: 'User',
      stack: false,
      legends: { visible: true, selectMode: 'single' },
      title: {
        visible: true,
        text: t('用户消耗趋势'),
        subtext: '',
      },
      axes: [
        {
          orient: 'left',
          label: {
            style: { fill: '#6f675b' },
            formatMethod: (value) => renderQuota(value, 2),
          },
          domainLine: { style: { stroke: 'rgba(76, 65, 49, 0.1)' } },
          grid: { style: { stroke: 'rgba(76, 65, 49, 0.06)' } },
        },
      ],
      area: { style: { fillOpacity: 0.15 } },
      line: { style: { lineWidth: 2 } },
      point: { visible: false },
      tooltip: {
        mark: {
          content: [
            {
              key: (datum) => datum['User'],
              value: (datum) => renderQuota(datum['rawQuota'] || 0, 4),
            },
          ],
        },
        dimension: {
          content: [
            {
              key: (datum) => datum['User'],
              value: (datum) => datum['rawQuota'] || 0,
            },
          ],
          updateContent: (array) => {
            array.sort((a, b) => b.value - a.value);
            let sum = 0;
            for (let i = 0; i < array.length; i++) {
              let value = parseFloat(array[i].value);
              if (isNaN(value)) value = 0;
              sum += value;
              array[i].value = renderQuota(value, 4);
            }
            array.unshift({
              key: t('总计'),
              value: renderQuota(sum, 4),
            });
            return array;
          },
        },
      },
      color: { type: 'ordinal', range: USER_COLORS },
    }),
  );

  // ========== 数据处理函数 ==========
  const generateModelColors = useCallback((uniqueModels, modelColors) => {
    const newModelColors = {};
    Array.from(uniqueModels).forEach((modelName) => {
      newModelColors[modelName] =
        modelColorMap[modelName] ||
        modelColors[modelName] ||
        modelToColor(modelName);
    });
    return newModelColors;
  }, []);

  const updateChartData = useCallback(
    (data) => {
      const processedData = processRawData(
        data,
        dataExportDefaultTime,
        initializeMaps,
        updateMapValue,
      );

      const {
        totalQuota,
        totalTimes,
        totalTokens,
        uniqueModels,
        timePoints,
        timeQuotaMap,
        timeTokensMap,
        timeCountMap,
      } = processedData;

      const trendDataResult = calculateTrendData(
        timePoints,
        timeQuotaMap,
        timeTokensMap,
        timeCountMap,
        dataExportDefaultTime,
      );
      setTrendData(trendDataResult);

      const newModelColors = generateModelColors(uniqueModels, {});
      setModelColors(newModelColors);

      const aggregatedData = aggregateDataByTimeAndModel(
        data,
        dataExportDefaultTime,
      );

      const modelTotals = new Map();
      for (let [_, value] of aggregatedData) {
        updateMapValue(modelTotals, value.model, value.count);
      }

      const newPieData = Array.from(modelTotals)
        .map(([model, count]) => ({
          type: model,
          value: count,
        }))
        .sort((a, b) => b.value - a.value);

      const chartTimePoints = generateChartTimePoints(
        aggregatedData,
        data,
        dataExportDefaultTime,
      );

      let newLineData = [];

      chartTimePoints.forEach((time) => {
        let timeData = Array.from(uniqueModels).map((model) => {
          const key = `${time}-${model}`;
          const aggregated = aggregatedData.get(key);
          return {
            Time: time,
            Model: model,
            rawQuota: aggregated?.quota || 0,
            Usage: aggregated?.quota
              ? getQuotaWithUnit(aggregated.quota, 4)
              : 0,
          };
        });

        const timeSum = timeData.reduce((sum, item) => sum + item.rawQuota, 0);
        timeData.sort((a, b) => b.rawQuota - a.rawQuota);
        timeData = timeData.map((item) => ({ ...item, TimeSum: timeSum }));
        newLineData.push(...timeData);
      });

      newLineData.sort((a, b) => a.Time.localeCompare(b.Time));

      updateChartSpec(
        setSpecPie,
        newPieData,
        `${t('总计')}：${renderNumber(totalTimes)}`,
        newModelColors,
        'id0',
      );

      updateChartSpec(
        setSpecLine,
        newLineData,
        `${t('总计')}：${renderQuota(totalQuota, 2)}`,
        newModelColors,
        'barData',
      );

      // ===== 模型调用次数折线图 =====
      let modelLineData = [];
      chartTimePoints.forEach((time) => {
        const timeData = Array.from(uniqueModels).map((model) => {
          const key = `${time}-${model}`;
          const aggregated = aggregatedData.get(key);
          return {
            Time: time,
            Model: model,
            Count: aggregated?.count || 0,
          };
        });
        modelLineData.push(...timeData);
      });
      modelLineData.sort((a, b) => a.Time.localeCompare(b.Time));

      // ===== 模型调用次数排行柱状图 =====
      const MAX_RANK_MODELS = 20;
      const allRankData = Array.from(modelTotals)
        .map(([model, count]) => ({
          Model: model,
          Count: count,
        }))
        .sort((a, b) => b.Count - a.Count);

      let rankData;
      if (allRankData.length > MAX_RANK_MODELS) {
        const topModels = allRankData.slice(0, MAX_RANK_MODELS);
        const otherCount = allRankData
          .slice(MAX_RANK_MODELS)
          .reduce((sum, item) => sum + item.Count, 0);
        rankData = [...topModels, { Model: t('其他'), Count: otherCount }];
      } else {
        rankData = allRankData;
      }

      updateChartSpec(
        setSpecModelLine,
        modelLineData,
        `${t('总计')}：${renderNumber(totalTimes)}`,
        newModelColors,
        'lineData',
      );

      updateChartSpec(
        setSpecRankBar,
        rankData,
        `${t('总计')}：${renderNumber(totalTimes)}`,
        newModelColors,
        'rankData',
      );

      setPieData(newPieData);
      setLineData(newLineData);
      setConsumeQuota(totalQuota);
      setTimes(totalTimes);
      setConsumeTokens(totalTokens);
    },
    [
      dataExportDefaultTime,
      setTrendData,
      generateModelColors,
      setModelColors,
      setPieData,
      setLineData,
      setConsumeQuota,
      setTimes,
      setConsumeTokens,
      t,
    ],
  );

  // ========== 用户维度图表数据处理 ==========
  const updateUserChartData = useCallback(
    (data) => {
      const { rankingData, trendData: userTrend } = processUserData(
        data,
        dataExportDefaultTime,
        10,
      );

      const userRankValues = rankingData
        .map((item) => ({
          User: item.User,
          rawQuota: item.Quota,
          Quota: getQuotaWithUnit(item.Quota, 4),
        }))
        .sort((a, b) => b.rawQuota - a.rawQuota);

      const totalUserQuota = rankingData.reduce((s, i) => s + i.Quota, 0);

      setSpecUserRank((prev) => ({
        ...prev,
        data: [{ id: 'userRankData', values: userRankValues }],
        title: {
          ...prev.title,
          subtext: `${t('总计')}：${renderQuota(totalUserQuota, 2)}`,
        },
      }));

      const userTrendValues = userTrend.map((item) => ({
        Time: item.Time,
        User: item.User,
        rawQuota: item.Quota,
        Usage: item.Quota ? getQuotaWithUnit(item.Quota, 4) : 0,
      }));

      setSpecUserTrend((prev) => ({
        ...prev,
        data: [{ id: 'userTrendData', values: userTrendValues }],
        title: {
          ...prev.title,
          subtext: `${t('总计')}：${renderQuota(totalUserQuota, 2)}`,
        },
      }));
    },
    [dataExportDefaultTime, t],
  );

  // ========== 初始化图表主题 ==========
  useEffect(() => {
    initVChartSemiTheme({
      isWatchingThemeSwitch: true,
    });
  }, []);

  return {
    spec_pie,
    spec_line,
    spec_model_line,
    spec_rank_bar,
    spec_user_rank,
    spec_user_trend,
    updateChartData,
    updateUserChartData,
    generateModelColors,
  };
};
