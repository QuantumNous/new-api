# Sunburst Chart

[\[Configuration Manual\]](../../../option/sunburstChart)

## Introduction

A Sunburst Chart is a visualization chart based on a pie chart that displays a nested hierarchical structure within a circle to reflect the hierarchical structure and composition relationship of data.

In the Sunburst Chart, each sector of the circle represents a primary category. Smaller sectors within the larger sectors represent subcategories under this category, and so on. This nesting typically continues recursively until the leaf nodes of the category tree are reached. Data can be encoded by the size and color of sectors, allowing users to quickly understand the organization structure, relative proportions, and relationships between components of complex data from an overall perspective.

## Chart Composition

Sunburst Chart mainly consists of fan-like graphics with a hierarchical structure, and other elements or components such as labels and tooltip information.
![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/a222eb3ecfe32db85220dda09.png)

The hierarchical fan-like graphics are essential to the Sunburst Chart, and related drawing configurations are indispensable:

- `sunburstChart.type`: Chart type, the type of Sunburst Chart is `'circlePacking'`
- `sunburstChart.data`: Data source for chart drawing, usually in a hierarchical structure in a Sunburst Chart, in the following format:

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

- `sunburstChart.categoryField`: Category field, mapping to different graphic elements
- `sunburstChart.valueField`: Value field, mapping to the angle range of the graphics

Tooltip information and other components that help with displaying the chart are optional configurations with default effects and features:

