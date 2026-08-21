---
category: examples
group: line chart
title: 末尾虚线
keywords: lineChart,comparison,trend,line
order: 0-1
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/line-chart/dash-line.png
option: lineChart
---

# 末尾虚线

末尾虚线折线图主要通过数据标识以及 `line` 图元的 `lineDash` 样式。
当我们想对数据的某一段做一个区分的时候，可以设置线段的某一部分为特殊样式来突出这个特殊点。
例如在这个例子中，采用断点虚线表示预估基金涨跌最新数据的走向。

## 关键配置

- `line` 图元的 `lineDash` 样式设置为 `lineDash: [5, 5]`

## 代码演示

```javascript livedemo
const spec = {
  type: 'line',
  data: {
    values: [
      {
        x: '1st',
        y: 0.012
      },
      {
        x: '2nd',
        y: -0.01
      },
      {
        x: '3rd',
        y: 0.005
      },
      {
        x: '4th',
        y: 0.007
      },
      {
        x: '5th',
        y: 0.01
      },
      {
        x: '6th',
        y: 0.017
      },
      {
        x: '7th',
        y: 0.022
      },
      {
        x: '8th (prediction)',
        y: 0.033,
        latest: true
      }
    ]
  },
  xField: 'x',
  yField: 'y',
  line: {
    style: {
      lineDash: data => {
        if (data.latest) {
          return [5, 5];
        }
        return [0];
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 关键配置

无

## 相关教程

[折线图](link)
