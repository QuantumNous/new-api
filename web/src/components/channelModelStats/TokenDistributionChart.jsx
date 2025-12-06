import React, { useMemo } from 'react';
import { VChart } from '@visactor/react-vchart';
import { Empty } from '@douyinfe/semi-ui';

const TokenDistributionChart = ({ data, t }) => {
  const spec = useMemo(() => {
    if (!data || data.length === 0) return null;

    // 安全获取数值
    const safeNumber = (val) => (typeof val === 'number' && !isNaN(val)) ? val : 0;

    // 转换数据格式 - 堆叠柱状图
    const chartData = [];
    data.forEach(item => {
      chartData.push({ 
        name: String(item.name || ''), 
        type: t('输入Token'), 
        value: safeNumber(item.prompt_tokens)
      });
      chartData.push({ 
        name: String(item.name || ''), 
        type: t('输出Token'), 
        value: safeNumber(item.completion_tokens)
      });
    });

    return {
      type: 'bar',
      data: [{ id: 'data', values: chartData }],
      xField: 'name',
      yField: 'value',
      seriesField: 'type',
      stack: true,
      bar: {
        style: {
          cornerRadius: [4, 4, 0, 0],
        },
      },
      legends: {
        visible: true,
        orient: 'top',
      },
      axes: [
        {
          orient: 'left',
          title: {
            visible: true,
            text: t('Token数量'),
          },
          label: {
            formatMethod: (val) => {
              const num = typeof val === 'number' ? val : 0;
              if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
              if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
              return String(num);
            },
          },
        },
        {
          orient: 'bottom',
          label: {
            autoRotate: true,
            autoRotateAngle: [0, 45, 90],
          },
        },
      ],
      tooltip: {
        dimension: {
          content: [
            {
              key: (datum) => String(datum?.type || ''),
              value: (datum) => {
                const val = typeof datum?.value === 'number' ? datum.value : 0;
                if (val >= 1000000) return `${(val / 1000000).toFixed(2)}M`;
                if (val >= 1000) return `${(val / 1000).toFixed(2)}K`;
                return String(val.toLocaleString());
              },
            },
          ],
        },
      },
      color: ['#2196F3', '#4CAF50'],
      title: {
        visible: true,
        text: t('Token使用分布'),
        subtext: t('输入/输出Token对比'),
      },
    };
  }, [data, t]);

  if (!spec) {
    return <Empty description={t('暂无数据')} />;
  }

  return (
    <div style={{ width: '100%', height: '400px' }}>
      <VChart spec={spec} option={{ mode: 'desktop-browser' }} />
    </div>
  );
};

export default TokenDistributionChart;

