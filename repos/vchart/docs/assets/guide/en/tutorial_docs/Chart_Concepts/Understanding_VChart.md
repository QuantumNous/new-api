# Chart Components

This tutorial will introduce the chart components of VChart in detail to help everyone better understand VChart.

## Terminology Definition

Before delving into the chart components, we need to understand the following terms:

- `series` - The main body of the chart, also known as the series, which contains a set of graphics elements and their corresponding chart logic.
- `mark` - Basic graphic elements, also known as basic graphics, such as points, lines, shapes, etc.
- `region` - Spatial information elements, related to one or more series, helping to locate the space.
- `component` - Components that help with chart reading and interaction, such as legends, axes, tooltips, etc.
- `layout` - Layout, managing the spatial distribution of chart elements.
- `chart` - Abstract concept of the chart, integrating and managing various elements such as data, graphics, components, and layout.

## Chart Definition

### Logical Layer Chart Elements

We break down the logical layer elements of the chart into the following four parts:

- series is the main body of the chart, containing a set of graphics elements and the corresponding type of chart logic. For example, in a line chart, the series refers to the collection of points and lines and all the logic of the line chart, etc.
- component provides auxiliary capabilities, helping chart reading and interaction components, such as legends, axes, tooltips, dataZoom, etc.
- region is a spatial information element that can associate one or more series and help the series to locate in space. At the same time, the region is also a minimal combination unit.
- chart is an abstract concept, which is the integrator and manager of various elements of the chart, such as data, graphics, components, and layout. It is the core context of the chart's logic layer.

#### Simple Chart

A simple chart is composed of a region, a determined type of series, component, and a chart that manages the chart logic. Taking a common line chart as an example, its composition is as follows.

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/03421afda76ced0240204bf00.png" alt="Logical layer element composition diagram of a line chart">
</div>

