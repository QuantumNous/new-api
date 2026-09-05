{{ target: chart-component }}

<!-- Common component configuration on charts -->

{{ if: ${axisType} === 'polar' }}

## layoutRadius(string|number|function)

Introduced in version **1.11.2**

The layout radius of the polar coordinate, which is the base value for calculating the inner and outer radii. The optional values are as follows:

- Not set: The default value is `Math.min(width, height) / 2`, which is equivalent to this effect before version **1.11.2**
- `'auto'`: Automatically calculate the maximum available layout radius based on `center`, `startAngle`, and `endAngle`
- Custom function, the type definition of the function is as follows:

```ts
(layoutRect: { width: number; height: number }, center: { x: number; y: number }) => number;
```

{{ /if }}

<!-- region -->

{{ use: common-region(
  axisType = ${axisType},
  regionType = ${regionType}
) }}

<!-- title -->

{{ use: component-title() }}

<!-- indicator -->

{{ use: component-indicator() }}

<!-- axes -->

{{ if: ${axisType} === 'cartesian' }}

{{ use: component-cartesian-axis(
  noBandAxis = ${noBandAxis}
) }}

<!-- markLine -->

{{ use: component-mark-line() }}

<!-- markArea -->

{{ use: component-mark-area() }}

<!-- markPoint -->

{{ use: component-mark-point() }}

{{ /if }}

{{ if: ${axisType} === 'polar' }}

{{ use: component-polar-axis() }}

{{ /if }}

<!-- legends -->

{{ use: component-legend() }}

<!-- crosshair -->

{{ if: !${noCrosshair} }}

{{ use: component-crosshair(
  isPolar = ${isPolar}
) }}

{{ /if }}

<!-- tooltip -->

{{ use: component-tooltip(
  prefix = '#'
) }}

<!-- layout -->

{{ use: common-layout() }}

<!-- player -->

{{ use: component-player() }}

<!-- scrollbar -->

{{ if: !${noScrollbar} }}

{{ use: component-scrollbar() }}

{{ /if }}

<!-- dataZoom -->

{{ if: !${noDataZoom} }}

{{ use: component-data-zoom() }}

{{ /if }}

<!-- brush -->

{{ if: !${noBrush} }}
{{ use: component-brush() }}
{{ /if }}

<!-- scales -->

{{ use: common-scale() }}

<!-- customMark -->

{{ use: common-custom-mark() }}

<!-- theme -->

{{ use: common-theme() }}
