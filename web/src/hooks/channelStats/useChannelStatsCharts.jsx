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

import { useState, useCallback, useMemo } from 'react';
import { renderNumber, renderQuota } from '../../helpers';
import { CHART_COLORS } from '../../constants/channelStats.constants';

export const useChannelStatsCharts = (
  performanceData,
  usageData,
  healthData,
  errorData,
  t
) => {
  // ========== 响应时间对比图 ==========
  const responseTimeChartSpec = useMemo(() => {
    const data = performanceData.map((item) => ({
      channel: item.channel_name,
      responseTime: item.avg_response_time,
    }));

    return {
      type: 'bar',
      data: [{ id: 'responseTime', values: data }],
      xField: 'channel',
      yField: 'responseTime',
      seriesField: 'channel',
      title: {
        visible: true,
        text: t('平均响应时间对比（秒）'),
      },
      axes: [
        {
          orient: 'left',
          label: {
            formatMethod: (val) => `${val}s`,
          },
        },
      ],
      tooltip: {
        mark: {
          content: [
            {
              key: (datum) => datum['channel'],
              value: (datum) => `${datum['responseTime'].toFixed(2)}s`,
            },
          ],
        },
      },
      color: {
        specified: CHART_COLORS,
      },
    };
  }, [performanceData, t]);

  // ========== 成功率对比图 ==========
  const successRateChartSpec = useMemo(() => {
    const data = performanceData.map((item) => ({
      type: item.channel_name,
      value: item.success_rate,
    }));

    return {
      type: 'pie',
      data: [{ id: 'successRate', values: data }],
      valueField: 'value',
      categoryField: 'type',
      outerRadius: 0.8,
      innerRadius: 0.5,
      padAngle: 0.6,
      title: {
        visible: true,
        text: t('渠道成功率分布'),
      },
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
        },
      },
      legends: {
        visible: true,
        orient: 'right',
      },
      label: {
        visible: true,
        formatMethod: (val) => `${val.toFixed(2)}%`,
      },
      tooltip: {
        mark: {
          content: [
            {
              key: (datum) => datum['type'],
              value: (datum) => `${datum['value'].toFixed(2)}%`,
            },
          ],
        },
      },
      color: {
        specified: CHART_COLORS,
      },
    };
  }, [performanceData, t]);

  // ========== 调用次数分布图 ==========
  const callCountChartSpec = useMemo(() => {
    // 转换数据格式为堆叠图所需格式
    const data = [];
    performanceData.forEach((item) => {
      data.push({
        channel: item.channel_name,
        count: item.success_calls,
        type: t('成功调用'),
      });
      data.push({
        channel: item.channel_name,
        count: item.failed_calls,
        type: t('失败调用'),
      });
    });

    return {
      type: 'bar',
      data: [{ id: 'callCount', values: data }],
      xField: 'channel',
      yField: 'count',
      seriesField: 'type',
      stack: true,
      title: {
        visible: true,
        text: t('渠道调用次数分布'),
      },
      legends: {
        visible: true,
      },
      tooltip: {
        mark: {
          content: [
            {
              key: (datum) => datum['type'],
              value: (datum) => renderNumber(datum['count']),
            },
          ],
        },
      },
      color: {
        specified: ['#52c41a', '#f5222d'],
      },
    };
  }, [performanceData, t]);

  // ========== 使用趋势图 ==========
  const usageTrendChartSpec = useMemo(() => {
    return {
      type: 'line',
      data: [{ id: 'usageTrend', values: usageData }],
      xField: 'time_point',
      yField: 'call_count',
      seriesField: 'channel_name',
      title: {
        visible: true,
        text: t('调用次数趋势'),
      },
      legends: {
        visible: true,
        selectMode: 'multiple',
      },
      line: {
        style: {
          curveType: 'monotone',
        },
      },
      point: {
        visible: true,
        style: {
          size: 3,
        },
      },
      tooltip: {
        mark: {
          content: [
            {
              key: (datum) => datum['channel_name'],
              value: (datum) => renderNumber(datum['call_count']),
            },
          ],
        },
      },
      color: {
        specified: CHART_COLORS,
      },
    };
  }, [usageData, t]);

  // ========== 健康度评分图 ==========
  const healthScoreChartSpec = useMemo(() => {
    const data = healthData.map((item) => ({
      channel: item.channel_name,
      score: item.health_score,
    }));

    return {
      type: 'bar',
      data: [{ id: 'healthScore', values: data }],
      xField: 'channel',
      yField: 'score',
      seriesField: 'channel',
      title: {
        visible: true,
        text: t('渠道健康度评分'),
      },
      axes: [
        {
          orient: 'left',
          max: 100,
          label: {
            formatMethod: (val) => `${val}`,
          },
        },
      ],
      tooltip: {
        mark: {
          content: [
            {
              key: (datum) => datum['channel'],
              value: (datum) => `${datum['score'].toFixed(2)}`,
            },
          ],
        },
      },
      bar: {
        style: {
          fill: (datum) => {
            if (datum.score >= 90) return '#52c41a';
            if (datum.score >= 75) return '#1890ff';
            if (datum.score >= 60) return '#faad14';
            return '#f5222d';
          },
        },
      },
    };
  }, [healthData, t]);

  // ========== 错误分析图 ==========
  const errorAnalysisChartSpec = useMemo(() => {
    return {
      type: 'bar',
      data: [{ id: 'errorAnalysis', values: errorData }],
      xField: 'channel_name',
      yField: 'error_count',
      seriesField: 'error_type',
      stack: true,
      title: {
        visible: true,
        text: t('渠道错误分析'),
      },
      legends: {
        visible: true,
        selectMode: 'multiple',
      },
      tooltip: {
        mark: {
          content: [
            {
              key: (datum) => datum['error_type'],
              value: (datum) => renderNumber(datum['error_count']),
            },
          ],
        },
      },
      color: {
        specified: CHART_COLORS,
      },
    };
  }, [errorData, t]);

  // ========== 费用趋势图 ==========
  const quotaTrendChartSpec = useMemo(() => {
    return {
      type: 'area',
      data: [{ id: 'quotaTrend', values: usageData }],
      xField: 'time_point',
      yField: 'quota_used',
      seriesField: 'channel_name',
      title: {
        visible: true,
        text: t('费用消耗趋势'),
      },
      legends: {
        visible: true,
        selectMode: 'multiple',
      },
      area: {
        style: {
          fillOpacity: 0.3,
        },
      },
      line: {
        style: {
          curveType: 'monotone',
        },
      },
      tooltip: {
        mark: {
          content: [
            {
              key: (datum) => datum['channel_name'],
              value: (datum) => renderQuota(datum['quota_used']),
            },
          ],
        },
      },
      color: {
        specified: CHART_COLORS,
      },
    };
  }, [usageData, t]);

  return {
    responseTimeChartSpec,
    successRateChartSpec,
    callCountChartSpec,
    usageTrendChartSpec,
    healthScoreChartSpec,
    errorAnalysisChartSpec,
    quotaTrendChartSpec,
  };
};

