---
category: examples
group: bar chart
title: 轴截断柱图
keywords: barChart,comparison,distribution,rectangle,composition,rank
cover: /vchart/preview/bar-break-by-axis_1.12.14.png
option: barChart
---

# 轴截断柱图

轴截断用于一种特殊的场景，用于解决部分数据过大，导致其他数据看不清楚的问题

## 关键配置

- `axes.breaks` 设置轴截断

## 代码演示

```javascript livedemo
/** --在业务中使用时请添加以下代码-- */
// 在业务中使用时, 请额外依赖 @visactor/vchart-extension，包版本保持和vchart一致
// import { registerSeriesBreak, appendSeriesBreakConfig } from '@visactor/vchart-extension';
/** --在业务中使用时请添加以上代码-- */

/** --在业务中使用时请删除以下代码-- */
const { registerSeriesBreak, appendSeriesBreakConfig } = VChartExtension;
/** --在业务中使用时请删除以上代码-- */
const spec = {
  height: 400,
  type: 'bar',
  data: {
    values: [
      {
        country: 'USA',
        visits: 23725
      },
      {
        country: 'China',
        visits: 1882
      },
      {
        country: 'Japan',
        visits: 1809
      },
      {
        country: 'Germany',
        visits: 1322
      },
      {
        country: 'UK',
        visits: 1122
      },
      {
        country: 'France',
        visits: 1114
      },
      {
        country: 'India',
        visits: 984
      },
      {
        country: 'Spain',
        visits: 711
      },
      {
        country: 'Netherlands',
        visits: 665
      },
      {
        country: 'Russia',
        visits: 580
      },
      {
        country: 'South Korea',
        visits: 443
      },
      {
        country: 'Canada',
        visits: 441
      }
    ]
  },
  xField: 'country',
  yField: 'visits',
  axes: [
    {
      orient: 'left',
      breaks: [
        {
          scopeType: 'length',
          range: [2100, 22900]
        },
        {
          range: [700, 900]
        }
      ],
      nice: false,
      tick: {
        tickMode: 'd3'
      },

      domainLine: {
        visible: true
      }
    }
  ]
};

registerSeriesBreak();
appendSeriesBreakConfig(spec);

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 关键配置

## 相关教程

[柱状图](link)
