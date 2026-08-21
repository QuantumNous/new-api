---
category: examples
group: bar chart
title: 轴截断柱图
keywords: barChart,comparison,distribution,rectangle,composition,rank
cover: /vchart/preview/bar-break-by-axis_1.12.14.png
option: barChart
---

# Axis Break Bar Chart

Axis break is used in a special scenario to solve the problem where some data is too large, making other data difficult to see.

## Key Configuration

- `axes.breaks` sets the axis break

## Code Demonstration

```javascript livedemo
/** --Add the following code when using in business-- */
// When using in business, additionally depend on @visactor/vchart-extension, and keep the package version consistent with vchart
// import { registerSeriesBreak, appendSeriesBreakConfig } from '@visactor/vchart-extension';
/** --Add the above code when using in business-- */

/** --Remove the following code when using in business-- */
const { registerSeriesBreak, appendSeriesBreakConfig } = VChartExtension;
/** --Remove the above code when using in business-- */

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

```

```
