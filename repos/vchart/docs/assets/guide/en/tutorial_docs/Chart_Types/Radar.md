# Radar Chart

[\[Configuration Manual\]](../../../option/radarChart)

## Introduction

Radar Chart is a type of chart used to display multidimensional data. By mapping the values of each dimension to the corresponding angular axis, the distribution of data points in each dimension can be visualized as a closed shape, resembling a "radar".

## Chart Composition

A radar chart consists of closed area chart elements, point chart elements, polar coordinate axes, and other components, all in polar coordinates.

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/364e85f0a2e6efbc39057a001.png)

Area chart elements and point chart elements are the basic components of a radar chart, and related drawing configurations are essential:

- `radarChart.type`: Chart type, the type of radar chart is `'radar'`
- `radarChart.data`: Data source for chart drawing
- `radarChart.categoryField`: Category field, mapping the vertices of area chart elements or the angles where point chart elements are located
- `radarChart.valueField`: Value field, mapping the vertices of area chart elements or the radii where point chart elements are located

Coordinate axes, tooltips, and other components are optional for auxiliary chart display, with default effects and features:

- `radarChart.axes`: Axis component, displayed by default and automatically inferred based on chart type coordinate system and data mapping logic, detailed configuration see [VChart Axis Component Configuration](../../../option/radarChart#axes)
- `radarChart.tooltip`: Tooltip information, displayed interactively by default, detailed configuration see [VChart Tooltip Information Component Configuration](../../../option/radarChart#tooltip)
- More component configurations see [VChart radarChart configuration](../../../option/radarChart)

### Quick Start

```javascript livedemo
const spec = {
  type: 'radar',
  data: [
    {
      id: '白金',
      values: [
        {
          key: '力量',
          value: 5
        },
        {
          key: '速度',
          value: 5
        },
        {
          key: '射程',
          value: 3
        },
        {
          key: '持续',
          value: 5
        },
        {
          key: '精密',
          value: 5
        },
        {
          key: '成长',
          value: 5
        }
      ]
    }
  ],
  categoryField: 'key',
  valueField: 'value',
  area: {
    visible: true // 展示面积
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

## Radar Chart Features

### Data

- A `discrete` field, such as: `product`, used to map different sectors
- A `numeric` field, such as: `sales`, used to map sector radius

A data definition for a set of product categories and sales amounts is as follows:

```ts
data: [
  {
    name: 'radar',
    values: [
      {
        product: 'Digital Products',
        sales: 20
      },
      {
        product: 'Daily Necessities',
        sales: 50
      },
      {
        product: 'Food',
        sales: 80
      }
    ]
  }
];
```

### Chart Layout

#### Grouped Radar Chart

Grouped radar chart can display multiple radar series at the same time, making it easy to compare different data in the same dimension.

Since the drawing of a radar chart is essentially determined by connected point chart elements, it does not need to be spaced apart like grouped bar charts, grouped rose charts, and other charts, but simply overlaps or intersects. Reflected in the configuration is: Grouped radar chart does not require additional declaration, as long as the number of categories in `radarChart.categoryField` data is greater than 1, the grouped effect can be displayed automatically. To differentiate different radar chart elements, you need to specify the `radarChart.seriesField` field, which by default maps the element color.

```javascript livedemo
const mockData = [];
const types = ['A', 'B', 'C'];

types.forEach(type => {
  for (let i = 1; i <= 12; i++) {
    mockData.push({ month: i + '月', value: Math.random() * 100 + 10, type });
  }
});

const spec = {
  type: 'radar',
  data: [
    {
      values: mockData
    }
  ],
  categoryField: 'month',
  valueField: 'value',
  seriesField: 'type', // 声明分组字段
  axes: [
    {
      orient: 'radius', // 半径轴配置
      grid: {
        smooth: true, // 平滑的网格线
        style: {
          lineDash: [0]
        },
        alternateColor: '#f5f5f5' // 配置栅格线间的背景色
      }
    },
    {
      orient: 'angle', // 角度轴配置
      tick: {
        visible: false
      },
      domainLine: {
        visible: true,
        style: {
          stroke: '#333'
        }
      },
      grid: {
        style: {
          lineDash: [0]
        }
      }
    }
  ],
  legends: {
    visible: true,
    orient: 'top'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### Stacked Radar Chart

By configuring the grouping field in `radarChart.seriesField` and enabling the `radarChart.stack` attribute, you can stack the data of the radar chart.

```javascript livedemo
const spec = {
  type: 'radar',
  data: [
    {
      values: [
        {
          month: '1月',
          value: 45,
          type: 'A'
        },
        {
          month: '2月',
          value: 61,
          type: 'A'
        },
        {
          month: '3月',
          value: 92,
          type: 'A'
        },
        {
          month: '4月',
          value: 57,
          type: 'A'
        },
        {
          month: '5月',
          value: 46,
          type: 'A'
        },
        {
          month: '6月',
          value: 36,
          type: 'A'
        },
        {
          month: '7月',
          value: 33,
          type: 'A'
        },
        {
          month: '8月',
          value: 63,
          type: 'A'
        },
        {
          month: '9月',
          value: 57,
          type: 'A'
        },
        {
          month: '10月',
          value: 53,
          type: 'A'
        },
        {
          month: '11月',
          value: 69,
          type: 'A'
        },
        {
          month: '12月',
          value: 40,
          type: 'A'
        },
        {
          month: '1月',
          value: 31,
          type: 'B'
        },
        {
          month: '2月',
          value: 39,
          type: 'B'
        },
        {
          month: '3月',
          value: 81,
          type: 'B'
        },
        {
          month: '4月',
          value: 39,
          type: 'B'
        },
        {
          month: '5月',
          value: 64,
          type: 'B'
        },
        {
          month: '6月',
          value: 21,
          type: 'B'
        },
        {
          month: '7月',
          value: 58,
          type: 'B'
        },
        {
          month: '8月',
          value: 72,
          type: 'B'
        },
        {
          month: '9月',
          value: 47,
          type: 'B'
        },
        {
          month: '10月',
          value: 37,
          type: 'B'
        },
        {
          month: '11月',
          value: 80,
          type: 'B'
        },
        {
          month: '12月',
          value: 74,
          type: 'B'
        },
        {
          month: '1月',
          value: 90,
          type: 'C'
        },
        {
          month: '2月',
          value: 95,
          type: 'C'
        },
        {
          month: '3月',
          value: 62,
          type: 'C'
        },
        {
          month: '4月',
          value: 52,
          type: 'C'
        },
        {
          month: '5月',
          value: 74,
          type: 'C'
        },
        {
          month: '6月',
          value: 87,
          type: 'C'
        },
        {
          month: '7月',
          value: 80,
          type: 'C'
        },
        {
          month: '8月',
          value: 69,
          type: 'C'
        },
        {
          month: '9月',
          value: 74,
          type: 'C'
        },
        {
          month: '10月',
          value: 84,
          type: 'C'
        },
        {
          month: '11月',
          value: 94,
          type: 'C'
        },
        {
          month: '12月',
          value: 23,
          type: 'C'
        }
      ]
    }
  ],
  categoryField: 'month',
  valueField: 'value',
  seriesField: 'type', // 声明分组字段
  stack: true,
  area: {
    visible: true // 展示面积
  },
  axes: [
    {
      orient: 'radius', // 半径轴配置
      min: 0,
      domainLine: {
        visible: true
      },
      label: {
        visible: true
      },
      grid: {
        smooth: true // 平滑的网格线
      }
    },
    {
      orient: 'angle', // 角度轴配置
      tick: {
        visible: false
      }
    }
  ],
  legends: {
    visible: true,
    orient: 'top'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### Percentage Stacked Radar Chart

Enable `radarChart.percent` on the basis of stacking to obtain a normalized percentage stacked radar chart.

```javascript livedemo
const spec = {
  type: 'radar',
  data: [
    {
      values: [
        {
          month: '1月',
          value: 45,
          type: 'A'
        },
        {
          month: '2月',
          value: 61,
          type: 'A'
        },
        {
          month: '3月',
          value: 92,
          type: 'A'
        },
        {
          month: '4月',
          value: 57,
          type: 'A'
        },
        {
          month: '5月',
          value: 46,
          type: 'A'
        },
        {
          month: '6月',
          value: 36,
          type: 'A'
        },
        {
          month: '7月',
          value: 33,
          type: 'A'
        },
        {
          month: '8月',
          value: 63,
          type: 'A'
        },
        {
          month: '9月',
          value: 57,
          type: 'A'
        },
        {
          month: '10月',
          value: 53,
          type: 'A'
        },
        {
          month: '11月',
          value: 69,
          type: 'A'
        },
        {
          month: '12月',
          value: 40,
          type: 'A'
        },
        {
          month: '1月',
          value: 31,
          type: 'B'
        },
        {
          month: '2月',
          value: 39,
          type: 'B'
        },
        {
          month: '3月',
          value: 81,
          type: 'B'
        },
        {
          month: '4月',
          value: 39,
          type: 'B'
        },
        {
          month: '5月',
          value: 64,
          type: 'B'
        },
        {
          month: '6月',
          value: 21,
          type: 'B'
        },
        {
          month: '7月',
          value: 58,
          type: 'B'
        },
        {
          month: '8月',
          value: 72,
          type: 'B'
        },
        {
          month: '9月',
          value: 47,
          type: 'B'
        },
        {
          month: '10月',
          value: 37,
          type: 'B'
        },
        {
          month: '11月',
          value: 80,
          type: 'B'
        },
        {
          month: '12月',
          value: 74,
          type: 'B'
        },
        {
          month: '1月',
          value: 90,
          type: 'C'
        },
        {
          month: '2月',
          value: 95,
          type: 'C'
        },
        {
          month: '3月',
          value: 62,
          type: 'C'
        },
        {
          month: '4月',
          value: 52,
          type: 'C'
        },
        {
          month: '5月',
          value: 74,
          type: 'C'
        },
        {
          month: '6月',
          value: 87,
          type: 'C'
        },
        {
          month: '7月',
          value: 80,
          type: 'C'
        },
        {
          month: '8月',
          value: 69,
          type: 'C'
        },
        {
          month: '9月',
          value: 74,
          type: 'C'
        },
        {
          month: '10月',
          value: 84,
          type: 'C'
        },
        {
          month: '11月',
          value: 94,
          type: 'C'
        },
        {
          month: '12月',
          value: 23,
          type: 'C'
        }
      ]
    }
  ],
  categoryField: 'month',
  valueField: 'value',
  seriesField: 'type', // 声明分组字段
  stack: true,
  percent: true,
  area: {
    visible: true // 展示面积
  },
  axes: [
    {
      orient: 'radius', // 半径轴配置
      min: 0,
      domainLine: {
        visible: true
      },
      label: {
        visible: true,
        formatMethod: val => {
          return val * 100 + '%';
        }
      },
      grid: {
        smooth: false,
        style: {
          lineDash: [0]
        }
      }
    },
    {
      orient: 'angle', // 角度轴配置
      tick: {
        visible: false
      },
      domainLine: {
        visible: false
      },
      grid: {
        style: {
          lineDash: [0]
        }
      }
    }
  ],
  legends: {
    visible: true,
    orient: 'top'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```
