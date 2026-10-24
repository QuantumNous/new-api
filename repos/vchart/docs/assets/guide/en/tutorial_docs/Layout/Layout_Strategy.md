# Layout Strategies

There are 2 types of built-in layout strategies in VChart, one is based on placeholders, and the other is based on the grid layout. In addition to this, VChart also supports custom layouts. This will introduce the use of built-in layout strategies in detail.

## Chart layout elements

Before introducing the layout strategies, let's first introduce the layout elements of the chart. The layout elements of the chart are the same in different layout strategies. The main layout elements of the chart are:

- Region is also the container of the series, which can be understood as an area of the chart. A chart can have multiple regions, and each region can have one or multiple series.
- Component is the component, and a chart can have multiple components. Such as axis, legend, title, etc.

Since the container region of the series is already involved in the layout, the series itself no longer participates in the layout, and only needs to specify which region the series is in.

As shown below:

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/03421afda76ced0240204bf00.png" alt="Chart element composition diagram">
</div>

## Placeholder-based layout

In the placeholder layout, the chart layout elements are divided into several different types

- Normal general layout elements, such as titles and legends, will be placed in the layout at the beginning in sequence.
- Region-relative elements that have a binding relationship with the position of region elements. The size will be calculated once at the beginning of the layout, a location estimation will be performed, and then the layout will be horizontally first and then vertically.
- Region is the series container, and after the layout of region-relative elements is completed, the region elements will be arranged according to the remaining space size.
- Absolute elements, ignoring the location of other elements, taking the origin of the chart canvas as the basis, layout the position according to the layout configuration.

The entire layout process is shown below:

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/a222eb3ecfe32db85220dda0c.gif" alt="Layout process diagram">
</div>

## Grid-based layout

In order to meet the layout scenarios of common single column, single row, and similar simple tables, we provide a grid layout. In this layout mode, except for `absolute` elements, all other elements are treated as basic elements of the layout uniformly, and layout information needs to be specified for these layout modules in the layout configuration.

- modelId is the id of the layout module.
- col indicates the column the element is in. From left to right, starting from 0.
- row indicates the row the element is in. From top to bottom, starting from 0.
- colSpan indicates the number of columns occupied by the current element in the column direction, with a default value of 1.
- rowSpan indicates the number of rows occupied by the current element in the row direction, with a default value of 1.

> Note that all layout elements are now treated independently, and the axis and region no longer have a positional relationship. They need to be configured independently.

The layout effect is shown in the following figure:

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/03421afda76ced0240204bf08.png" alt="Grid layout diagram">
</div>

In the above figure, a total of 2 columns and 4 rows. The position information of each element is as follows:

- Legend layout position starts at `(0,0)`, occupies `1` row, and `2` columns.
- Pie-region has the layout position starting at `(1,0)`, occupies `1` row, and `2` columns.
- Axis-left has the layout position starting at `(2,0)`, occupies `1` row, and `1` column.
- Line-region has the layout position starting at `(2,1)`, occupies `1` row, and `1` column.
- Axis-bottom has the layout position starting at `(3,1)`, occupies `1` row, and `1` column.

The chart example is as follows:

```javascript livedemo
const spec = {
  type: 'common',
  padding: {
    top: 10
  },
  layout: {
    type: 'grid',
    col: 2,
    row: 4,
    elements: [
      {
        modelId: 'legend',
        col: 0,
        colSpan: 2,
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
        col: 0,
        row: 2
      },
      {
        modelId: 'line-region',
        col: 1,
        row: 2
      },
      {
        modelId: 'axis-bottom',
        col: 1,
        row: 3
      }
    ]
  },
  region: [
    {
      id: 'pie-region',
      height: '40%'
    },
    {
      id: 'line-region'
    }
  ],
  legends: {
    visible: true,
    orient: 'top',
    id: 'legend',
    regionId: ['pie-region', 'line-region']
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
      regionId: 'line-region',
      type: 'line',
      xField: 'x',
      yField: 'y',
      data: {
        id: 'line',
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
      regionId: 'line-region',
      orient: 'left'
    },

    {
      id: 'axis-bottom',
      regionId: 'line-region',
      orient: 'bottom'
    }
  ],
  tooltip: {
    dimension: {
      visible: true
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
window['vchart'] = vchart;
```
