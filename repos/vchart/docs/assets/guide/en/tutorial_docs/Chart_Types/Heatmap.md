# Heatmap

[\[Configuration Manual\]](../../../option/heatmapChart)

## Introduction

Heatmap in Cartesian coordinate system requires the x-axis and y-axis to be discrete axes. It has an additional `valueField` in the configuration compared to bar charts, which is used to specify the weight at a certain discrete coordinate.

One common example is to use a heatmap to represent the correlation between different statistical variables. By looking at the colors of different squares on the heatmap corresponding to the size of correlation coefficients, we can determine the size of the correlation between different variables.

In VChart, you can use the [Heatmap Configuration](../../../option/heatmapChart) to display the correlation between different variables. As shown in the following figure, this example shows the data of listed companies in 2016 by exploring the correlation between various indicators of listed companies through heatmap:

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/45df54929d214e7453e228f30.png)

In the [Heatmap Example](../../../demo/heatmap-chart/basic-heatmap) shown above, you need the following key configurations:

- Set `xField` attribute as the x-axis classification field
- Set `yField` attribute as the y-axis classification field
- `valueField` numeric field

## Chart Components

Heatmap consists of rectangle elements, axes, legends, and other components.

Rectangle elements are the basic elements of the heatmap, and related drawing configurations are essential:

- `heatmapChart.type`: Chart type, the type of heatmap is `'heatmap'`
- `heatmapChart.data`: Data source for chart drawing
- `heatmapChart.xField`: x-axis classification field, mapping element x coordinate
- `heatmapChart.yField`: y-axis classification field, mapping element y coordinate
- `heatmapChart.valueField`: Numeric field, indicating weight. By configuring the visual channel, it can be mapped to specific attributes of the element. The following code example shows how to map the weight to the color of the rectangle element:

```ts
{
  color: {
    type: 'linear', // Linear mapping
    domain: [
      {
        dataId: 'data0', // Dataset name
        fields: ['value'] // Corresponding weight field name
      }
    ],
    range: ['#feedde', '#fdbe85', '#fd8d3c', '#e6550d', '#a63603'] // Mapping result
  }
}
```

Axis, legend, and other components are optional configurations that support default effects and functions:

- `heatmapChart.axes`: Axes components, default display and automatically inferred coordinate system and data mapping logic according to chart type, detailed configuration can be found in [VChart Axes Component Configuration](../../../option/heatmapChart#axes)
- `heatmapChart.legends`: Legend components, linear legends are commonly used in heatmaps to display mapping relationships, detailed configuration can be found in [VChart Legend Component Configuration](../../../option/heatmapChart#legends)
- More component configurations can be found in [VChart heatmapChart Configuration](../../../option/heatmapChart)

## Getting Started

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

## Heatmap Features

### Data

- Two `discrete` fields, such as: `var1` `var2`
- One `numeric` field, such as: `value`

The data is defined as follows:

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
