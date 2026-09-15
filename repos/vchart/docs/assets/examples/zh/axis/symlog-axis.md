---
category: demo
group: axis
title: symlog轴
keywords: lineChart,comparison,composition,trend,axis
order: 25-6
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/axis/symlog-axis.png
option: lineChart#axes
---

# symlog 轴

Symlog 轴是一种用于绘制图表的坐标轴类型，它可以在对数轴和线性轴之间取得平衡，同时保留对数轴的优点和线性轴的优点。
Symlog 轴的特点是对称的，即正值和负值的刻度线对称分布在轴的两侧，这有助于更好地显示数据的正负关系。Symlog 轴的刻度线通常是按照对数轴的方式分布的，但是在接近 0 的区域，刻度线会转换为线性轴的方式分布，以更好地显示数据的绝对值。

## 关键配置

在 `axes` 属性上配置坐标轴类型：

- `type` 属性设置为`'symlog'`，用于配制坐标轴类型

## 代码演示

```javascript livedemo
const symexp = c => {
  return x => {
    return Math.sign(x) * Math.expm1(Math.abs(x)) * c;
  };
};
const scale = symexp(10);
// console.log('symlog', symlog(1))
const data = [];
for (let i = -5; i < 6; i++) {
  data.push({
    x: scale(i),
    y: i
  });
}
const spec = {
  type: 'common',
  layout: {
    type: 'grid',
    col: 2,
    row: 6,
    rowHeight: [
      {
        index: 0,
        size: 30
      },
      {
        index: 3,
        size: 20
      }
    ],
    elements: [
      {
        modelId: 'title',
        col: 1,
        row: 0
      },
      {
        modelId: 'line-region-A',
        col: 1,
        row: 1
      },
      {
        modelId: 'axis-left-A',
        col: 0,
        row: 1
      },
      {
        modelId: 'axis-bottom-A',
        col: 1,
        row: 2
      },
      {
        modelId: 'line-region-B',
        col: 1,
        row: 4
      },
      {
        modelId: 'axis-left-B',
        col: 0,
        row: 4
      },
      {
        modelId: 'axis-bottom-B',
        col: 1,
        row: 5
      }
    ]
  },
  region: [
    {
      id: 'line-region-A'
    },
    {
      id: 'line-region-B'
    }
  ],
  series: [
    {
      regionId: 'line-region-A',
      type: 'line',
      xField: 'x',
      yField: 'y',
      data: {
        id: 'line-A',
        values: data
      }
    },
    {
      regionId: 'line-region-B',
      type: 'line',
      xField: 'x',
      yField: 'y',
      data: {
        id: 'line-B',
        values: data
      }
    }
  ],
  title: {
    text: 'the example shows difference of linear axis and symlog axis',
    id: 'title'
  },
  axes: [
    {
      id: 'axis-left-A',
      regionId: 'line-region-A',
      orient: 'left',
      type: 'linear'
    },

    {
      id: 'axis-bottom-A',
      regionId: 'line-region-A',
      orient: 'bottom',
      type: 'linear'
    },
    {
      id: 'axis-left-B',
      regionId: 'line-region-B',
      orient: 'left',
      type: 'linear'
    },

    {
      id: 'axis-bottom-B',
      regionId: 'line-region-B',
      orient: 'bottom',
      type: 'symlog'
    }
  ]
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

附上和该 demo 配置相关联的教程或者 api 文档的链接。
