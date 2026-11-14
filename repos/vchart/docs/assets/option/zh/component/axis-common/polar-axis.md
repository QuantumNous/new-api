{{ target: component-polar-axis-common }}

#${prefix} domainLine(Object)

轴线配置。

{{ use: component-axis-domain-line(
  prefix = '#' + ${prefix}
) }}

#${prefix} label(Object)

轴标签配置。

{{ use: component-axis-label(
  prefix  = '#' + ${prefix}
) }}

##${prefix} autoHide(boolean) = false

** 自 1.12.6 版本开始支持 **
轴标签自动隐藏开关，默认关闭，**需要手动开启，同时需要将 `sampling` 关闭**。

##${prefix} autoHideMethod('parity'|'greedy'|CustomMethod) = 'parity'

仅当 `autoHide` 为 true 时生效，防重叠策略，默认为 'parity'。

- - 'parity': 奇偶校验，使用删除所有其他标签的策略（这对于标准线性轴非常有效）。
- - 'greedy': 将执行标签的线性扫描，并删除与最后一个可见标签重叠的所有标签。
- - `CustomMethod` 类型，也可以传入函数用于自定义策略

```ts
export type CustomMethod = (items: IText[], separation: number) => IText[];
```

##${prefix} autoHideSeparation(number) = 0

** 自 1.12.6 版本开始支持 **
仅当 `autoHide` 为 true 时生效，设置文本之间的间隔距离，单位 px。

##${prefix} autoLimit(boolean) = false

** 自 1.12.6 版本开始支持 **
轴标签截断开关，默认关闭，**需要手动开启，同时需要将 `sampling` 关闭**。

##${prefix} limitEllipsis(string) = '...'

** 自 1.12.6 版本开始支持 **
仅当 `autoLimit` 为 true 时生效，省略占位符，默认为 '...'。

##${prefix} autoWrap(boolean) = false

标签自动换行，自 `1.12.6` 版本支持。

可以通过 `label.style.lineClamp`配置项，设置最大换行数量。

##${prefix} layoutFunc(function)

标签自动换行，自 `1.12.6` 版本支持。
`sampling` 关闭时生效，自定义布局配置，如果声明了 `layoutFunc`，则默认提供的防重叠相关的配置（`autoHide`, `autoRotate`, `autoLimit`）均不生效。

该属性的函数定义如下：

```ts
  /**
   * 自定义布局配置，如果声明了 `layoutFunc`，则默认提供的防重叠相关的配置（`autoHide`, `autoRotate`, `autoLimit`）均不生效
   * @param labels 标签图形元素
   * @param labelData 标签数据
   * @param layer 当前轴的层级
   * @param axis 当前轴组件实例
   * @returns void
   */
  layoutFunc?: (labels: IText[], labelData: AxisItem[], layer: number, axis: IGroup) => void;
```

#${prefix} title(Object)

轴标题配置。

{{ use: component-axis-title(
  prefix = '#'+ ${prefix}
) }}

#${prefix} grid(Object)

网格线配置。

##${prefix} smooth(boolean) = false

smooth 为 true 时，为圆形 grid，为 false 则为多边形 grid。

{{ use: component-axis-grid(
  prefix = '#' + ${prefix}
) }}

#${prefix} subGrid(Object)

子网格线配置。

##${prefix} smooth(boolean) = false

smooth 为 true 时，为圆形 grid，为 false 则为多边形 grid。

{{ use: component-axis-grid(
  prefix = '#' + ${prefix}
) }}
