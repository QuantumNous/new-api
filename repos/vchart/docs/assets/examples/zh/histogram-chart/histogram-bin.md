---
category: examples
group: histogram chart
title: 基础直方图
keywords: histogram,distribution,rectangle
order: 3-4
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/histogram-chart/histogram-bin_2.0.7.png
option: histogramChart
---

# 基础直方图

本示例展示如何使用 bin 分箱对原始数据进行处理，并生成基础直方图。通过设置 `xField`、`x2Field` 和 `yField`，可以分别指定分箱区间的起始、结束和频数字段。

## 关键配置说明

- `xField`：指定分箱区间的左端点字段（如 `x0`）。
- `x2Field`：指定分箱区间的右端点字段（如 `x1`）。
- `yField`：指定每个分箱的频数字段（如 `frequency`）。

通过这些配置，可以将明细数据转化为直方图所需的分箱统计数据，实现数据分布的可视化。

## 代码演示

```javascript livedemo
const spec = {
  data: [
    {
      name: 'data1',
      transforms: [
        {
          type: 'bin',
          options: {
            step: 2,
            field: 'value',
            outputNames: { x0: 'x0', x1: 'x1', count: 'frequency' }
          }
        }
      ],
      values: [
        { value: 2 },
        { value: 2 },
        { value: 2 },
        { value: 2 },
        { value: 2 },
        { value: 2 },
        { value: 2 },
        { value: 2 },
        { value: 2 },
        { value: 2 },
        { value: 2.3 },
        { value: 2.3 },
        { value: 2.3 },
        { value: 2.3 },
        { value: 2.3 },
        { value: 2.3 },
        { value: 2.3 },
        { value: 4 },
        { value: 4 },
        { value: 4 },
        { value: 4 },
        { value: 4 },
        { value: 7 },
        { value: 7 },
        { value: 7 },
        { value: 7 },
        { value: 7 },
        { value: 7 },
        { value: 7 },
        { value: 7 },
        { value: 7 },
        { value: 7 },
        { value: 7 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 }
      ]
    }
  ],
  type: 'histogram',
  xField: 'x0',
  x2Field: 'x1',
  yField: 'frequency',
  bar: {
    style: {
      stroke: 'white',
      lineWidth: 1
    }
  },
  title: {
    text: 'Histogram by bin transform'
  },
  tooltip: {
    visible: true,
    mark: {
      title: {
        key: 'title',
        value: 'frequency'
      },
      content: [
        {
          key: datum => datum['x0'] + '～' + datum['x1'],
          value: datum => datum['frequency']
        }
      ]
    }
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```
