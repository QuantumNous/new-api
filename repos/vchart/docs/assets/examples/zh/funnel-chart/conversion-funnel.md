---
category: examples
group: funnel chart
title: 转化率漏斗图
keywords: funnelChart,composition,trend,triangle
order: 8-6
cover: /vchart/preview/conversion-funnel_1.12.14.png
option: funnelChart
---

# 扩展图表-转化率漏斗图

在图表扩展包（@visactor/vchart-extension）中，我们内置了自定义转化率箭头、漏斗层背景的功能。
详细配置请参考[扩展图表教程](/vchart/guide/tutorial_docs/Chart_Extensions/conversion_funnel)。

## 关键配置

- 指定图表表类型`type: conversionFunnel`为扩展的转化率漏斗图，漏斗图其他配置均支持。
- `funnelBackground`：配置漏斗层背景
- `conversionArrow`: 配置转化率箭头

## 代码演示

```javascript livedemo
/** --在业务中使用时请添加以下代码-- */
// 在业务中使用时, 请额外依赖 @visactor/vchart-extension，包版本保持和vchart一致
// import { registerConversionFunnelChart } from '@visactor/vchart-extension';
/** --在业务中使用时请添加以上代码-- */

/** --在业务中使用时请删除以下代码-- */
const { registerConversionFunnelChart } = VChartExtension;
/** --在业务中使用时请删除以上代码-- */
const spec = {
  type: 'conversionFunnel',
  animation: false,
  width: 800,
  height: 400,
  maxSize: '55%',
  isTransform: true,
  shape: 'rect',
  funnelAlign: 'right',
  funnelBackground: {
    visible: true,
    interactive: true,
    style: {
      cornerRadius: 5,
      fill: datum => {
        return datum.name === 'Resume Screening' ? 'rgb(210,215,255)' : 'rgb(240,245,255)';
      }
    },
    state: {
      hover: {
        opacity: 0.8
      }
    }
  },
  label: {
    visible: true,
    style: {
      lineHeight: 16,
      limit: Infinity,
      fill: 'white',
      text: datum => [`${datum.name}`]
    }
  },
  outerLabel: {
    visible: true,
    position: 'left',
    alignLabel: true,
    style: {
      text: datum => {
        return `${datum.percent * 100}%`;
      },
      dx: 10
    },
    line: {
      visible: false
    }
  },
  transformLabel: {
    visible: true,
    style: {
      fill: 'black'
    }
  },
  conversionArrow: {
    text: {
      formatMethod: (text, params) => {
        const { from, to } = params;
        if (!from || !to) {
          return [];
        }
        return {
          type: 'rich',
          text: [
            { text: `${((to.value / from.value) * 100).toFixed(2)}%\n`, fill: 'black' },
            { text: `${from.name} - ${to.name}`, fill: 'black' }
          ]
        };
      },
      style: {
        maxWidth: 120,
        wordBreak: 'break-word'
      }
    },
    line: {
      style: {
        stroke: 'rgb(238,239,241)',
        lineWidth: 2
      }
    },
    symbol: {
      style: {
        fill: 'rgb(238,239,241)'
      }
    },
    arrows: [
      {
        from: 1,
        to: 0,
        text: '0-1',
        position: 'right'
      },
      {
        from: 1,
        to: 2,
        text: '1-2',
        position: 'right'
      },
      {
        from: 2,
        to: 3,
        text: '2-3',
        position: 'right'
      },
      {
        from: 3,
        to: 4,
        text: '3-4',
        position: 'right'
      },
      {
        from: 0,
        to: 4,
        text: '0-4',
        distance: 90,
        position: 'right'
      }
    ]
  },
  color: {
    type: 'ordinal',
    range: ['#00328E', '#0048AA', '#005FC5', '#2778E2', '#4E91FF', '#70ABFF', '#8FC7FF', '#AEE2FF']
  },
  legends: {},
  funnel: {
    style: {
      cornerRadius: 4,
      stroke: 'white',
      lineWidth: 2
    },
    state: {
      hover: {
        stroke: '#4e83fd',
        lineWidth: 1
      }
    }
  },

  region: [
    {
      padding: { right: 300 }
    }
  ],
  data: [
    {
      name: 'funnel',
      values: [
        {
          value: 100,
          name: 'Resume Screening',
          percent: 1
        },
        {
          value: 80,
          name: 'Resume Evaluation',
          percent: 0.8
        },
        {
          value: 50,
          name: 'Evaluation Passed',
          percent: 0.5
        },
        {
          value: 30,
          name: 'Interview',
          percent: 0.3
        },
        {
          value: 10,
          name: 'Final Pass',
          percent: 0.1
        }
      ]
    }
  ],
  categoryField: 'name',
  valueField: 'value'
};

registerConversionFunnelChart();
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[柱状图](link)
