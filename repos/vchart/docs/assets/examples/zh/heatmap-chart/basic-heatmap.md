---
category: examples
group: heatmap chart
title: 基础热力图
keywords: heatmap,relationship,rectangle,comparison,distribution,trend
order: 19-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/heatmap-chart/basic-heatmap.png
option: heatmapChart
---

# 基础热力图

直角坐标系下的热力图要求 x 轴和 y 轴为离散轴，在配置上比柱状图多出了 `valueField`，用于指定某离散坐标下的权值。

一种常见的示例是使用热力图来表现统计变量之间的相关系数，根据热力图中不同方块颜色对应的相关系数的大小，可以判断出变量之间相关性的大小。

本示例根据 2016 年的上市企业数据，通过绘制热力图，来探究上市企业各指标之间的相关性。

## 关键配置

- `xField` 属性声明为 x 轴分类字段
- `yField` 属性声明为 y 轴分类字段
- `valueField` 数值字段

## 代码演示

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
  padding: 12,
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
      width: 200, // limit the width of the region
      height: 200, // limit the height of the region
      padding: {
        top: 40
      }
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
          textBaseline: 'middle',
          angle: 90,
          fontSize: 8
        }
      },
      bandPadding: 0,
      height: layoutRect => {
        // canvas height - region height - paddingTop - paddingBottom
        return layoutRect.height - 314;
      }
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
        space: 10,
        style: {
          fontSize: 8
        }
      },
      bandPadding: 0
    }
  ],
  legends: {
    visible: true,
    orient: 'right',
    position: 'start',
    type: 'color',
    field: 'value'
  },
  title: {
    visible: true,
    text: `Correlation Coefficient`
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[热力图](link)
