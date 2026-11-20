# 热力图

[\[配置项\]](../../../option/heatmapChart)

## 简介

直角坐标系下的热力图要求 x 轴和 y 轴为离散轴，在配置上比柱状图多出了 `valueField`，用于指定某离散坐标下的权值。

一种常见的示例是使用热力图来表现统计变量之间的相关系数，根据热力图中不同方块颜色对应的相关系数的大小，可以判断出变量之间相关性的大小。

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/45df54929d214e7453e228f30.png)

## 图表构成

热力图由矩形图元、坐标轴、图例等其他组件构成。

矩形图元为热力图的基本要素，相关的绘制配置必不可少:

- `heatmapChart.type`: 图表类型，热力图的类型为`'heatmap'`
- `heatmapChart.data`: 图表绘制的数据源
- `heatmapChart.xField`: x 轴分类字段，映射图元的 x 坐标
- `heatmapChart.yField`: y 轴分类字段，映射图元的 y 坐标
- `heatmapChart.valueField`: 数值字段，表示权重，需配合视觉通道的配置即可将其映射到图元的具体属性上，下面的代码示例展示了如何将权重映射为矩形图元的颜色：

```ts
{
  color: {
    type: 'linear', // 线性映射
    domain: [
      {
        dataId: 'data0', // 数据集名称
        fields: ['value'] // 对应的权重字段名称
      }
    ],
    range: ['#feedde', '#fdbe85', '#fd8d3c', '#e6550d', '#a63603'] // 映射结果
  }
}
```

坐标轴、图例等作为辅助图表展示的组件，属于可选配置，自带默认效果和功能:

- `heatmapChart.axes`: 坐标轴组件，默认显示并根据图表类型自动推断坐标系及数据映射逻辑，详情配置见[VChart 坐标轴组件配置](../../../option/heatmapChart#axes)
- `heatmapChart.legends`: 图例组件，在热力图中通常使用线性图例显示映射关系，详情配置见[VChart 图例组件配置](../../../option/heatmapChart#legends)
- 更多组件配置见[VChart heatmapChart 配置](../../../option/heatmapChart)

## 快速上手

```javascript livedemo
const items = [
  'Asset Liability Ratio',
  'Asset Liability Ratio (Deducting Advance Payments)',
  'Debt-to-long Capital Ratio',
  'Long Term Asset Suitability Ratio',
  'Equity Multiplier',
  'Equity Ratio of Current Liability',
  'Interest Bearing Debt / Fully Invested Capital',
  'Current Liability / Total Liabilities',
  'Capital Fixation Ratio',
  'Expected Default Frequency'
];
const rawData = [
  1.0, 0.594527, 0.492963, -0.160995, 0.723664, 0.658646, -0.857474, 0.320706, -0.284634, -0.091423, 0.594527, 1.0,
  0.724546, -0.099318, 0.540639, 0.49214, -0.554039, 0.17127, -0.265259, 0.068577, 0.492963, 0.724546, 1.0, -0.091338,
  0.450542, 0.375839, -0.524955, 0.300627, -0.198362, 0.033209, -0.160995, -0.099318, -0.091338, 1.0, -0.049872,
  -0.028452, 0.157157, 0.009742, -0.162374, 0.155095, 0.723664, 0.540639, 0.450542, -0.049872, 1.0, 0.951933, -0.651767,
  0.079052, -0.535984, 0.00798, 0.658646, 0.49214, 0.375839, -0.028452, 0.951933, 1.0, -0.543147, -0.106139, -0.52232,
  0.011466, -0.857474, -0.554039, -0.524955, 0.157157, -0.651767, -0.543147, 1.0, -0.595016, 0.310521, 0.066397,
  0.320706, 0.17127, 0.300627, 0.009742, 0.079052, -0.106139, -0.595016, 1.0, -0.105199, -0.064886, -0.284634,
  -0.265259, -0.198362, -0.162374, -0.535984, -0.52232, 0.310521, -0.105199, 1.0, -0.080153, -0.091423, 0.068577,
  0.033209, 0.155095, 0.00798, 0.011466, 0.066397, -0.064886, -0.080153, 1.0
];
const data = [];
for (let i = 0; i < items.length; i++) {
  for (let j = 0; j < items.length; j++) {
    data.push({
      var1: items[i],
      var2: items[j],
      value: rawData[i * items.length + j]
    });
  }
}

const spec = {
  type: 'common',
  data: [
    {
      id: 'data0',
      values: data
    }
  ],
  series: [
    {
      type: 'heatmap',
      regionId: 'region0',
      xField: 'var1',
      yField: 'var2',
      valueField: 'value',
      cell: {
        style: {
          fill: {
            field: 'value',
            scale: 'color'
          }
        }
      }
    }
  ],
  region: [
    {
      id: 'region0',
      style: {
        lineWidth: 1,
        stroke: 'red'
      },
      width: 200,
      height: 200
    }
  ],
  color: {
    type: 'linear',
    domain: [
      {
        dataId: 'data0',
        fields: ['value']
      }
    ],
    range: ['#feedde', '#fdbe85', '#fd8d3c', '#e6550d', '#a63603']
  },
  axes: [
    {
      orient: 'bottom',
      type: 'band',
      grid: {
        visible: false
      },
      domainLine: {
        visible: false
      },
      label: {
        space: 10,
        style: {
          textAlign: 'left',
          angle: 90
        }
      },
      bandPadding: 0
    },
    {
      orient: 'left',
      type: 'band',
      grid: {
        visible: false
      },
      domainLine: {
        visible: false
      },
      label: {
        space: 10
      },
      bandPadding: 0
    }
  ],
  legends: {
    visible: true,
    orient: 'right',
    type: 'color',
    field: 'value',
    title: {
      visible: true,
      text: `Correlation Coefficient`
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

## 热力图特性

### 数据

- 两个`离散` 字段，如: `var1` `var2`
- 一个`数值`字段，如: `value`

数据定义如下：

```ts
data: [
  {
    name: 'heatmap',
    values: [
      {
        var1: 'Asset Liability Ratio',
        var2: 'Asset Liability Ratio',
        value: 1
      },
      {
        var1: 'Asset Liability Ratio',
        var2: 'Asset Liability Ratio (Deducting Advance Payments)',
        value: 0.5
      },
      {
        var1: 'Asset Liability Ratio (Deducting Advance Payments)',
        var2: 'Asset Liability Ratio (Deducting Advance Payments)',
        value: 1
      }
    ]
  }
];
```