```javascript livedemo
const spec = {
  type: 'line',
  data: {
    values: [
      { type: 'Nail polish', country: 'Africa', value: 4229 },
      { type: 'Nail polish', country: 'EU', value: 4376 },
      { type: 'Nail polish', country: 'China', value: 3054 },
      { type: 'Nail polish', country: 'USA', value: 12814 },
      { type: 'Eyebrow pencil', country: 'Africa', value: 3932 },
      { type: 'Eyebrow pencil', country: 'EU', value: 3987 },
      { type: 'Eyebrow pencil', country: 'China', value: 5067 },
      { type: 'Eyebrow pencil', country: 'USA', value: 13012 },
      { type: 'Rouge', country: 'Africa', value: 5221 },
      { type: 'Rouge', country: 'EU', value: 3574 },
      { type: 'Rouge', country: 'China', value: 7004 },
      { type: 'Rouge', country: 'USA', value: 11624 },
      { type: 'Lipstick', country: 'Africa', value: 9256 },
      { type: 'Lipstick', country: 'EU', value: 4376 },
      { type: 'Lipstick', country: 'China', value: 9054 },
      { type: 'Lipstick', country: 'USA', value: 8814 },
      { type: 'Eyeshadows', country: 'Africa', value: 3308 },
      { type: 'Eyeshadows', country: 'EU', value: 4572 },
      { type: 'Eyeshadows', country: 'China', value: 12043 },
      { type: 'Eyeshadows', country: 'USA', value: 12998 },
      { type: 'Eyeliner', country: 'Africa', value: 5432 },
      { type: 'Eyeliner', country: 'EU', value: 3417 },
      { type: 'Eyeliner', country: 'China', value: 15067 },
      { type: 'Eyeliner', country: 'USA', value: 12321 },
      { type: 'Foundation', country: 'Africa', value: 13701 },
      { type: 'Foundation', country: 'EU', value: 5231 },
      { type: 'Foundation', country: 'China', value: 10119 },
      { type: 'Foundation', country: 'USA', value: 10342 },
      { type: 'Lip gloss', country: 'Africa', value: 4008 },
      { type: 'Lip gloss', country: 'EU', value: 4572 },
      { type: 'Lip gloss', country: 'China', value: 12043 },
      { type: 'Lip gloss', country: 'USA', value: 22998 },
      { type: 'Mascara', country: 'Africa', value: 18712 },
      { type: 'Mascara', country: 'EU', value: 6134 },
      { type: 'Mascara', country: 'China', value: 10419 },
      { type: 'Mascara', country: 'USA', value: 11261 }
    ]
  },
  title: {
    visible: true,
    text: 'Stacked line chart'
  },
  stack: true,
  xField: 'type',
  yField: 'value',
  seriesField: 'country',
  legends: [{ visible: true, position: 'middle', orient: 'bottom' }],
  region: [
    {
      style: {
        stroke: '#1971c2',
        lineWidth: 2
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

#### Combined Chart

We define a combined chart as one consisting of multiple regions, multiple determined types of series, components, and a chart that manages the chart logic. Here, we encapsulate the chart as a `type: 'common'` combined chart.

In a combined chart, you can define several different types of sub-charts. Each sub-chart can independently configure its data and components, and all sub-charts are associated with the same region by default. At this time, the various sub-charts are overlapping on the region. We will use a common bar-line dual-axis chart as an example to describe the combined chart in detail:

1. First, if we need to create a combined chart, we need to declare `type: 'common'`, indicating that the chart type we need to create is a combined chart.
2. As mentioned earlier, the chart is the integrator and manager of data, graphics, components, and layout, and it is composed of region + series + layout. The bar and line correspond to the 'bar' and 'line' series types, and by default, all series are associated with the same region, so we do not need to configure the region here.
3. Each series can have its data source, or the data source can be configured directly on the chart, and the series is associated through `fromDataId` or `fromDataIndex`. In the current example, we choose to configure it on the chart.

```javascript livedemo
const spec = {
  type: 'common',
  data: [
    {
      id: 'barData',
      values: [
        { x: '10:00', y: 40, type: '产品1' },
        { x: '12:00', y: 40, type: '产品1' },
        { x: '14:00', y: 56, type: '产品1' },
        { x: '16:00', y: 40, type: '产品1' },
        { x: '18:00', y: 52, type: '产品1' },
        { x: '20:00', y: 74, type: '产品1' },
        { x: '22:00', y: 95, type: '产品1' }
      ]
    },
    {
      id: 'areaData',
      values: [
        { x: '10:00', y2: 15, type: '产品2' },
        { x: '12:00', y2: 23, type: '产品2' },
        { x: '14:00', y2: 22, type: '产品2' },
        { x: '16:00', y2: 22, type: '产品2' },
        { x: '18:00', y2: 27, type: '产品2' },
        { x: '20:00', y2: 37, type: '产品2' },
        { x: '22:00', y2: 36, type: '产品2' }
      ]
    }
  ],
  series: [
    {
      type: 'bar',
      xField: 'x',
      yField: 'y',
      data: {
        fromDataId: 'barData'
      }
    },
    {
      type: 'area',
      xField: 'x',
      yField: 'y2',
      data: {
        fromDataId: 'areaData'
      },
      stack: false // area 默认堆叠
    }
  ],
  axes: [{ orient: 'bottom' }, { orient: 'left' }, { orient: 'right' }]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

As mentioned earlier, the region is a spatial information element that, in conjunction with the layout, can be used to divide the space of the canvas using multiple regions with different locations. At the same time, components can also specify the association with the region. When a component is associated with multiple regions, it will collect the data dimensions of all the sub-charts under the region for display, as shown in the following example.

```javascript livedemo
const spec = {
  type: 'common',
  layout: {
    type: 'grid',
    col: 4,
    row: 3,
    elements: [
      {
        modelId: 'legend',
        col: 0,
        colSpan: 4,
        row: 0
      },
      {
        modelId: 'pie-region',
        col: 0,
        colSpan: 2,
        row: 1
      },
      {
        modelId: 'axis-left',
        col: 2,
        row: 1
      },
      {
        modelId: 'bar-region',
        col: 3,
        row: 1
      },
      {
        modelId: 'axis-bottom',
        col: 3,
        row: 2
      }
    ]
  },
  region: [
    {
      id: 'pie-region'
    },
    {
      id: 'bar-region'
    }
  ],
  legends: {
    visible: true,
    orient: 'top',
    id: 'legend',
    regionId: ['pie-region', 'bar-region']
  },
  series: [
    {
      regionId: 'pie-region',
      type: 'pie',
      valueField: 'value',
      categoryField: 'type',
      data: {
        id: 'pie',
        values: [
          { type: 'a', value: 10 },
          { type: 'b', value: 20 }
        ]
      },
      seriesField: 'type'
    },
    {
      regionId: 'bar-region',
      type: 'bar',
      xField: ['x', 'type'],
      yField: 'y',
      data: {
        id: 'bar',
        values: [
          { x: '1', y: 10, type: 'a' },
          { x: '1', y: 20, type: 'b' },
          { x: '2', y: 30, type: 'a' },
          { x: '2', y: 40, type: 'b' }
        ]
      },
      seriesField: 'type'
    }
  ],
  axes: [
    {
      id: 'axis-left',
      regionId: 'bar-region',
      orient: 'left'
    },
    {
      id: 'axis-bottom',
      regionId: 'bar-region',
      orient: 'bottom'
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

### View Layer Graphic Elements

#### Graphic Element Mark

The graphic element is the definition of the chart view layer for the graphics. VChart defines the graphic elements in the chart as including basic graphic elements and combined graphic elements.

Basic graphic elements include: marker (symbol), rectangle (rect), line (line), straight line (rule), arc (arc), area (area), text (text), path (path), image (image), 3D rectangle (rect3d), 3D curved line (arc3d), polygon (polygon), etc.

Combining multiple basic graphic elements forms a combined graphic element. We collectively refer to basic graphic elements and combined graphic elements as graphic elements.

The logical layer elements (such as the series series) are composed of several graphic elements, such as the area chart (`'area'`) series, which includes points, lines, and area, with the corresponding basic graphic elements being: marker (Symbol), line (line), area (area).

The functions of graphic elements include:

- Flexible graphic element style configuration, including basic styles and interaction styles.
- Support for custom graphic elements to achieve more rich and customized chart requirements, see the [Custom Graphic Elements](../extend/custom_mark) chapter.
