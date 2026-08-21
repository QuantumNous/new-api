{{ target: common-layout-item }}

<!-- ILayoutItemSpec -->

#${prefix} layoutType(string) = ${defaultLayoutType}

The layout type of the current module. If it is set to `absolute`, the element will be absolutely positioned with the upper-left corner of the drawing area as the origin.

The currently supported layout types are as follows:

- `'region'`: The drawing area of the chart, generally only the region module is of this type.
- `'region-relative'`: Modules related to the region position, such as axes, datazoom, etc. Multiple modules in the same direction will not overlap.
- `'region-relative-overlap'`: Supported since `1.8.8` version, Modules related to region position use overlapping layout. Multiple coordinate axes can be overlapped together through this configuration.
- `'normal'`: Ordinary placeholders, such as legends, titles, etc.
- `'normal-inline'`: Inline placeholder element, used for multiple legends to display scenes side by side, etc.
- `'absolute'`: Absolute layout elements, such as tooltips, marklines, etc.

#${prefix} layoutLevel(number) = ${defaultLayoutLevel}

Layout order level. The higher the level, the higher the priority for layout. For example, if both the title and the legend are at the top, the title should be placed at the top first, followed by the legend.

{{ if: !${noOrient} & !${isRegion} }}
#${prefix} orient(string)

Module layout position. Available positions:

- 'left'
- 'top'
- 'right'
- 'bottom'

{{ /if }}

{{ if: !${isRegion} }}
#${prefix} alignSelf('start' | 'end' | 'middle') = 'start'

Starting from version 1.8.9,

For elements with a layout type of 'normal-inline', set the alignment of inline elements as follows:

- For elements at the top, 'start' - align to the top; 'end' - align to the bottom; 'middle' - align to the middle
- For elements at the bottom, 'start' - align to the bottom; 'end' - align to the top; 'middle' - align to the middle
- For elements on the left, 'start' - align to the left; 'end' - align to the right; 'middle' - align to the middle
- For elements on the right, 'start' - align to the right; 'end' - align to the left; 'middle' - align to the middle
  {{ /if}}

#${prefix} padding(ILayoutNumber|Array|Object) = 0

Layout spacing configuration (four directions: up, down, left, and right) for the module. It supports non-object configuration, array configuration, and object configuration.

During non-object configuration, the configured value is applied to all four directions. The properties are as follows:

{{ use: common-layout-number }}

During array configuration, each item supports ILayoutNumber. For example:

```ts
padding: [5]; // 上右下左内边距均为 5px
padding: ['10%']; // 上下内边距为相对 图表视图区域 高的 10%，左右内边距为相对 图表视图区域 宽的 10%
padding: [5, 10]; // 上下内边距为 5px，左右内边距为 10px
padding: [
  5, // 上内边距为 5px
  '10%', // 左右内边距为相对 图表视图区域 宽的 10%
  10 // 下内边距为 10px
];
padding: [
  5, // 上内边距为 5px，
  '10%', // 右内边距为相对 图表视图区域 宽的 10%，
  '5%', // 下内边距为相对 图表视图区域 高的 5%
  (rect: ILayoutRect) => rect.height * 0.1 + 10 // 左内边距为图表视图区域 高的 0.1 + 10
];
```

The properties for object configuration are as follows:

{{ use: common-layout-padding(
  prefix = '#' + ${prefix}
) }}

For example:

```ts
padding: 10,   // 上右下左内边距均为 10px
padding: '10%' // 上右下左内边距均为相对 **图表视图区域** 宽高的 10%
padding: {
  top: 10, // 上方内边距 10px
  left: ({ width }) => width * 0.1, // 左方内边距为布局宽度的 0.1
  right: '10%' // 右方内边距为布局宽度的 0.1
}
```

#${prefix} noOuterPadding(boolean) = true

Determines whether to automatically modify padding by hiding the outer padding according to the orient property. When set to true, the component will automatically set the padding on the outer side (the direction specified by orient) to 0. This feature is currently only effective for components.

Property Specifications:

- Type: `boolean`
- Default value: `true`
- Depends on the `orient` property - only takes effect when `orient` is set and the component supports this property
- Only effective for components, not applicable to other layout elements

Usage Scenarios:

- When components (such as legends, titles, axes, etc.) are positioned adjacent to chart edges, it is often desirable to automatically set the outer padding (in the orient-specified direction) to 0 for space efficiency and better visual alignment
- When maximizing chart space utilization

Example Usage:

```ts
const legendSpec = {
  type: 'legend',
  orient: 'right', // The legend is positioned on the right
  padding: [10, 10, 10, 10], // 10px padding on all four sides: top, right, bottom, left
  noOuterPadding: true // Automatically sets the right padding to 0
};
// Result: The effective padding is { top: 10, right: 0, bottom: 10, left: 10 }
```

Comparison:

- When `noOuterPadding: false`, the padding for all sides is retained.
- When `noOuterPadding: true`, the padding on the side specified by `orient` is automatically set to 0.

Notes:

- This property defaults to `true`, so you usually do not need to set it explicitly unless you want to retain the outer padding.
- It depends on `orient`; if `orient` is not set, this property has no effect.
- Currently, this property only applies to components.

#${prefix} width(ILayoutNumber)

Layout width configuration for the module.

{{ use: common-layout-number }}

#${prefix} minWidth(ILayoutNumber)

Minimum layout width configuration for the module. This configuration is invalid when the width is set.

{{ use: common-layout-number }}

#${prefix} maxWidth(ILayoutNumber)

Maximum layout width configuration for the module. This configuration is invalid when the width is set.

{{ use: common-layout-number }}

#${prefix} height(ILayoutNumber)

Layout height configuration for the module.

{{ use: common-layout-number }}

#${prefix} minHeight(ILayoutNumber)

Minimum layout height configuration for the module. This configuration is invalid when the height is set.

{{ use: common-layout-number }}

#${prefix} maxHeight(ILayoutNumber)

Maximum layout height configuration for the module. This configuration is invalid when the height is set.

{{ use: common-layout-number }}

#${prefix} offsetX(ILayoutNumber)

Offset for the module's layout position in the X direction.

{{ use: common-layout-number }}

#${prefix} offsetY(ILayoutNumber)

Offset for the module's layout position in the Y direction.

{{ use: common-layout-number }}

#${prefix} zIndex(number) = ${defaultLayoutZIndex}

Display layer level for the module. When two modules overlap, the one with the larger level is displayed on top.

{{ if: !${noClip} | ${isRegion} }}
#${prefix} clip(boolean)

Whether to clip the drawing content outside the layout area of the module.

{{ /if }}

{{ if: !${isRegion} }}

#${prefix} left(ILayoutNumber)

Distance from the module to the left side of the chart in absolute layout. Note that **this is only effective when layoutType === 'absolute'**.

{{ use: common-layout-number }}

#${prefix} right(ILayoutNumber)

Distance from the module to the right side of the chart in absolute layout. Note that **this is only effective when layoutType === 'absolute'**.

{{ use: common-layout-number }}

#${prefix} top(ILayoutNumber)

Distance from the module to the top side of the chart in absolute layout. Note that **this is only effective when layoutType === 'absolute'**.

{{ use: common-layout-number }}

#${prefix} bottom(ILayoutNumber)

Distance from the module to the bottom side of the chart in absolute layout. Note that **this is only effective when layoutType === 'absolute'**.

{{ use: common-layout-number }}

#${prefix} center(boolean)

In absolute layout, the element will be placed in the center of the chart. Note that **this is only effective when layoutType === 'absolute', and the padding property will be ignored**.
{{ /if }}
