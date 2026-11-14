{{ target: component-tooltip-shape-pattern }}

<!-- ITooltipShapePattern -->

<!-- hasShape -->

#${prefix} hasShape(boolean) = true

Whether to show the shape symbol for the current line of the tooltip, default is `true`.

<!-- shapeType -->

{{ if: ${type} === 'pattern' }}

#${prefix} shapeType(string|Function)

{{ /if }}

{{ if: ${type} === 'style' }}

#${prefix} shapeType(string)

{{ /if }}

The shape type displayed for the current line of the tooltip. If configured as a string, it will be displayed as the corresponding constant shape.

Note: Built-in shapes include:

<!-- TODO: Unify symbol types -->

- `'triangleForward'`: Right arrow
- `'triangle'`: Triangle
- `'diamond'`: Diamond
- `'square'`: Square
- `'star'`: Star
- `'cardioid'`: Heart shape
- `'circle'`: Circle
- `'pentagon'`: Pentagon

{{ if: ${type} === 'pattern' }}

It can also be configured as a function callback, with the type:

```ts
(datum: Datum, params?: TooltipHandlerParams) => string;
```

Where `datum` is the default data item corresponding to the current line of the tooltip.

{{ /if }}

<!-- shapeHollow -->

{{ if: ${type} === 'pattern' }}

#${prefix} shapeHollow(boolean|Function)

{{ /if }}

{{ if: ${type} === 'style' }}

#${prefix} shapeHollow(boolean) = false

{{ /if }}

tooltip 当前行显示的 shape 是否空心，默认为`false`。

{{ if: ${type} === 'pattern' }}

It can also be configured as a function callback, with the type:

```ts
(datum: Datum, params?: TooltipHandlerParams) => boolean;
```

Where `datum` is the default data item corresponding to the current line of the tooltip.

{{ /if }}

<!-- shapeHollow -->

{{ if: ${type} === 'pattern' }}

#${prefix} shapeHollow(boolean|Function)

{{ /if }}

{{ if: ${type} === 'style' }}

#${prefix} shapeHollow(boolean) = false

{{ /if }}

Whether the shape displayed for the current line of the tooltip is hollow, default is `false`.

{{ if: ${type} === 'pattern' }}

It can also be configured as a function callback, with the type:

```ts
(datum: Datum, params?: TooltipHandlerParams) => boolean;
```

Where `datum` is the default data item corresponding to the current line of the tooltip.

{{ /if }}

<!-- shapeFill -->

{{ if: ${type} === 'pattern' }}

#${prefix} shapeFill(string|Function)

{{ /if }}

{{ if: ${type} === 'style' }}

#${prefix} shapeFill(string)

{{ /if }}

The shape fill color displayed in the current line of tooltip. This configuration is common to `shapeColor`.

{{ if: ${type} === 'pattern' }}

It can also be configured as a function callback, with the type:

```ts
(datum: Datum, params?: TooltipHandlerParams) => string;
```

Where `datum` is the default data item corresponding to the current line of the tooltip.

{{ /if }}

<!-- shapeStroke -->

{{ if: ${type} === 'pattern' }}

#${prefix} shapeStroke(string|Function)

{{ /if }}

{{ if: ${type} === 'style' }}

#${prefix} shapeStroke(string)

{{ /if }}

The shape stroke color displayed in the current line of tooltip.

{{ if: ${type} === 'pattern' }}

It can also be configured as a function callback, with the type:

```ts
(datum: Datum, params?: TooltipHandlerParams) => string;
```

Where `datum` is the default data item corresponding to the current line of the tooltip.

{{ /if }}

<!-- shapeLineWidth -->

{{ if: ${type} === 'pattern' }}

#${prefix} shapeLineWidth(number|Function)

{{ /if }}

{{ if: ${type} === 'style' }}

#${prefix} shapeLineWidth(number)

{{ /if }}

The width of the shape stroke displayed in the current line of tooltip.

{{ if: ${type} === 'pattern' }}

It can also be configured as a function callback, with the type:

```ts
(datum: Datum, params?: TooltipHandlerParams) => number;
```

Where `datum` is the default data item corresponding to the current line of the tooltip.

{{ /if }}

<!-- shapeSize -->

{{ if: ${type} === 'pattern' }}

#${prefix} shapeSize(number|Function)

{{ /if }}

{{ if: ${type} === 'style' }}

#${prefix} shapeSize(number)

{{ /if }}

The size of the shape displayed in the current line of tooltip, measured in px.

{{ if: ${type} === 'pattern' }}

It can also be configured as a function callback, with the type:

```ts
(datum: Datum, params?: TooltipHandlerParams) => number;
```

Where `datum` is the default data item corresponding to the current line of the tooltip.

{{ /if }}

<!-- shapeColor -->

{{ if: ${type} === 'pattern' }}

#${prefix} shapeColor(string|Function)

{{ /if }}

{{ if: ${type} === 'style' }}

#${prefix} shapeColor(string)

{{ /if }}

The shape fill color displayed in the current line of tooltip (it is recommended to use `shapeFill`).

{{ if: ${type} === 'pattern' }}

It can also be configured as a function callback, with the type:

```ts
(datum: Datum, params?: TooltipHandlerParams) => string;
```

Where `datum` is the default data item corresponding to the current line of the tooltip.

{{ /if }}
