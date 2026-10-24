{{ target: component-cartesian-axis-common }}

#${prefix} autoIndent(boolean)

是否进行自动缩进，设置为 true 时，当轴元素超出绘图区会被裁剪时，会对图表增加额外的 padding，使轴可以显示完整。

#${prefix} domainLine(Object)

轴线配置。

{{ use: component-axis-domain-line(
  prefix = '#' + ${prefix}
) }}

##${prefix} startSymbol(Object)

轴线起始点标记配置。

{{ use:  graphic-segment-symbol(
  prefix = '##' + ${prefix}
) }}

##${prefix} endSymbol(Object)

轴线结束点标记配置。

{{ use:  graphic-segment-symbol(
  prefix = '##' + ${prefix}
) }}

##${prefix} onZero(boolean) = false

X 轴或者 Y 轴的轴线是否在另一个轴的 0 刻度上，只有在另一个轴为数值轴且包含 0 刻度时有效。默认为 false，交由用户按需打开。

##${prefix} onZeroAxisIndex(number)

当有多轴时，可以用这个属性手动指定，在哪个轴的 0 刻度上。

- Tips: **该索引对应所有轴的 index**。

##${prefix} onZeroAxisId(string|number)

当有多轴时，可以用这个属性手动指定，在哪个轴的 0 刻度上。

#${prefix} label(Object)

轴标签配置。

{{ use: component-axis-label(
  prefix  = '#' + ${prefix}
) }}

##${prefix} flush(boolean) = false

坐标轴首尾文字向内收缩。

##${prefix} lastVisible(boolean)

**`sampling` 开启时生效**，最后一个坐标轴文字是否显示。默认根据标签重叠策略自动判定。

##${prefix} autoRotate(boolean) = false

轴标签自动旋转开关，默认关闭，**需要手动开启，同时需要将 `sampling` 关闭**。

##${prefix} autoRotateAngle(array) = [0, 45, 90]

仅当 `autoRotate` 为 true 时生效，可选的旋转范围，默认为 [0, 45, 90]。

##${prefix} autoHide(boolean) = false

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

仅当 `autoHide` 为 true 时生效，设置文本之间的间隔距离，单位 px。

##${prefix} autoLimit(boolean) = false

轴标签自动截断开关，默认关闭，**需要手动开启，同时需要将 `sampling` 关闭**。

##${prefix} limitEllipsis(string) = '...'

仅当 `autoLimit` 为 true 时生效，省略占位符，默认为 '...'。

##${prefix} autoWrap(boolean) = false

标签自动换行，自 `1.12.5` 版本支持。

与 `autoRotate` 不能同时生效，若开启了 `autoRotate`，则优先使用自动旋转策略。

可以通过 `label.style.lineClamp`配置项，设置最大换行数量。

##${prefix} layoutFunc(function)

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

##${prefix} containerAlign(string)

自 `1.3.0` 版本开始支持，用于配置 label 相对于坐标轴容器整体的对齐方式。

- `top`：整体向上对齐（垂直方向）
- `middle`：整体居中对齐（垂直方向）
- `bottom`：整体向下对齐（垂直方向）
- `left`：整体向左对齐（水平方向）
- `center`：整体居中对齐（水平方向）
- `right`：整体向右对齐（水平方向）

#${prefix} title(Object)

轴标题配置。

{{ use: component-axis-title(
  prefix = '#'+ ${prefix}
) }}

##${prefix} autoRotate(boolean) = true

标题是否根据轴方向自动渲染，生效于左右纵轴。默认为 true，表现为左轴标题整体旋转 -90 度，右轴标题整体旋转为 90 度。

**如果需要单独在 `textStyle` 中配置文本的 angle 的话，建议将该属性设置为 false。**

##${prefix} inside(boolean) = false

标题朝向，默认朝外(坐标线包围盒外部)。

#${prefix} background(Object)

坐标轴背景配置。

##${prefix} visible(boolean) = false

是否绘制轴背景。

##${prefix} style(Object)

轴背景样式设置。

{{ use: graphic-rect(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

标题背景在不同交互状态下的样式配置，**当坐标轴开启 hover/select 交互时生效**，目前坐标轴支持如下四种交互状态：

- 1.  hover
- 2.  hover_reverse
- 3.  selected
- 4.  selected_reverse

###${prefix} hover(Object)

元素被 hover 时的样式配置。

{{ use: graphic-rect(
  prefix = '###' + ${prefix}
) }}

###${prefix} hover_reverse(Object)

其他元素被 hover 时的样式配置。

{{ use: graphic-rect(
  prefix = '###' + ${prefix}
) }}

###${prefix} selected(Object)

元素被选中时的样式配置。

{{ use: graphic-rect(
  prefix = '###' + ${prefix}
) }}

###${prefix} selected_reverse(Object)

其他元素被选中时的样式配置。

{{ use: graphic-rect(
  prefix = '###' + ${prefix}
) }}

#${prefix} grid(Object)

网格线配置。

{{ use: component-axis-grid(
  prefix = '#' + ${prefix}
) }}

#${prefix} subGrid(Object)

子网格线配置。

{{ use: component-axis-grid(
  prefix = '#' +${prefix}
) }}

#${prefix} mode('3d' | '2d')
轴组件是否是 3d 模式的轴组件，3d 模式的轴组件相比于 2d 轴会有一些变化，比如 3d 轴的 tick 线会朝向窗口（注意这个和 support3d 配置是有区别的，support3d 配置的是图元是否在 3d 模式中应用 3d 变换，其自身的形态是不会变化的，而轴的 mode 切换，会使轴形态直接发生变化）

#${prefix} unit(Object)

自 `1.5.1` 版本开始支持。轴单位配置，仅适用于直角坐标系下的坐标轴。

##${prefix} visible(boolean) = false

是否显示轴单位。

##${prefix} text(string|number)

轴单位文字。

##${prefix} style(Object)

轴单位文字样式配置。

Axis title style settings.

{{ use: graphic-text(
  prefix = '##' + ${prefix}
) }}

#${prefix} innerOffset(Object)

直角坐标系轴的内缩进，可以在绘图区内部产生留白，能避免一些图形被截断的场景。

上下轴支持配置 `left`、`right`，左右轴支持配置 `top`、`bottom`。

##${prefix} left(ILayoutNumber)

上下轴的左侧留白

{{ use: common-layout-number }}

##${prefix} right(ILayoutNumber)

上下轴的右侧留白

{{ use: common-layout-number }}

##${prefix} top(ILayoutNumber)

左右轴的上侧留白

{{ use: common-layout-number }}

##${prefix} bottom(ILayoutNumber)

左右轴的下侧留白

{{ use: common-layout-number }}
