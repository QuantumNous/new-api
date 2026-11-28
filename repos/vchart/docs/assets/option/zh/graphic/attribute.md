{{ target: graphic-attribute }}

<!-- IAttribute 通用的图形属性 -->

{{ if: !${noFill} }}
{{ use: graphic-fill-style(
  prefix = ${prefix}
) }}
{{ /if }}

{{ if: !${noStroke} }}
{{ use: graphic-stroke-style(
  prefix = ${prefix},
  markType = ${markType}
) }}
{{ /if }}

#${prefix} opacity(number)

整体透明度设置。

#${prefix} cursor(string)

鼠标悬浮时在图形元素上时鼠标的样式是什么。同 CSS 的 cursor。

{{ if: !${noTexture} }}

#${prefix} texture(string)

纹理类型配置，支持：`'circle' | 'diamond' | 'rect' | 'vertical-line' | 'horizontal-line' | 'bias-lr' | 'bias-rl' | 'grid'`。

示例：

```ts
style: {
  texture: 'circle',
  texturePadding: 1,
  textureSize: 5,
  textureColor: 'red'
}
```

#${prefix} textureColor(string)

纹理颜色。

#${prefix} textureSize(number)

纹理单元的大小。

#${prefix} texturePadding(number)

纹理单元间的空隙大小。

{{ /if }}

#${prefix} pickable(boolean) = true

是否支持事件拾取，默认为 true。

#${prefix} childrenPickable(boolean) = true

对于 group 节点，是否支持其子元素的事件拾取，默认为 true。如果 group `pickable` 关闭，`childrenPickable` 开启，那么 group 的子节点仍参与事件拾取。

#${prefix} zIndex(number)

显示层级配置。

#${prefix} visible(boolean) = true

元素是否可见。

#${prefix} dx(number)

x 方向的偏移。

#${prefix} dy(number)

y 方向的偏移。

{{ if: !${noAngle} }}

#${prefix} angle(number)

旋转角度。

{{ /if }}

#${prefix} scaleX(number) = 1
x 方向缩放比例。

#${prefix} scaleY(number) = 1
y 方向缩放比例。

#${prefix} scaleCenter([number|string, number|string])

缩放中心。自 `1.4.0` 版本以后支持。
可以配置固定坐标，例如 [100, 100]；或者百分比坐标，例如 ['50%', '50%']，代表以图元中心为缩放中心。

#${prefix} pickStrokeBuffer(number) = 0

自 `1.7.3` 版本开始支持，用于扩展描边的拾取范围，为 0 就是默认线宽，正数就加宽，负数就减宽。

#${prefix} boundsPadding(number|array)

图形包围盒的边距，默认值为 0，支持两种格式：

- number: 上下左右设置统一的边距
- array: 边距数组，格式为`[top, right, bottom, left]` ，分别设置四个方向的边距

#${prefix} html(object)
自 `1.10.0` 版本开始支持，用于配置图元的 html 浮层。

##${prefix} dom(string|HTMLElement)
dom 字符串或节点。

{{ use: graphic-dom-attributes(
  prefix = ${prefix} + '#'
) }}
{{ /if }}

#${prefix} react(object)
自 `1.11.0` 版本开始支持，用于配置图元的 react 浮层。

##${prefix} element(Object)
React 元素

{{ use: graphic-dom-attributes(
  prefix = ${prefix} + '#'
) }}
{{ /if }}
