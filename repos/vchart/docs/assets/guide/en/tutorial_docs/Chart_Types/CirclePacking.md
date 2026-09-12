# Circle Packing

[\[Configuration Manual\]](../../../option/circlePackingChart)

## Introduction

Circle Packing is a circular-based data visualization chart that represents hierarchical data using nested circles. In this type of chart, smaller circles are nested within larger circles, and the size and position of each circle usually reflect the relative values and hierarchical relationships of the data. The properties of the circles, such as size and color, can also be used to provide additional information. Circle Packing charts are commonly used for visual analysis in data mining, ecosystems, and social media analytics, among other fields, but can also be used for other types of data visualization tasks.

## Chart Components

Circle Packing mainly comprises nested circle graphics, labels, tooltips, and other elements or components.

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/03421afda76ced0240204bf02.png)

Nested circle graphics are the basic elements of Circle Packing, and the related drawing configurations are essential:

- `circlePackingChart.type`: Chart type, the type for Circle Packing is `'circlePacking'`
- `circlePackingChart.data`: Data source for chart rendering. In the case of Circle Packing, it is usually a hierarchical structure, like this:

```ts
[
  {
    name: 'A',
    children: [
      { name: 'A-a', value: 1 },
      { name: 'A-b', value: 2 }
    ]
  },
  {
    name: 'B',
    children: [
      { name: 'B-a', value: 3 },
      { name: 'B-b', value: 4 }
    ]
  }
];
```

- `circlePackingChart.categoryField`: Category field, mapping different graphics
- `circlePackingChart.valueField`: Value field, mapping the size of the graphics

Tooltips and other auxiliary components for chart display are optional configuration, with default effects and functionality:

