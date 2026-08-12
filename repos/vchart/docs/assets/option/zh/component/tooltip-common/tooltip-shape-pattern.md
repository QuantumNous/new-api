{{ target: component-tooltip-shape-pattern }}

<!-- ITooltipShapePattern -->

<!-- hasShape -->

#${prefix} hasShape(boolean) = true

是否在 tooltip 当前行显示 shape symbol，默认为`true`。

<!-- shapeType -->

{{ if: ${type} === 'pattern' }}

#${prefix} shapeType(string|Function)

{{ /if }}

{{ if: ${type} === 'style' }}

#${prefix} shapeType(string)

{{ /if }}

tooltip 当前行显示的 shape 类型。如果配置为字符串，则显示为对应的常量形状。

注：内置形状包含：

<!-- TODO：统一 symbol 类型 -->

- `'triangleForward'`: 右箭头
- `'triangle'`: 三角形
- `'diamond'`: 菱形
- `'square'`: 方形
- `'star'`: 星形
- `'cardioid'`: 心形
- `'circle'`: 圆形
- `'pentagon'`: 五角形

{{ if: ${type} === 'pattern' }}

也可配置为函数回调，类型为：

```ts
(datum: Datum, params?: TooltipHandlerParams) => string;
```

其中 `datum` 为 tooltip 当前行所默认对应的数据项。

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

也可配置为函数回调，类型为：

```ts
(datum: Datum, params?: TooltipHandlerParams) => boolean;
```

其中 `datum` 为 tooltip 当前行所默认对应的数据项。

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

也可配置为函数回调，类型为：

```ts
(datum: Datum, params?: TooltipHandlerParams) => boolean;
```

其中 `datum` 为 tooltip 当前行所默认对应的数据项。

{{ /if }}

<!-- shapeFill -->

{{ if: ${type} === 'pattern' }}

#${prefix} shapeFill(string|Function)

{{ /if }}

{{ if: ${type} === 'style' }}

#${prefix} shapeFill(string)

{{ /if }}

tooltip 当前行显示的 shape 填充颜色，和 `shapeColor` 通用。

{{ if: ${type} === 'pattern' }}

也可配置为函数回调，类型为：

```ts
(datum: Datum, params?: TooltipHandlerParams) => string;
```

其中 `datum` 为 tooltip 当前行所默认对应的数据项。

{{ /if }}

<!-- shapeStroke -->

{{ if: ${type} === 'pattern' }}

#${prefix} shapeStroke(string|Function)

{{ /if }}

{{ if: ${type} === 'style' }}

#${prefix} shapeStroke(string)

{{ /if }}

tooltip 当前行显示的 shape 描边颜色。

{{ if: ${type} === 'pattern' }}

也可配置为函数回调，类型为：

```ts
(datum: Datum, params?: TooltipHandlerParams) => string;
```

其中 `datum` 为 tooltip 当前行所默认对应的数据项。

{{ /if }}

<!-- shapeLineWidth -->

{{ if: ${type} === 'pattern' }}

#${prefix} shapeLineWidth(number|Function)

{{ /if }}

{{ if: ${type} === 'style' }}

#${prefix} shapeLineWidth(number)

{{ /if }}

tooltip 当前行显示的 shape 描边宽度。

{{ if: ${type} === 'pattern' }}

也可配置为函数回调，类型为：

```ts
(datum: Datum, params?: TooltipHandlerParams) => number;
```

其中 `datum` 为 tooltip 当前行所默认对应的数据项。

{{ /if }}

<!-- shapeSize -->

{{ if: ${type} === 'pattern' }}

#${prefix} shapeSize(number|Function)

{{ /if }}

{{ if: ${type} === 'style' }}

#${prefix} shapeSize(number)

{{ /if }}

tooltip 当前行显示的 shape 大小，单位为 px。

{{ if: ${type} === 'pattern' }}

也可配置为函数回调，类型为：

```ts
(datum: Datum, params?: TooltipHandlerParams) => number;
```

其中 `datum` 为 tooltip 当前行所默认对应的数据项。

{{ /if }}

<!-- shapeColor -->

{{ if: ${type} === 'pattern' }}

#${prefix} shapeColor(string|Function)

{{ /if }}

{{ if: ${type} === 'style' }}

#${prefix} shapeColor(string)

{{ /if }}

tooltip 当前行显示的 shape 填充颜色（建议使用 `shapeFill`）。

{{ if: ${type} === 'pattern' }}

也可配置为函数回调，类型为：

```ts
(datum: Datum, params?: TooltipHandlerParams) => string;
```

其中 `datum` 为 tooltip 当前行所默认对应的数据项。

{{ /if }}
