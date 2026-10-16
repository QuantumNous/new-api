---
category: demo
group: axis
title: 轴截断
keywords: barChar,axis,trend,comparison,rectangle,richtext
cover: /vchart/preview/axis-break_1.12.2.png
option: barChart#axes
---

# 轴截断

对于直角坐标系下的线性轴，如果数据中存在极端值（离群值）或数据分布不均匀的情况，可以通过配置 `breaks` 属性来忽略部分数据区间，更好地突出显示特定的数据区间，从而使得图表更易于理解和分析。

## 关键配置

在 [`axes.breaks`](/vchart/option/barChart#axes-linear.breaks) 属性上配置忽略的数据区间。

## 代码演示

```javascript livedemo
const spec = {
  type: 'bar',
  data: {
    values: [
      {
        month: 'Jan',
        value: 44,
        type: 'Attraction 1'
      },
      {
        month: 'Jan',
        value: 64,
        type: 'Attraction 2'
      },
      {
        month: 'Feb',
        value: 128,
        type: 'Attraction 1'
      },
      {
        month: 'Feb',
        value: 138,
        type: 'Attraction 2'
      },
      {
        month: 'Mar',
        value: 180,
        type: 'Attraction 1'
      },
      {
        month: 'Mar',
        value: 164,
        type: 'Attraction 2'
      },
      {
        month: 'Apr',
        value: 345,
        type: 'Attraction 1'
      },
      {
        month: 'Apr',
        value: 408,
        type: 'Attraction 2'
      },
      {
        month: 'May',
        value: 3050,
        type: 'Attraction 1'
      },
      {
        month: 'May',
        value: 3120,
        type: 'Attraction 2'
      },
      {
        month: 'Jun',
        value: 3590,
        type: 'Attraction 1'
      },
      {
        month: 'Jun',
        value: 3540,
        type: 'Attraction 2'
      },
      {
        month: 'Jul',
        value: 3840,
        type: 'Attraction 1'
      },
      {
        month: 'Jul',
        value: 3875,
        type: 'Attraction 2'
      },
      {
        month: 'Aug',
        value: 3630,
        type: 'Attraction 1'
      },
      {
        month: 'Aug',
        value: 3420,
        type: 'Attraction 2'
      },
      {
        month: 'Sep',
        value: 3120,
        type: 'Attraction 1'
      },
      {
        month: 'Sep',
        value: 720,
        type: 'Attraction 2'
      },
      {
        month: 'Oct',
        value: 420,
        type: 'Attraction 1'
      },
      {
        month: 'Oct',
        value: 320,
        type: 'Attraction 2'
      },
      {
        month: 'Nov',
        value: 240,
        type: 'Attraction 1'
      },
      {
        month: 'Nov',
        value: 160,
        type: 'Attraction 2'
      },
      {
        month: 'Dec',
        value: 80,
        type: 'Attraction 1'
      },
      {
        month: 'Dec',
        value: 20,
        type: 'Attraction 2'
      }
    ]
  },
  xField: ['month', 'type'],
  yField: 'value',
  seriesField: 'type',
  axes: [
    {
      orient: 'left',
      breaks: [
        {
          range: [500, 3000],
          breakSymbol: {
            style: {
              stroke: '#D9DDE4'
            }
          }
        }
      ],
      domainLine: {
        visible: true
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```