- `circlePackingChart.tooltip`: Tooltip, displayed by default when interacting, detailed configuration can be found in [VChart Tooltip Component Configuration](../../../option/circlePackingChart#tooltip)
- For more component configuration, see [VChart circlePackingChart Configuration](../../../option/circlePackingChart)

## Quick Start

```javascript livedemo
const data = [
  {
    name: 'root',
    children: [
      {
        name: 'Country A',
        children: [
          {
            name: 'Region1',
            children: [
              { name: 'Office Supplies', value: 824 },
              { name: 'Furniture', value: 920 },
              { name: 'Electronic equipment', value: 936 }
            ]
          },
          {
            name: 'Region2',
            children: [
              { name: 'Office Supplies', value: 1270 },
              { name: 'Furniture', value: 1399 },
              { name: 'Electronic equipment', value: 1466 }
            ]
          },
          {
            name: 'Region3',
            children: [
              { name: 'Office Supplies', value: 1408 },
              { name: 'Furniture', value: 1676 },
              { name: 'Electronic equipment', value: 1559 }
            ]
          },
          {
            name: 'Region4',
            children: [
              { name: 'Office Supplies', value: 745 },
              { name: 'Furniture', value: 919 },
              { name: 'Electronic equipment', value: 781 }
            ]
          },
          {
            name: 'Region5',
            children: [
              { name: 'Office Supplies', value: 267 },
              { name: 'Furniture', value: 316 },
              { name: 'Electronic equipment', value: 230 }
            ]
          },
          {
            name: 'Region6',
            children: [
              { name: 'Office Supplies', value: 347 },
              { name: 'Furniture', value: 501 },
              { name: 'Electronic equipment', value: 453 }
            ]
          }
        ]
      },
      {
        name: 'Country B',
        children: [
          {
            name: 'Region1',
            children: [
              { name: 'Office Supplies', value: 824 },
              { name: 'Furniture', value: 920 },
              { name: 'Electronic equipment', value: 936 }
            ]
          },
          {
            name: 'Region2',
            children: [
              { name: 'Office Supplies', value: 1270 },
              { name: 'Furniture', value: 1399 },
              { name: 'Electronic equipment', value: 1466 }
            ]
          },
          {
            name: 'Region3',
            children: [
              { name: 'Office Supplies', value: 1408 },
              { name: 'Furniture', value: 1676 },
              { name: 'Electronic equipment', value: 1559 }
            ]
          },
          {
            name: 'Region4',
            children: [
              { name: 'Office Supplies', value: 745 },
              { name: 'Furniture', value: 919 },
              { name: 'Electronic equipment', value: 781 }
            ]
          },
          {
            name: 'Region5',
            children: [
              { name: 'Office Supplies', value: 267 },
              { name: 'Furniture', value: 316 },
              { name: 'Electronic equipment', value: 230 }
            ]
          },
          {
            name: 'Region6',
            children: [
              { name: 'Office Supplies', value: 347 },
              { name: 'Furniture', value: 501 },
              { name: 'Electronic equipment', value: 453 }
            ]
          }
        ]
      },
      {
        name: 'Country C',
        children: [
          {
            name: 'Region1',
            children: [
              { name: 'Office Supplies', value: 824 },
              { name: 'Furniture', value: 920 },
              { name: 'Electronic equipment', value: 936 }
            ]
          },
          {
            name: 'Region2',
            children: [
              { name: 'Office Supplies', value: 1270 },
              { name: 'Furniture', value: 1399 },
              { name: 'Electronic equipment', value: 1466 }
            ]
          },
          {
            name: 'Region3',
            children: [
              { name: 'Office Supplies', value: 1408 },
              { name: 'Furniture', value: 1676 },
              { name: 'Electronic equipment', value: 1559 }
            ]
          },
          {
            name: 'Region4',
            children: [
              { name: 'Office Supplies', value: 745 },
              { name: 'Furniture', value: 919 },
              { name: 'Electronic equipment', value: 781 }
            ]
          },
          {
            name: 'Region5',
            children: [
              { name: 'Office Supplies', value: 267 },
              { name: 'Furniture', value: 316 },
              { name: 'Electronic equipment', value: 230 }
            ]
          },
          {
            name: 'Region6',
            children: [
              { name: 'Office Supplies', value: 347 },
              { name: 'Furniture', value: 501 },
              { name: 'Electronic equipment', value: 453 }
            ]
          }
        ]
      }
    ]
  }
];

const spec = {
  data: [
    {
      id: 'data',
      values: data
    }
  ],
  type: 'circlePacking',
  categoryField: 'name',
  valueField: 'value',
  circlePacking: {
    style: {
      fillOpacity: d => (d.isLeaf ? 0.75 : 0.25)
    }
  },
  label: {
    style: {
      fontSize: 10,
      visible: d => {
        return d.depth === 1;
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window.vchart = vchart;
```

### Key Configurations

- `categoryField` property declaration as classification field
- `valueField` property declaration as a numeric field
- `circlePacking` Circle graphic configuration. By default, all graphics have the same style. To show hierarchical relationships, it is usually necessary to differentiate graphics of different levels through the `callback` form.
- `label` Label graphic configuration. By default, each graphics object has a label. The leaf node's graphics are smaller, and the corresponding labels will inevitably overlap when displayed, so you need to manually configure the font size and visibility.

## Circle Packing Features

### Data

As mentioned earlier, Circle Packing expresses nested relationships in the data using nested circles. Thus, the source data must be of a nested structure, such as:

```ts
[
  {
    name: 'A',
    children: [
      { name: 'A-a', value: 1 },
      { name: 'A-b', value: 2 }
    ]
  },
  {
    name: 'B',
    children: [
      { name: 'B-a', value: 3 },
      { name: 'B-b', value: 4 }
    ]
  }
];
```

### Chart Layout

You can control the padding between nested layers by configuring `circlePackingChart.layoutPadding` Supports passing in an array to separately control the inner padding of a specific layer.

```javascript livedemo
const data = [
  {
    name: 'root',
    children: [
      {
        name: 'Country A',
        children: [
          {
            name: 'Region1',
            children: [
              { name: 'Office Supplies', value: 824 },
              { name: 'Furniture', value: 920 },
              { name: 'Electronic equipment', value: 936 }
            ]
          },
          {
            name: 'Region2',
            children: [
              { name: 'Office Supplies', value: 1270 },
              { name: 'Furniture', value: 1399 },
              { name: 'Electronic equipment', value: 1466 }
            ]
          },
          {
            name: 'Region3',
            children: [
              { name: 'Office Supplies', value: 1408 },
              { name: 'Furniture', value: 1676 },
              { name: 'Electronic equipment', value: 1559 }
            ]
          },
          {
            name: 'Region4',
            children: [
              { name: 'Office Supplies', value: 745 },
              { name: 'Furniture', value: 919 },
              { name: 'Electronic equipment', value: 781 }
            ]
          },
          {
            name: 'Region5',
            children: [
              { name: 'Office Supplies', value: 267 },
              { name: 'Furniture', value: 316 },
              { name: 'Electronic equipment', value: 230 }
            ]
          },
          {
            name: 'Region6',
            children: [
              { name: 'Office Supplies', value: 347 },
              { name: 'Furniture', value: 501 },
              { name: 'Electronic equipment', value: 453 }
            ]
          }
        ]
      },
      {
        name: 'Country B',
        children: [
          {
            name: 'Region1',
            children: [
              { name: 'Office Supplies', value: 824 },
              { name: 'Furniture', value: 920 },
              { name: 'Electronic equipment', value: 936 }
            ]
          },
          {
            name: 'Region2',
            children: [
              { name: 'Office Supplies', value: 1270 },
              { name: 'Furniture', value: 1399 },
              { name: 'Electronic equipment', value: 1466 }
            ]
          },
          {
            name: 'Region3',
            children: [
              { name: 'Office Supplies', value: 1408 },
              { name: 'Furniture', value: 1676 },
              { name: 'Electronic equipment', value: 1559 }
            ]
          },
          {
            name: 'Region4',
            children: [
              { name: 'Office Supplies', value: 745 },
              { name: 'Furniture', value: 919 },
              { name: 'Electronic equipment', value: 781 }
            ]
          },
          {
            name: 'Region5',
            children: [
              { name: 'Office Supplies', value: 267 },
              { name: 'Furniture', value: 316 },
              { name: 'Electronic equipment', value: 230 }
            ]
          },
          {
            name: 'Region6',
            children: [
              { name: 'Office Supplies', value: 347 },
              { name: 'Furniture', value: 501 },
              { name: 'Electronic equipment', value: 453 }
            ]
          }
        ]
      },
      {
        name: 'Country C',
        children: [
          {
            name: 'Region1',
            children: [
              { name: 'Office Supplies', value: 824 },
              { name: 'Furniture', value: 920 },
              { name: 'Electronic equipment', value: 936 }
            ]
          },
          {
            name: 'Region2',
            children: [
              { name: 'Office Supplies', value: 1270 },
              { name: 'Furniture', value: 1399 },
              { name: 'Electronic equipment', value: 1466 }
            ]
          },
          {
            name: 'Region3',
            children: [
              { name: 'Office Supplies', value: 1408 },
              { name: 'Furniture', value: 1676 },
              { name: 'Electronic equipment', value: 1559 }
            ]
          },
          {
            name: 'Region4',
            children: [
              { name: 'Office Supplies', value: 745 },
              { name: 'Furniture', value: 919 },
              { name: 'Electronic equipment', value: 781 }
            ]
          },
          {
            name: 'Region5',
            children: [
              { name: 'Office Supplies', value: 267 },
              { name: 'Furniture', value: 316 },
              { name: 'Electronic equipment', value: 230 }
            ]
          },
          {
            name: 'Region6',
            children: [
              { name: 'Office Supplies', value: 347 },
              { name: 'Furniture', value: 501 },
              { name: 'Electronic equipment', value: 453 }
            ]
          }
        ]
      }
    ]
  }
];

const spec = {
  data: [
    {
      id: 'data',
      values: data
    }
  ],
  type: 'circlePacking',
  categoryField: 'name',
  valueField: 'value',
  circlePacking: {
    style: {
      fillOpacity: d => (d.isLeaf ? 0.75 : 0.25)
    }
  },
  layoutPadding: [0, 10, 10],
  label: {
    style: {
      fontSize: 10,
      visible: d => {
        return d.depth === 1;
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window.vchart = vchart;
```

### Chart Interactions

#### Drill Down

The drill-down feature is the ability to click on a parent category to delve into the sub-category information when displaying different levels of sub-data in a rectangular tree chart, Circle Packing, and sunburst chart. With the drill-down feature, users can view details level by level, explore data hierarchy details more deeply, and better understand relationships and differences between data to draw higher-quality analytical conclusions.

By configuring `circlePackingChart.drill: true` and `circlePackingChart.drillField`, you can respectively enable the drill-down feature and configure the field on which drilling depends (the drill-down field will use the autogenerated unique key by default, but you need to configure the `drillField` when using the API for drilling).

```javascript livedemo
const data = [
  {
    name: 'root',
    children: [
      {
        name: 'Country A',
        children: [
          {
            name: 'Region1',
            children: [
              { name: 'Office Supplies', value: 824 },
              { name: 'Furniture', value: 920 },
              { name: 'Electronic equipment', value: 936 }
            ]
          },
          {
            name: 'Region2',
            children: [
              { name: 'Office Supplies', value: 1270 },
              { name: 'Furniture', value: 1399 },
              { name: 'Electronic equipment', value: 1466 }
            ]
          },
          {
            name: 'Region3',
            children: [
              { name: 'Office Supplies', value: 1408 },
              { name: 'Furniture', value: 1676 },
              { name: 'Electronic equipment', value: 1559 }
            ]
          },
          {
            name: 'Region4',
            children: [
              { name: 'Office Supplies', value: 745 },
              { name: 'Furniture', value: 919 },
              { name: 'Electronic equipment', value: 781 }
            ]
          },
          {
            name: 'Region5',
            children: [
              { name: 'Office Supplies', value: 267 },
              { name: 'Furniture', value: 316 },
              { name: 'Electronic equipment', value: 230 }
            ]
          },
          {
            name: 'Region6',
            children: [
              { name: 'Office Supplies', value: 347 },
              { name: 'Furniture', value: 501 },
              { name: 'Electronic equipment', value: 453 }
            ]
          }
        ]
      },
      {
        name: 'Country B',
        children: [
          {
            name: 'Region1',
            children: [
              { name: 'Office Supplies', value: 824 },
              { name: 'Furniture', value: 920 },
              { name: 'Electronic equipment', value: 936 }
            ]
          },
          {
            name: 'Region2',
            children: [
              { name: 'Office Supplies', value: 1270 },
              { name: 'Furniture', value: 1399 },
              { name: 'Electronic equipment', value: 1466 }
            ]
          },
          {
            name: 'Region3',
            children: [
              { name: 'Office Supplies', value: 1408 },
              { name: 'Furniture', value: 1676 },
              { name: 'Electronic equipment', value: 1559 }
            ]
          },
          {
            name: 'Region4',
            children: [
              { name: 'Office Supplies', value: 745 },
              { name: 'Furniture', value: 919 },
              { name: 'Electronic equipment', value: 781 }
            ]
          },
          {
            name: 'Region5',
            children: [
              { name: 'Office Supplies', value: 267 },
              { name: 'Furniture', value: 316 },
              { name: 'Electronic equipment', value: 230 }
            ]
          },
          {
            name: 'Region6',
            children: [
              { name: 'Office Supplies', value: 347 },
              { name: 'Furniture', value: 501 },
              { name: 'Electronic equipment', value: 453 }
            ]
          }
        ]
      },
      {
        name: 'Country C',
        children: [
          {
            name: 'Region1',
            children: [
              { name: 'Office Supplies', value: 824 },
              { name: 'Furniture', value: 920 },
              { name: 'Electronic equipment', value: 936 }
            ]
          },
          {
            name: 'Region2',
            children: [
              { name: 'Office Supplies', value: 1270 },
              { name: 'Furniture', value: 1399 },
              { name: 'Electronic equipment', value: 1466 }
            ]
          },
          {
            name: 'Region3',
            children: [
              { name: 'Office Supplies', value: 1408 },
              { name: 'Furniture', value: 1676 },
              { name: 'Electronic equipment', value: 1559 }
            ]
          },
          {
            name: 'Region4',
            children: [
              { name: 'Office Supplies', value: 745 },
              { name: 'Furniture', value: 919 },
              { name: 'Electronic equipment', value: 781 }
            ]
          },
          {
            name: 'Region5',
            children: [
              { name: 'Office Supplies', value: 267 },
              { name: 'Furniture', value: 316 },
              { name: 'Electronic equipment', value: 230 }
            ]
          },
          {
            name: 'Region6',
            children: [
              { name: 'Office Supplies', value: 347 },
              { name: 'Furniture', value: 501 },
              { name: 'Electronic equipment', value: 453 }
            ]
          }
        ]
      }
    ]
  }
];

const spec = {
  data: [
    {
      id: 'data',
      values: data
    }
  ],
  type: 'circlePacking',
  categoryField: 'name',
  valueField: 'value',
  drill: true,
  circlePacking: {
    style: {
      fillOpacity: d => (d.isLeaf ? 0.75 : 0.25)
    }
  },
  layoutPadding: [0, 10, 10],
  label: {
    style: {
      fontSize: 10,
      visible: d => {
        return d.depth === 1;
      }
    }
  },
  title: {
    visible: true,
    text: '请尝试点击节点'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window.vchart = vchart;
```
