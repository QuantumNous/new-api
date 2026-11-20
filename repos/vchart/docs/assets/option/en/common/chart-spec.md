{{ target: common-chart-spec }}

<!-- IChartSpec, used for common chart configuration -->

#${prefix} type(string) = '${chartType}'

Chart type.

{{ if: ${chartType} === 'common' }}

**Combined chart usage instructions:**

**Because the combination chart does not limit the coordinate system, it is not possible to determine internally what type of coordinate axes should be created. Therefore, when configuring the combination chart, you must declare the `axes` attribute to declare what type of coordinate axes to use. **

1. For the Cartesian coordinate system, we need to declare the coordinate axis and type of the corresponding direction, for example:

```ts
axes: [
  { orient: 'left', type: 'linear' }, // Declare the left axis as a linear axis
  { orient: 'bottom', type: 'band' } // Declare the lower axis as a discrete axis
];
```

2. For the polar coordinate system, we need to declare the coordinate axis and type of the corresponding direction, for example:

```ts
axes: [
  { orient: 'angle', type: 'band' }, // Declare the arc axis as a discrete axis
  { orient: 'radius', type: 'linear' } // Declare the radius axis as a linear axis
];
```

{{ /if }}

{{ if: !${noData} }}

{{ use: common-data(
    prefix = '#' + ${prefix},
    isHierarchy = ${isHierarchy},
    dataType = 'IDataType|IDataType[]'
) }}

{{ /if }}

#${prefix} width(number) = 500

Chart width.

#${prefix} height(number) = 500

Chart height.

#${prefix} autoFit(boolean) = true

Whether the width and height of the chart adapt to the container. The default is true in a browser environment. This configuration has a higher priority than the autoFit configuration in the constructor. If the user configures the width, the configured width will take precedence, and the same applies to the height.

#${prefix} background(string|Object)

The chart background color configuration has a higher priority than the background configuration in the constructor.

{{ use : background }}

#${prefix} padding(Object|number) = 12

Overall padding setting for the chart. Supports setting a value directly or configuring each direction separately for top, bottom, left, and right through object type.

- number: Unit is px, configured in all four directions simultaneously
- Object: object type is used as follows

{{ use: common-layout-padding(
  prefix = '#' + ${prefix},
) }}

#${prefix} color(Array|Object)

Chart color mapping configuration. Color value array can be directly passed, or data mapping can be performed for colors.

- Can directly pass color value array, and change the chart's color scheme

```ts
color: ['#BBD6B8', '#EA5455', '#19A7CE'],
```

- Perform data mapping, specifying the mapping rules through scale

{{ use: common-visual-spec-scale(
    prefix = '#' + ${prefix},
    includeId = false
) }}

#${prefix} labelLayout(string)='series'

By default, it is laid out separately by series, and can be set to 'series' or 'region'. When set to `region`, the label of different series in the same region will be calculated together to prevent overlap.
