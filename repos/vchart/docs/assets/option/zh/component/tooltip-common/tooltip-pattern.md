{{ target: component-tooltip-pattern }}

<!-- ITooltipPattern -->

#${prefix} visible(boolean) = true

是否显示该类型的 tooltip。

{{ if: ${groupTooltip} }}

#${prefix} triggerMark(string|string[])

group tooltip 的触发图元，可以配置以下字符串或数组：

- 'line'
- 'area'
- 'point'
- 'bar'

{{ /if }}

#${prefix} title(Object)

tooltip 标题配置

{{ use: component-tooltip-line-pattern(
  prefix = '#' + ${prefix},
  supportFunction = true,
  content = false
) }}

#${prefix} content(Object|Object[])

tooltip 内容配置，配置项为`IToolTipLinePattern`对象或者该对象的数组。如果配置为对象，则每个数据项（datum）都会在 tooltip 内容区添加对应的一行；如果配置为数组，则每个数据项（datum）都会在 tooltip 内容区添加对应的多行。

{{ use: component-tooltip-line-pattern(
  prefix = '#' + ${prefix},
  supportFunction = true,
  content = true
) }}

#${prefix} position(Object|string)

tooltip 位置配置，支持对象和字符串类型的配置。

目前支持 3 种配置形式：

如果配置为字符串属性，则 tooltip 将固定在对应元素的四周或内部。

{{ use: component-tooltip-position-fixed-type() }}

如果配置为对象类型且相对图表容器布局，可以配置以下可选属性：

```ts
/** 相对于全局布局的 tooltip position，只支持像素值或者像素值的回调 */
export interface IGlobalTooltipPositionPattern {
  left?: TooltipPositionValue;
  right?: TooltipPositionValue;
  top?: TooltipPositionValue;
  bottom?: TooltipPositionValue;
}
```

如果配置为对象类型且相对某个图表元素进行布局，可以配置以下可选属性：

```ts
/** 相对于某个图表元素的 tooltip position，支持像素值或者固定方位（x、y 可分别配置） */
export interface IFixedTooltipPositionPattern {
  x: TooltipPositionPatternItem;
  y: TooltipPositionPatternItem;
}
```

其中 `TooltipPositionPatternItem` 的类型声明为：

```ts
export type TooltipPositionPatternItem = TooltipPositionValue | ITooltipPositionFixedValue;

export interface ITooltipPositionFixedValue {
  /** 固定方位 */
  orient: TooltipFixedPosition;
  /** 固定模式 */
  mode: TooltipPositionMode;
  /** 偏移量（像素值） */
  offset?: number;
}
```

具体的配置项说明如下所示。

##${prefix} left(number|Function)

**可选** tooltip 触发点距容器左边的距离。

{{ use: component-tooltip-position-callback() }}

##${prefix} right(number|Function)

**可选** tooltip 触发点距容器右边的距离。

{{ use: component-tooltip-position-callback() }}

##${prefix} top(number|Function)

**可选** tooltip 触发点距容器顶边的距离。

{{ use: component-tooltip-position-callback() }}

##${prefix} bottom(number|Function)

**可选** tooltip 触发点距容器底边的距离。

{{ use: component-tooltip-position-callback() }}

##${prefix} x(number|Function|Object)

**可选**

{{ use: component-tooltip-position-fixed(
  prefix = '##' + ${prefix},
) }}

##${prefix} y(number|Function|Object)

**可选**

{{ use: component-tooltip-position-fixed(
  prefix = '##' + ${prefix},
) }}

#${prefix} positionMode(string)

tooltip 位置模式，决定 `position` 相对固定于什么图形，如固定在鼠标指针周围或图元周围。该配置只有 `position` 设为字符串时生效。

{{ use: component-tooltip-position-fixed-mode() }}

#${prefix} updateContent(Function)

tooltip 内容的回调，在最终显示 tooltip 前调用，可以在这个回调中修改 tooltip 内容的文本和样式，以及对 tooltip 内容行进行增、删、改、重新排序。

其类型定义如下：

```ts
(prev: IToolTipLineActual[] | undefined, data?: TooltipData, params?: TooltipHandlerParams) => IToolTipLineActual[] | undefined;
```

其中第一个参数是 VChart 在显示 tooltip 前计算得出的最终 tooltip 内容数组，包含每行的文本和样式。在回调中对此数组进行修改并返回即可。

#${prefix} updateTitle(Function)

tooltip 标题的回调，在最终显示 tooltip 前调用，可以在这个回调中修改 tooltip 标题的文本和样式。

其类型定义如下：

```ts
(prev: IToolTipLineActual | undefined, data?: TooltipData, params?: TooltipHandlerParams) =>
  IToolTipLineActual | undefined;
```

其中第一个参数是 VChart 在显示 tooltip 前计算得出的最终 tooltip 标题信息，包含标题的文本和样式。在回调中对此对象进行修改并返回即可。

#${prefix} maxLineCount(number)

定义 tooltip 内容的最大显示行数，超过的内容将用“其他”表示。

{{ use: component-tooltip-shape-pattern(
  prefix = ${prefix},
  type = 'pattern'
) }}

#${prefix} othersLine(Object)

tooltip 内容超过最大显示行数后，显示的“其他”行内容。

{{ use: component-tooltip-line-pattern(
  prefix = '#' + ${prefix},
  supportFunction = false,
  content = true
) }}