- `sunburstChart.tooltip`: Tooltip information, displayed by default during interaction. For detailed configuration, see [VChart Tooltip Component Configuration ](../../../option/sunburstChart#tooltip)
- For more component configuration, see [VChart sunburstChart configuration](../../../option/sunburstChart)

## Quick Start

```javascript livedemo
const data = [
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
];

const spec = {
  type: 'sunburst',
  categoryField: 'name',
  valueField: 'value',
  sunburst: {
    visible: true,
    style: {
      fillOpacity: datum => {
        return datum.isLeaf ? 0.4 : 0.8;
      }
    }
  },
  label: {
    visible: true,
    style: {
      fontSize: 12,
      fillOpacity: datum => {
        return datum.isLeaf ? 0.4 : 0.8;
      }
    }
  },
  data: [
    {
      id: 'data',
      values: data
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window.vchart = vchart;
```

- Declare `categoryField` as the category field
- Declare the `valueField` as the value field
- `sunburst` sunburst graphics configuration. By default, all graphics have the same style. To show the hierarchical relationship, different levels of graphics usually need to be distinguished by the callback method.
- `label` label graphic configuration, by default, each graphic has a label with consistent style. To show the hierarchical relationship, different levels of labels usually need to be distinguished by the callback method.

## Sunburst Chart Features

### Data

As mentioned earlier, the Sunburst Chart represents the nested relationship of data through nested circular layers. Hence the source data must be in a nested structure, like:

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

#### Position

Using `sunburstChart.centerX`, `sunburstChart.centerY`, `sunburstChart.offsetX`, and `sunburstChart.offsetY`, the Sunburst Chart's center point x, y coordinates, and corresponding offsets can be configured.

```javascript livedemo
const data = [
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
];

const spec = {
  type: 'sunburst',
  categoryField: 'name',
  valueField: 'value',
  centerX: 10,
  centerY: 20,
  offsetX: 10,
  offsetY: 20,
  sunburst: {
    visible: true,
    style: {
      fillOpacity: datum => {
        return datum.isLeaf ? 0.4 : 0.8;
      }
    }
  },
  label: {
    visible: true,
    style: {
      fontSize: 12,
      fillOpacity: datum => {
        return datum.isLeaf ? 0.4 : 0.8;
      }
    }
  },
  data: [
    {
      id: 'data',
      values: data
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window.vchart = vchart;
```

#### Angle Range

The angle range of the Sunburst Chart can be configured using `sunburstChart.startAngle` and `sunburstChart.endAngle`.

```javascript livedemo
const data = [
  {
    name: 'companyA',
    children: [
      {
        name: 'departmentA',
        children: [
          {
            name: 'group1',
            value: 1
          },
          {
            name: 'group2',
            value: 2
          }
        ]
      },
      {
        name: 'departmentB',
        children: [
          {
            name: 'group3',
            children: [
              {
                name: 'staff1',
                value: 2
              },
              {
                name: 'staff2',
                value: 1
              }
            ]
          }
        ]
      }
    ]
  },
  {
    name: 'companyB',
    children: [
      {
        name: 'departmentC',
        children: [
          {
            name: 'group4',
            value: 4
          },
          {
            name: 'group5',
            value: 5
          }
        ]
      },
      {
        name: 'departmentD',
        children: [
          {
            name: 'group6',
            value: 6
          }
        ]
      }
    ]
  },
  {
    name: 'companyC',
    children: [
      {
        name: 'departmentE',
        children: [
          {
            name: 'group7',
            value: 7
          },
          {
            name: 'group8',
            value: 8
          }
        ]
      },
      {
        name: 'departmentF',
        children: [
          {
            name: 'group9',
            value: 9
          }
        ]
      }
    ]
  },
  {
    name: 'companyD',
    children: [
      {
        name: 'departmentG',
        value: 10
      },
      {
        name: 'departmentH',
        value: 5
      }
    ]
  }
];
const spec = {
  type: 'sunburst',
  data: [
    {
      id: 'data',
      values: data
    }
  ],
  categoryField: 'name',
  valueField: 'value',
  endAngle: 180,
  labelAutoVisible: {
    enable: true,
    circumference: 5
  },
  gap: [5, 10],
  sunburst: {
    style: {
      visible: true,
      fillOpacity: datum => {
        return datum.isLeaf ? 0.4 : 0.8;
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window.vchart = vchart;
```

#### Inner and Outer Radius

The inner and outer radii of the Sunburst Chart can be configured using `sunburstChart.innerRadius` and `sunburstChart.outerRadius`, which support passing in an array for layer-by-layer configuration.

```javascript livedemo
const data = [
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
];

const spec = {
  type: 'sunburst',
  data: [
    {
      id: 'data',
      values: data
    }
  ],
  offsetX: 0,
  offsetY: 0,
  categoryField: 'name',
  valueField: 'value',
  innerRadius: [0, 0.4, 0.8],
  outerRadius: [0.3, 0.7, 0.85],
  gap: 0,
  drill: true,
  labelAutoVisible: {
    enable: true,
    circumference: 1
  },
  labelLayout: [
    {
      align: 'center',
      rotate: 'tangential',
      offset: 0
    },
    null,
    {
      align: 'start',
      rotate: 'radial',
      offset: 15
    }
  ],
  sunburst: {
    visible: true,
    style: {
      fillOpacity: datum => {
        return datum.isLeaf ? 0.4 : 0.8;
      }
    }
  },
  label: {
    visible: true
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window.vchart = vchart;
```

#### Hierarchy Gap

The hierarchy gap can be configured using `sunburstChart.gap`, which supports passing in an array for layer-by-layer configuration of the hierarchy gap.

#### Label Layout

todo: a table

### Chart Interaction

#### Drill Down

Drill down is the ability to click a parent category to explore its subcategory information when showing different hierarchy levels in treemaps, Circle Packing, and Sunburst Charts. Through the drill-down feature, users can view details level by level, explore data hierarchy in depth, and better understand the relationships and differences between data, resulting in higher quality analytical conclusions.

By configuring `sunburstChart.drill: true` and `sunburstChart.drillField`, the drill-down feature can be enabled, and the field to be used for drilling down can be configured (the drill-down field will use an autogenerated unique key by default, but the `drillField` must be configured when using the API to drill down).
