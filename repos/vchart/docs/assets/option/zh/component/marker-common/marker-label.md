{{ target: component-marker-label }}

#${prefix} visible(boolean)

标签是否可见。
{{ if: !${noAutoRotate} }}
#${prefix} autoRotate(boolean)

标签整体 - 是否自动旋转。
{{ /if }}

{{ if: !${noMarkerRef} }}
{{ use: component-marker-ref(
  prefix = ${prefix}
) }}
{{ /if }}

#${prefix} minWidth(number) = 30

标签整体 - 最小宽度像素值。

#${prefix} maxWidth(number)

标签整体 - 最大宽度像素值。当文字超过最大宽度时，会自动省略。

#${prefix} labelBackground(Object)

标签背景面板配置。

##${prefix} visible(boolean)

标签背景面板是否可见。

##${prefix} customShape(function)
自 1.11.10 版本, 标签背景支持自定义 path.

回调函数的定义如下:

```ts
/**
 * @params vrender marker组件
 * @params 标签背景属性
 * @params path对象, 用户自定义绘制
 * @return 返回绘制完成后的path
 */
(component: IGroup, attrs: Partial<IGraphicAttribute>, path: ICustomPath2D) => ICustomPath2D;
```

##${prefix} padding(Object)

标签面板内部边距。

{{ use: common-padding(
  prefix = '##' + ${prefix}
) }}

{{ use: component-marker-state(
  prefix = '#' + ${prefix},
  graphicType = 'rect'
) }}

##${prefix} style(Object)

标签面板样式。

{{ use: component-marker-style-callback(
  description = '标签面板样式'
) }}

{{ use: graphic-rect(
  prefix = '##' + ${prefix}
) }}

#${prefix} type(string)

自 1.7.0 版本开始支持，文本类型。

可选：

- 'text'
- 'rich'

#${prefix} text(string | Array)

标签文本 - 文本内容，如果需要进行换行，则使用数组形式，如 ['abc', '123']。
自 1.7.0 版本开始，支持富文本内容。

#${prefix} formatMethod(Function)

标签文本 - 文本格式化配置，使用回调函数的形式配置。

{{ use:text-format-callback(
  description = '标签文本'
) }}

{{ use: component-marker-state(
  prefix = ${prefix},
  graphicType = 'text'
) }}

#${prefix} style(Object)

标签文本 - 文本样式。

{{ use: component-marker-style-callback(
  description = '文本样式'
) }}

{{ use: graphic-text(
  prefix = '#' + ${prefix}
) }}

#${prefix} shape(Object)

标签文本 - 文本前图元。

##${prefix} visible(boolean)

文本前图元可见性。

##${prefix} style(Object)

文本前图元样式。

{{ use: graphic-symbol(
  prefix = '##' + ${prefix}
) }}

#${prefix} space(number)

标签文本 - 文本同文本前图元之间的间距。

{{ if: !${noConfine} }}
#${prefix} confine(boolean) = false
自 1.4.0 版本开始, 是否自动调整 label 使其展示在 marker 可见区域内。
{{ /if }}

#${prefix} dx(number)

文本水平方向的偏移。

#${prefix} dy(number)

文本垂直方向的偏移。
