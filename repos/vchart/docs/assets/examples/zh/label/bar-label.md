---
category: examples
group: label
title: 柱状图标签
keywords: label
order: 35-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/label/bar-label.png
option: barChart#label
---

# 柱状图标签

在图表中，标签是对当前图形所展示数据的信息标注，可以用于解释说明图形的一些数据含义，例如数值、名称等；

## 关键配置

在图元上配置纹理相关的属性即可：

- `label`: 标签配置。
  - `visible`: 显示标签。
  - `style`: 标签样式配置。
  - `position`：标签位置配置。本例中配置标签在图元内部（`inside`）。
  - `overlap`：标签防重叠配置。本例中对检测到发生碰撞的标签配置了 2 种躲避策略：
    - `bound`：当图形大小不足以放下当前标签，则尝试放在 position 内的备选位置，即`top`图元顶部。
    - `moveY`：若没有足够的空间放置当前标签，则根据 offset 在 y 方向上寻找位置。

## 代码演示

```javascript livedemo
const spec = {
  stack: true,
  data: [
    {
      name: 'allData',
      values: [
        {
          name: 'A',
          value: 0.12,
          group: '7+'
        },
        {
          name: 'B',
          value: 0.34,
          group: '7+'
        },
        {
          name: 'C',
          value: 0.25,
          group: '7+'
        },
        {
          name: 'D',
          value: 0.48,
          group: '7+'
        },
        {
          name: 'E',
          value: 0.55,
          group: '7+'
        },
        {
          name: 'F',
          value: 0.42,
          group: '7+'
        },
        {
          name: 'A',
          value: 0.23,
          group: '6-7'
        },
        {
          name: 'B',
          value: 0.25,
          group: '6-7'
        },
        {
          name: 'C',
          value: 0.18,
          group: '6-7'
        },
        {
          name: 'D',
          value: 0.19,
          group: '6-7'
        },
        {
          name: 'E',
          value: 0.15,
          group: '6-7'
        },
        {
          name: 'F',
          value: 0.12,
          group: '6-7'
        },
        {
          name: 'A',
          value: 0.31,
          group: '4-5'
        },
        {
          name: 'B',
          value: 0.33,
          group: '4-5'
        },
        {
          name: 'C',
          value: 0.4,
          group: '4-5'
        },
        {
          name: 'D',
          value: 0.24,
          group: '4-5'
        },
        {
          name: 'E',
          value: 0.18,
          group: '4-5'
        },
        {
          name: 'F',
          value: 0.2,
          group: '4-5'
        },
        {
          name: 'A',
          value: 0.56,
          group: '2-3'
        },
        {
          name: 'B',
          value: 0.29,
          group: '2-3'
        },
        {
          name: 'C',
          value: 0.15,
          group: '2-3'
        },
        {
          name: 'D',
          value: 0.01,
          group: '2-3'
        },
        {
          name: 'E',
          value: 0.14,
          group: '2-3'
        },
        {
          name: 'F',
          value: 0.16,
          group: '2-3'
        },
        {
          name: 'A',
          value: 0.15,
          group: '1'
        },
        {
          name: 'B',
          value: 0.11,
          group: '1'
        },
        {
          name: 'C',
          value: 0.015,
          group: '1'
        },
        {
          name: 'D',
          value: 0.02,
          group: '1'
        },
        {
          name: 'E',
          value: 0,
          group: '1'
        },
        {
          name: 'F',
          value: 0.05,
          group: '1'
        }
      ]
    }
  ],
  color: ['#009DB5', '#F0B71F', '#EB6F02', '#1E5273', '#3BA140'],
  label: {
    visible: true,
    position: 'inside',
    style: {
      stroke: 'white',
      lineWidth: 2
    },
    overlap: {
      strategy: [
        {
          type: 'bound',
          position: ['top']
        },
        {
          type: 'moveY',
          offset: [-2, -4, -8, -10, -12]
        }
      ]
    }
  },
  type: 'bar',
  xField: 'name',
  yField: 'value',
  seriesField: 'group'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[散点图](link)
