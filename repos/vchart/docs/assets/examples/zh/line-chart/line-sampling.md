---
category: examples
group: line chart
title: 折线图数据采样
keywords: lineChart,comparison,trend,line
order: 0-12
cover: /vchart/preview/line-sampling_1.6.0.png
option: lineChart
---

# 折线图数据采样

折线图、面积图和柱状图在数据量远大于图表绘图区像素宽度（高度）时，会消耗大量冗余的计算；数据采样功能提供了这些情况的的降采样策略。使用数据采样后，在有效地优化图表加载效率的同时，也可以尽可能地展示数据的趋势。

## 关键配置

- `sampling` 属性声明为采样算法
  可选值:
  - `'lttb'`: 采用 Largest-Triangle-Three-Bucket 算法，可以最大程度保证采样后线条的趋势，形状和极值。
  - `'min'`: 取过滤点的最小值
  - `'max'`: 取过滤点的最大值
  - `'sum'`: 取过滤点的和
  - `'average'`: 取过滤点的平均值

## 代码演示

```javascript livedemo
const response = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/overlap-data.json');
const data = await response.json();

const spec = {
  type: 'common',
  // seriesField: 'color',
  data: [
    {
      id: 'id0',
      values: data
    },
    {
      id: 'id1',
      values: data
    },
    {
      id: 'id2',
      values: data
    }
  ],
  series: [
    {
      type: 'line',
      id: 'no sampling',
      dataIndex: 0,
      xField: 'x',
      yField: 'y',
      point: {
        style: {
          fill: '#1664FF'
        }
      },
      line: {
        style: {
          stroke: '#1664FF'
        }
      }
    },
    {
      type: 'line',
      id: 'lttb sampling',
      dataIndex: 1,
      xField: 'x',
      yField: 'y',
      sampling: 'lttb',
      samplingFactor: 0.1,
      point: {
        style: {
          fill: '#FF8A00'
        }
      },
      line: {
        style: {
          stroke: '#FF8A00'
        }
      }
    },
    {
      type: 'line',
      id: 'average sampling',
      dataIndex: 2,
      xField: 'x',
      yField: 'y',
      sampling: 'average',
      samplingFactor: 0.1,
      point: {
        style: {
          fill: '#FFC400'
        }
      },
      line: {
        style: {
          stroke: '#FFC400'
        }
      }
    }
  ],
  axes: [
    { orient: 'left', seriesIndex: [0, 1, 2, 3, 4, 5] },
    // { orient: 'right', seriesId: ['line'], grid: { visible: false } },
    { orient: 'bottom', label: { visible: true }, type: 'band' }
  ],
  legends: {
    visible: true,
    orient: 'bottom'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[折线图](link)
