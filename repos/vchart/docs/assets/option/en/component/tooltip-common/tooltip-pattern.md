{{ target: component-tooltip-pattern }}

<!-- ITooltipPattern -->

#${prefix} visible(boolean) = true

Whether to display tooltips of this type.

{{ if: ${groupTooltip} }}

#${prefix} triggerMark(string|string[])

The trigger mark of group tooltip. The following string or array of these string can be specified：

- 'line'
- 'area'
- 'point'
- 'bar'

{{ /if }}

#${prefix} title(Object)

Configuration of tooltip title.

{{ use: component-tooltip-line-pattern(
  prefix = '#' + ${prefix},
  supportFunction = true,
  content = false
) }}

#${prefix} content(Object|Object[])

Configuration of tooltip content, which can be an `IToolTipLinePattern` object or an array of such objects. If configured as an object, each data item (datum) will add a corresponding line in the tooltip content area. If configured as an array, each data item (datum) will add multiple lines in the tooltip content area.

{{ use: component-tooltip-line-pattern(
  prefix = '#' + ${prefix},
  supportFunction = true,
  content = true
) }}

#${prefix} position(Object|string)

Configuration of tooltip position, supporting object and string types.

Currently supports three configuration forms:

If configured as a string attribute, the tooltip will be fixed around or inside the corresponding graphical element.

{{ use: component-tooltip-position-fixed-type() }}

If configured as an object type, it uses a relative container layout mode. The following optional attributes can be configured:

```ts
/** The following is a tooltip position relative to the global layout, which only supports pixel values or pixel value callbacks */
export interface IGlobalTooltipPositionPattern {
  left?: TooltipPositionValue;
  right?: TooltipPositionValue;
  top?: TooltipPositionValue;
  bottom?: TooltipPositionValue;
}
```

If configured as an object type and laid out relative to a certain chart element, the following optional properties can be configured:

```ts
/** The following is a tooltip position relative to a certain chart element, supporting pixel values or fixed orientations (x and y can be configured separately) */
export interface IFixedTooltipPositionPattern {
  x: TooltipPositionPatternItem;
  y: TooltipPositionPatternItem;
}
```

The type declaration of `TooltipPositionPatternItem` is:

```ts
export type TooltipPositionPatternItem = TooltipPositionValue | ITooltipPositionFixedValue;

export interface ITooltipPositionFixedValue {
  /** Orient of fixed tooltip position */
  orient: TooltipFixedPosition;
  /** Mode of fixed tooltip position */
  mode: TooltipPositionMode;
  /** Offset (pixel value) */
  offset?: number;
}
```

The specific configuration items are explained as follows.

##${prefix} left(number|Function)

**Optional** Distance between the tooltip trigger point and the left side of the container.

{{ use: component-tooltip-position-callback() }}

##${prefix} right(number|Function)

**Optional** Distance between the tooltip trigger point and the right side of the container.

{{ use: component-tooltip-position-callback() }}

##${prefix} top(number|Function)

**Optional** Distance between the tooltip trigger point and the top side of the container.

{{ use: component-tooltip-position-callback() }}

##${prefix} bottom(number|Function)

**Optional** Distance between the tooltip trigger point and the bottom side of the container.

{{ use: component-tooltip-position-callback() }}

##${prefix} x(number|Function|Object)

**Optional**

{{ use: component-tooltip-position-fixed(
  prefix = '##' + ${prefix},
) }}

##${prefix} y(number|Function|Object)

**Optional**

{{ use: component-tooltip-position-fixed(
  prefix = '##' + ${prefix},
) }}

#${prefix} positionMode(string)

The tooltip position mode determines what element the `position` is relatively fixed to, such as around the mouse pointer or mouse-over marks. This configuration only takes effect when `position` is set to a string.

{{ use: component-tooltip-position-fixed-mode() }}

#${prefix} updateContent(Function)

This is the callback of the tooltip content. It is called before the tooltip is finally displayed. You can modify the text and style of the tooltip content in this callback, and add, delete, modify, and reorder the tooltip content lines.

The type definition is as follows:

```ts
(prev: IToolTipLineActual[] | undefined, data?: TooltipData, params?: TooltipHandlerParams) => IToolTipLineActual[] | undefined;
```

The first parameter is the final tooltip content array calculated by VChart before displaying the tooltip, containing the text and style for each line. Modify this array in the callback and return it.

#${prefix} updateTitle(Function)

This is the callback of the tooltip title. It is called before the tooltip is finally displayed. You can modify the text and style of the tooltip title in this callback.

The type definition is as follows:

```ts
(prev: IToolTipLineActual | undefined, data?: TooltipData, params?: TooltipHandlerParams) =>
  IToolTipLineActual | undefined;
```

The first parameter is the final tooltip title information calculated by VChart before displaying the tooltip, including the text and style of the title. Modify this object in the callback and return it.

#${prefix} maxLineCount(number)

Define the maximum number of displayed lines for tooltip content, and any content exceeding this limit will be represented as "others".

{{ use: component-tooltip-shape-pattern(
  prefix = ${prefix},
  type = 'pattern'
) }}

#${prefix} othersLine(Object)

The "Others" line content displayed after the tooltip content exceeds the maximum number of displayed lines.

{{ use: component-tooltip-line-pattern(
  prefix = '#' + ${prefix},
  supportFunction = false,
  content = true
) }}
