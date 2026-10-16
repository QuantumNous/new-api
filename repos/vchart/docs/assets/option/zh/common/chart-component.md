{{ target: chart-component }}

<!-- 图表上通用的组件配置 -->

{{ if: ${axisType} === 'polar' }}

## layoutRadius(string|number|function)

自 **1.11.2**版本开始支持

极坐标的布局半径，即计算内径、外径的基准值，可选值如下：

- 不设置： 默认值为`Math.min(width, height) / 2`，**1.11.2**之前的版本相当于这个效果
- `'auto'`： 根据`center`、`startAngle`、`endAngle`自动计算最大可用的布局半径
- 自定义函数，函数的类型定义如下：

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
