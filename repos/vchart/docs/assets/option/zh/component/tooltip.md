{{ target: component-tooltip }}

#${prefix} tooltip(Object)

tooltip 配置。

##${prefix} visible(boolean) = true

是否显示 tooltip，默认显示。**_（支持在系列上设置）（作用于所有 handler）_**

##${prefix} activeType('mark'|'dimension'|Array<'mark'|'dimension'>) = ['mark', 'dimension']

受支持的 tooltip 类型。目前支持两种类型的 tooltip：图元 tooltip（`'mark'`）和维度项 tooltip（`'dimension'`）。**_（支持在系列上设置）（作用于所有 handler）_**

##${prefix} trigger('hover'|'click'|'none'|string[]) = 'hover'

显示 tooltip 触发方式。默认为`'hover'`，即鼠标悬浮时触发。可选值为：

- `'hover'`: 鼠标悬浮时触发。
- `'click'`: 鼠标点击时触发。
- 自定的事件配置，配置格式如下：

```ts
{
  /**
   * 事件类型字符串，如 'press'
   */
  eventType: EventType;
  /**
   * 事件绑定类型
   */
  source?: 'chart' | 'window' | 'canvas';
  /**
   * 是否阻止冒泡
   */
  consume?: boolean;

}
```

其中事件类型参考[事件接口文档](/vchart/api/API/event)

**_（作用于所有 handler）_**

##${prefix} triggerOff('hover'|'click'|'none'|string[]) = 'hover'

隐藏 tooltip 触发方式。默认为`'hover'`，即鼠标悬浮出热区时隐藏上一个`tooltip`。可选值为：

- `'hover'`: 鼠标悬浮出热区时触发 tooltip 隐藏。
- `'click'`: 鼠标点击其他元素时触发 tooltip 隐藏。
- `'none'`，tooltip 将不会因为用户交互而消失。
- 自定的事件配置，配置格式如下：

```ts
{
  /**
   * 事件类型字符串，如 'press'
   */
  eventType: EventType;
  /**
   * 事件绑定类型
   */
  source?: 'chart' | 'window' | 'canvas';
  /**
   * 是否阻止冒泡
   */
  consume?: boolean;
   /**
   * 是否限制触发点在图表区域之外才隐藏图例
   */
  checkOutside?: boolean
}
```

其中事件类型参考[事件接口文档](/vchart/api/API/event)

目前当 `trigger` 配置了`hover`或者 `click`的时候，默认`triggerOff`会包含对应的值，如果不想要默认的`hover`或者 `click`触发效果，建议`trigger`和`triggerOff` 都通过自定义事件配置；

**_（作用于所有 handler）_**

##${prefix} lockAfterClick(boolean)

`1.10.0` 版本后支持该配置；

点击后锁定 tooltip，通常用于 `trigger` 为 `['hover', 'click']` 的场景。

**_（作用于所有 handler）_**

##${prefix} hideTimer(Number)

`1.11.7` 版本后支持该配置；

定时隐藏 tooltip，单位为 `ms`。

当 `triggerOff` 设置为 `'none'` 时，该配置不生效。

##${prefix} showDelay(Number)

`1.12.8` 版本后支持该配置；
当设置了`enterable: true`，且 trigger 类型为`hover`的时候，为了方便鼠标进入提示信息的内容区域，设置的显示延迟时长，其他情况设置无效

##${prefix} mark(Object)

图元 tooltip 的自定义配置。 **_（支持在系列上设置）（只作用于默认 handler）_**

<!-- TODO: 图元 tooltip 示例补图 -->

{{ use: component-tooltip-pattern(
  prefix = '##' + ${prefix}
) }}

##${prefix} dimension(Object)

维度项 tooltip 的自定义配置。 **_（只作用于默认 handler）_**

<!-- TODO: 维度项 tooltip 示例补图 -->

{{ use: component-tooltip-pattern(
  prefix = '##' + ${prefix}
) }}

##${prefix} group(Object)

数据组 tooltip 的自定义配置。 **_（只作用于默认 handler）_**

<!-- TODO: 数据组 tooltip 示例补图 -->

{{ use: component-tooltip-pattern(
  prefix = '##' + ${prefix},
  groupTooltip = true
) }}

##${prefix} renderMode('html'|'canvas')

tooltip 渲染方式，桌面端默认为`html`，小程序端默认为`canvas`。**_（只作用于默认 handler）_**

##${prefix} confine(boolean) = true

是否将 tooltip 框限制在画布区域内，`renderMode` 为 `'canvas'` 时，默认开启。

1.13.3 之前，只能生效在`renderMode`为`canvas`的时候；

##${prefix} className(string)

**可选** tooltip dom 根元素的 className，仅当 `renderMode` 为 `'html'` 时生效。**_（只作用于默认 html handler）_**

##${prefix} parentElement(HTMLElement | string)

**可选** tooltip dom 元素的挂载点，仅当 `renderMode` 为 `'html'` 时生效。**_（只作用于默认 html handler）_**

可选项有：

- string dom 元素的 id
- HTMLElement dom 元素

如果没有传，默认值为`document.body`

##${prefix} enterable(boolean) = false

鼠标是否可进入 tooltip 浮层中，默认为 false，如需详情内交互，如添加链接，按钮，可设置为 true。目前仅当 `renderMode` 为 `'html'` 时生效。**_（只作用于默认 html handler）_**

##${prefix} transitionDuration(number)

**可选** tooltip 浮层移动动画（缓动）过渡时间，单位是 ms，设置为 0 的时候会紧跟着鼠标移动。目前仅当 `renderMode` 为 `'html'` 时生效。**_（只作用于默认 html handler）_**

##${prefix} throttleInterval(number)

**可选** tooltip 更新的防抖动时间间隔，单位是 ms。**_（只作用于默认 handler）_**

##${prefix} updateElement(Function)

更新 tooltip dom 元素的回调，仅当 `renderMode` 为 `'html'` 时生效。

在这个回调中，第一个参数会给出计算好的 tooltip dom 树根节点。这个回调允许对这个 dom 节点的内容进行修改，但是不允许替换。修改过后的 tooltip dom 将马上展示，并重新应用内置的 tooltip 位置计算算法。

其类型定义如下：

```ts
(tooltipElement: HTMLElement, actualTooltip: IToolTipActual, params: TooltipHandlerParams) => void
```

##${prefix} style(Object)

**可选** 配置 tooltip 样式。**_（只作用于默认 handler）_**

{{ use: component-tooltip-theme(
  prefix = '##' + ${prefix}
) }}

##${prefix} offset(Object)

**可选** tooltip 偏移量。tooltip 偏移量的正负含义是：若 tooltip 远离触发点则为正方向，靠近触发点则为负方向。**_（只作用于默认 handler）_**

{{ use: xy-pos(
  prefix = '##' + ${prefix},
  attribute = 'tooltip 偏移量'
) }}
